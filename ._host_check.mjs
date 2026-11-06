// Headless harness for the HOST bundle (index.js).
// 1) Imports apply() with a mock ctx and verifies route + tools register without throwing.
// 2) Invokes the registered API handler against the REAL filesystem to prove the
//    relay-dir sibling resolution fix returns live ledger data.

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const here = new URL('.', import.meta.url)
const indexUrl = new URL('./index.js', here)
const tempRoot = mkdtempSync(join(tmpdir(), 'dsh-workbench-host-check-'))
const tempWorkspace = join(tempRoot, 'workspace')
mkdirSync(tempWorkspace, { recursive: true })
// v1.0: the project root carries a hand-written AGENTS.md section the generator
// must never touch, plus a legacy state.json/decisions.md snapshot that has to
// be imported exactly once.
writeFileSync(join(tempWorkspace, 'AGENTS.md'), '# 手工区\n\n- 这条是用户自己写的，生成器不许动。\n', 'utf8')
writeFileSync(join(tempWorkspace, 'state.json'), JSON.stringify({
  mainline: '迁移主线：v0.8 画布已完成',
  stopped_at: '等重启验证',
  next: ['重启 DSH', '验画布'],
  red_lines: ['判断不下放', '没有 executor 的节点必须灰显'],
}, null, 2), 'utf8')
writeFileSync(join(tempWorkspace, 'decisions.md'), [
  '',
  '### 2026-11-05T10:00:00.000Z',
  '背景：旧的决定。',
  '决定：保留只读画布。',
  '',
  '### 2026-11-06T10:00:00.000Z',
  '背景：记忆有三套半系统。',
  '决定：只留 JSON 真源。',
  '',
].join('\n'), 'utf8')
writeFileSync(join(tempWorkspace, 'workbench.config.json'), JSON.stringify({
  execution: { enabled: true, cwd: '.' },
}), 'utf8')
process.env.DSH_WORKBENCH_DIR = tempWorkspace

const registered = []
let requestRejection = null
let streamCalls = 0
let sessionRunning = true
let failCancel = false
const dispatchCalls = { create: [], selectModel: [], prompt: [], cancel: [] }
const createdSessionId = 'sess-harness-1'
const mockSessionController = {
  create: async (opts) => { dispatchCalls.create.push(opts); return { sessionId: createdSessionId } },
  selectModel: async (request) => { dispatchCalls.selectModel.push(request); return { provider: request.provider, model: request.model } },
  prompt: async (request, signal) => {
    // Real Host: `async prompt(request, signal)` calls signal.throwIfAborted()
    // unconditionally, so omitting the second argument must fail here too.
    if (typeof signal?.throwIfAborted !== 'function') {
      throw new Error('sessionController.prompt(request, signal) requires an AbortSignal second argument')
    }
    dispatchCalls.prompt.push(request)
    return { accepted: true }
  },
  cancel: async (request) => {
    dispatchCalls.cancel.push(request)
    if (failCancel) throw new Error('session 不在当前 Harness 中')
    return { accepted: true }
  },
  list: async () => [
    { sessionId: createdSessionId, agentAvailable: true, running: sessionRunning, blank: false, updatedAt: Date.now() },
    { sessionId: 'sess-titled', agentAvailable: true, running: false, blank: false, updatedAt: Date.now() - 60000 },
  ],
}
let sessionWaiting = false
const sessionEvents = [
  { type: 'turn/start', time: 1793945000000, data: {} },
  { type: 'step/start', time: 1793945001000, data: {} },
  { type: 'tool/call', time: 1793945002000, data: { name: 'ops_bash', callId: 'call-1', arguments: { cmd: 'node D:/workbench/out/result.md' } } },
  { type: 'tool/result', time: 1793945003000, data: { callId: 'call-1' } },
  { type: 'step/start', time: 1793945004000, data: {} },
  { type: 'assistant/message', time: 1793945005000, data: { message: { content: [{ type: 'text', text: '完成：测试回复。\n\n- 结论一\n- 结论二\n\n需要确认：是否继续？' }] } } },
  { type: 'turn/end', time: 1793945006000, data: { reason: { kind: 'end_turn' } } },
]
const waitingEvents = [
  { type: 'turn/start', time: 1793945000000, data: {} },
  { type: 'step/start', time: 1793945001000, data: {} },
  { type: 'tool/call', time: 1793945002000, data: { name: 'ask_user_question', callId: 'call-9' } },
]
const titledEvents = [
  { type: 'session/title', time: 1793944000000, data: { title: '已有的会话标题' } },
  { type: 'turn/start', time: 1793944001000, data: {} },
  { type: 'turn/end', time: 1793944002000, data: { reason: { kind: 'end_turn' } } },
]
const mockSessions = {
  get: (id) => id === createdSessionId ? {
    snapshotEvents: () => (sessionWaiting ? waitingEvents : sessionEvents),
  } : id === 'sess-titled' ? {
    snapshotEvents: () => titledEvents,
  } : undefined,
}
const mockLlm = {
  listProviders: () => ['deepseek-official', 'gongyizhan'],
  listModels: (provider) => provider === 'gongyizhan'
    ? [{ id: 'kimi-k3-1', name: 'Kimi-K3-1' }, { id: 'hy3', name: 'hy3' }]
    : [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }],
  stream: () => { streamCalls++; return null },
}
const mockDefaultModel = { currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-flash' }) }
const ctx = {
  webServer: { register: (r) => registered.push({ regType: 'web', ...r }) },
  tools: { register: (t) => registered.push({ regType: 'tool', ...t }) },
  connection: { requestRejection: () => requestRejection }, // null = trusted
  get: (name) => name === 'llm' ? mockLlm
    : name === 'agentDefaultModel' ? mockDefaultModel
      : name === 'sessionController' ? mockSessionController
        : name === 'sessions' ? mockSessions
          : undefined,
}

const mod = await import(indexUrl)
await mod.apply(ctx)

const route = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/state-v2')
const memoryRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/memory')
const modelsRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/models')
const stateEditRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/state-edit')
const decisionRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/decision-add')
const auditRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/audit')
const dispatchRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/dispatch')
const runsRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/runs')
const runsCancelRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/runs/cancel')
const sessionsRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/sessions')
const modulesRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/modules')
const reportRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/report')
const templatesRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/templates')
const toolNames = registered.filter(r => r.regType === 'tool').map(r => r.name)

console.log('registered count:', registered.length)
console.log('route path:', route?.path)
console.log('memory path:', memoryRoute?.path)
console.log('models path:', modelsRoute?.path)
console.log('write paths:', stateEditRoute?.path, decisionRoute?.path, auditRoute?.path)
console.log('dispatch paths:', dispatchRoute?.path, runsRoute?.path, runsCancelRoute?.path)
console.log('v0.6 paths:', sessionsRoute?.path, modulesRoute?.path, reportRoute?.path)
console.log('v0.7 paths:', templatesRoute?.path)
console.log('tool names:', toolNames)

const ok =
  route && route.path === '/dsh-workbench/api/state-v2' &&
  memoryRoute && modelsRoute && stateEditRoute && decisionRoute && auditRoute &&
  dispatchRoute && runsRoute && runsCancelRoute && sessionsRoute && modulesRoute && reportRoute && templatesRoute &&
  ['wb_get', 'wb_set', 'wb_close', 'wb_models', 'wb_runs'].every(n => toolNames.includes(n)) &&
  toolNames.length === 5
if (!ok) { console.error('FAIL: registration mismatch'); process.exit(1) }

// Every Host tool must expose a JSON Schema of type "object". Providers reject
// a null/absent type (e.g. "schema must be a JSON Schema of 'type: \"object\"',
// got 'type: null'"), so a bare property map is not acceptable.
for (const tool of registered.filter(r => r.regType === 'tool')) {
  const schema = tool.parameters
  if (!schema || schema.type !== 'object') {
    console.error('FAIL: tool', tool.name, 'parameters.type is', schema?.type, '(expected "object")')
    process.exit(1)
  }
  if (!schema.properties || typeof schema.properties !== 'object') {
    console.error('FAIL: tool', tool.name, 'parameters.properties missing')
    process.exit(1)
  }
  for (const [key, descriptor] of Object.entries(schema.properties)) {
    if (typeof descriptor !== 'object' || descriptor === null || typeof descriptor.type !== 'string') {
      console.error('FAIL: tool', tool.name, 'property', key, 'has no JSON Schema type')
      process.exit(1)
    }
    if ('required' in descriptor) {
      console.error('FAIL: tool', tool.name, 'property', key, 'uses invalid "required" keyword')
      process.exit(1)
    }
  }
  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required) || schema.required.some(name => !(name in schema.properties))) {
      console.error('FAIL: tool', tool.name, 'required must be an array of declared properties')
      process.exit(1)
    }
  }
}

// Invoke the live handler against the real FS.
const chunks = []
const res = {
  statusCode: 0, headers: {},
  setHeader(k, v) { this.headers[k] = v },
  end(body) { this.body = body },
}
const req = { method: 'GET', headers: { host: '127.0.0.1:55293' }, url: route.path }
await route.handler(req, res)
if (res.statusCode !== 200) { console.error('FAIL: handler status', res.statusCode); process.exit(1) }
const payload = JSON.parse(res.body)
if (payload.ok !== true) { console.error('FAIL: payload not ok', payload); process.exit(1) }
console.log('payload.ok:', payload.ok)
console.log('state.mainline present:', !!payload.state?.mainline || '(empty)')
console.log('ledger.rows:', payload.ledger?.rows?.length)
console.log('ledger.totalTokens:', payload.ledger?.totalTokens)
console.log('tasks:', Array.isArray(payload.tasks) ? payload.tasks.length : 0)
// The fix: relay lives in the SIBLING D:\AI Pj\relay, so rows must be > 0.
if (!Array.isArray(payload.ledger?.rows) || payload.ledger.rows.length === 0) {
  console.error('FAIL: relay sibling not resolved — ledger rows empty')
  process.exit(1)
}
// Memory (v1.0): one JSON truth per project root, one generated AGENTS.md
// block. The legacy state.json/decisions.md pair is imported exactly once, and
// the hand-written section of AGENTS.md must survive every regeneration.
const memoryResponse = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
await memoryRoute.handler({ method: 'GET', headers: { host: '127.0.0.1:55293' }, url: memoryRoute.path }, memoryResponse)
if (memoryResponse.statusCode !== 200) { console.error('FAIL: memory status', memoryResponse.statusCode, memoryResponse.body); process.exit(1) }
const memory = JSON.parse(memoryResponse.body)
if (memory.ok !== true || !memory.active || memory.root !== realpathSync(tempWorkspace)) {
  console.error('FAIL: memory payload', memory)
  process.exit(1)
}
const memoryFile = join(tempWorkspace, 'memory', memory.active + '.json')
const stored = JSON.parse(readFileSync(memoryFile, 'utf8'))
if (stored.mainline !== '迁移主线：v0.8 画布已完成' || stored.next.length !== 2 || stored.red_lines.length !== 2) {
  console.error('FAIL: legacy state.json not migrated', stored)
  process.exit(1)
}
if (stored.migratedFrom !== 'state.json+decisions.md' || stored.decisions.length !== 2) {
  console.error('FAIL: legacy decisions not indexed', stored.migratedFrom, stored.decisions)
  process.exit(1)
}
const agentsText = readFileSync(join(tempWorkspace, 'AGENTS.md'), 'utf8')
if (!agentsText.includes('这条是用户自己写的，生成器不许动。')) {
  console.error('FAIL: manual AGENTS.md section was overwritten', agentsText)
  process.exit(1)
}
if (!agentsText.includes('<!-- dsh-workbench:generated:start -->') || !agentsText.includes('<!-- dsh-workbench:generated:end -->')) {
  console.error('FAIL: generated block markers missing', agentsText)
  process.exit(1)
}
if (!agentsText.includes('迁移主线：v0.8 画布已完成')) {
  console.error('FAIL: mainline not rendered into AGENTS.md')
  process.exit(1)
}
const blockStart = agentsText.indexOf('<!-- dsh-workbench:generated:start -->')
const blockEnd = agentsText.indexOf('<!-- dsh-workbench:generated:end -->', blockStart)
const generatedBlock = agentsText.slice(blockStart, blockEnd)
const generatedBytes = Buffer.byteLength(generatedBlock, 'utf8')
if (generatedBytes > 2048) {
  console.error('FAIL: generated block over budget', generatedBytes)
  process.exit(1)
}
// state-v2 must be derived from the same record (state.json is no longer read).
if (payload.memory?.active !== memory.active || payload.state?.mainline !== stored.mainline) {
  console.error('FAIL: state-v2 memory not derived from the record', payload.memory?.active, payload.state?.mainline)
  process.exit(1)
}
// Regeneration is idempotent: exactly one block, manual text intact.
const memoryAgain = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
await memoryRoute.handler({ method: 'GET', headers: { host: '127.0.0.1:55293' }, url: memoryRoute.path }, memoryAgain)
const agentsAgain = readFileSync(join(tempWorkspace, 'AGENTS.md'), 'utf8')
if ((agentsAgain.match(/dsh-workbench:generated:start/g) || []).length !== 1 || !agentsAgain.includes('这条是用户自己写的，生成器不许动。')) {
  console.error('FAIL: generated block duplicated or manual text lost', agentsAgain)
  process.exit(1)
}
// v1.0 Phase A exit, stated explicitly: the old preview endpoint and the
// primary/secondary fields are gone (not merely unused), and two renders of the
// same record produce byte-identical injected text, which is what keeps the
// session prefix cacheable.
const blockOf = text => {
  const start = text.indexOf('<!-- dsh-workbench:generated:start -->')
  const end = text.indexOf('<!-- dsh-workbench:generated:end -->', start)
  return start >= 0 && end > start ? text.slice(start, end) : ''
}
if (registered.some(item => item.regType === 'web' && /preview/i.test(String(item.path)))) {
  console.error('FAIL: a preview route is still registered')
  process.exit(1)
}
const indexSource = readFileSync(new URL('./index.js', here), 'utf8')
const clientSource = readFileSync(new URL('./client.js', here), 'utf8')
for (const [label, source] of [['index.js', indexSource], ['client.js', clientSource]]) {
  if (source.includes('/api/preview')) {
    console.error('FAIL: ' + label + ' still calls the removed preview endpoint')
    process.exit(1)
  }
}
const stateJson = JSON.stringify(payload)
if (/"primary"\s*:/.test(stateJson) || /"secondary"\s*:/.test(stateJson)) {
  console.error('FAIL: state payload still carries primary/secondary')
  process.exit(1)
}
if (/"primary"\s*:/.test(agentsAgain) || /"secondary"\s*:/.test(agentsAgain)) {
  console.error('FAIL: injected AGENTS.md still carries primary/secondary')
  process.exit(1)
}
const blockHash = createHash('sha256').update(blockOf(agentsText)).digest('hex')
const blockHashAgain = createHash('sha256').update(blockOf(agentsAgain)).digest('hex')
if (blockHash !== blockHashAgain) {
  console.error('FAIL: two renders of the same record differ', blockHash, blockHashAgain)
  process.exit(1)
}
console.log('phase A exit: no preview route, no primary/secondary in payload or injection, block sha256 stable across renders:', blockHash.slice(0, 12))

// Loopback only.
const remoteMemory = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
await memoryRoute.handler({ method: 'GET', headers: { host: '10.0.0.7:55293' }, url: memoryRoute.path }, remoteMemory)
if (remoteMemory.statusCode !== 403) { console.error('FAIL: memory accepted remote host', remoteMemory.statusCode); process.exit(1) }
console.log('memory.active:', memory.active)
console.log('memory.root:', memory.root)
console.log('memory.agentsBytes:', generatedBytes)
console.log('memory.decisions:', stored.decisions.length)
console.log('memory.migratedFrom:', stored.migratedFrom)

// Model catalog: read-only, reflects the llm service, and never issues a model
// request (streamCalls must stay 0).
const modelsResponse = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
await modelsRoute.handler({ method: 'GET', headers: { host: '127.0.0.1:55293' }, url: modelsRoute.path }, modelsResponse)
if (modelsResponse.statusCode !== 200) { console.error('FAIL: models status', modelsResponse.statusCode); process.exit(1) }
const models = JSON.parse(modelsResponse.body)
if (models.ok !== true || models.available !== true) { console.error('FAIL: models payload', models); process.exit(1) }
const gongyizhan = models.groups.find(group => group.id === 'gongyizhan')
if (!gongyizhan || !gongyizhan.models.some(model => model.id === 'kimi-k3-1')) {
  console.error('FAIL: configured model routes not exposed', models.groups)
  process.exit(1)
}
if (models.current?.provider !== 'deepseek-official' || models.current?.model !== 'deepseek-flash') {
  console.error('FAIL: default model selection not exposed', models.current)
  process.exit(1)
}
if (streamCalls !== 0) { console.error('FAIL: model catalog invoked the model stream'); process.exit(1) }
const blockedModels = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
await modelsRoute.handler({ method: 'POST', headers: { host: '127.0.0.1:55293' }, url: modelsRoute.path }, blockedModels)
if (blockedModels.statusCode !== 405) { console.error('FAIL: models accepted non-GET', blockedModels.statusCode); process.exit(1) }
console.log('models.groups:', models.groups.map(group => group.id + '(' + group.models.length + ')').join(', '))
console.log('models.current:', models.current.provider + '/' + models.current.model)

const modelsTool = registered.find(r => r.regType === 'tool' && r.name === 'wb_models')
const toolResult = await modelsTool.execute({})
if (!toolResult?.text?.includes('gongyizhan/kimi-k3-1')) {
  console.error('FAIL: wb_models tool output', toolResult)
  process.exit(1)
}

// --- editable continuity + audit -------------------------------------------
const response = () => ({ statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } })
const postReq = (path, value) => ({
  method: 'POST',
  headers: { host: '127.0.0.1:55293', 'content-type': 'application/json' },
  url: path,
  async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(value), 'utf8') },
})
const getReq = (path) => ({ method: 'GET', headers: { host: '127.0.0.1:55293' }, url: path })

const editRes = response()
await stateEditRoute.handler(postReq(stateEditRoute.path, {
  mainline: '面板主线：闭环验证',
  stopped_at: 'P0 可写与审计',
  next: ['保存一次编辑', '看到审计'],
  red_lines: ['不绕过权限'],
  requestId: 'harness-state-1',
}), editRes)
if (editRes.statusCode !== 200) { console.error('FAIL: state-edit status', editRes.statusCode, editRes.body); process.exit(1) }
const edited = JSON.parse(editRes.body)
if (edited.ok !== true || edited.changed !== true) { console.error('FAIL: state-edit result', edited); process.exit(1) }
if (edited.project?.key !== memory.active || edited.agents?.ok !== true || edited.agents.bytes > 2048) {
  console.error('FAIL: state-edit did not write the project record', edited.project, edited.agents)
  process.exit(1)
}
// The edit lands in the project JSON, not in a second state.json.
const editedState = JSON.parse(readFileSync(memoryFile, 'utf8'))
if (editedState.mainline !== '面板主线：闭环验证' || editedState.next.length !== 2) {
  console.error('FAIL: project memory not written by state-edit', editedState)
  process.exit(1)
}
if (JSON.parse(readFileSync(join(tempWorkspace, 'state.json'), 'utf8')).mainline !== '迁移主线：v0.8 画布已完成') {
  console.error('FAIL: legacy state.json was rewritten (it must stay untouched)')
  process.exit(1)
}

const noopRes = response()
await stateEditRoute.handler(postReq(stateEditRoute.path, { mainline: '面板主线：闭环验证' }), noopRes)
if (JSON.parse(noopRes.body).changed !== false) { console.error('FAIL: no-op edit reported a change'); process.exit(1) }

const badRes = response()
await stateEditRoute.handler(postReq(stateEditRoute.path, { mainline: 42 }), badRes)
if (badRes.statusCode !== 400) { console.error('FAIL: invalid state-edit accepted', badRes.statusCode); process.exit(1) }

const hugeRes = response()
await stateEditRoute.handler(postReq(stateEditRoute.path, { mainline: 'x'.repeat(70 * 1024) }), hugeRes)
if (hugeRes.statusCode !== 413) { console.error('FAIL: oversized body accepted', hugeRes.statusCode); process.exit(1) }

const decisionRes = response()
await decisionRoute.handler(postReq(decisionRoute.path, { text: '审计决策：面板写入路径已接通。', requestId: 'harness-decision-1' }), decisionRes)
if (decisionRes.statusCode !== 200) { console.error('FAIL: decision-add status', decisionRes.statusCode, decisionRes.body); process.exit(1) }
const projectDecisionsFile = join(tempWorkspace, 'memory', memory.active + '.decisions.md')
if (!readFileSync(projectDecisionsFile, 'utf8').includes('审计决策：面板写入路径已接通。')) {
  console.error('FAIL: decision not appended to the project record')
  process.exit(1)
}
const decisionsAfterAppend = JSON.parse(readFileSync(memoryFile, 'utf8')).decisions
if (decisionsAfterAppend.length !== 3 || decisionsAfterAppend[2].title !== '审计决策：面板写入路径已接通。') {
  console.error('FAIL: decision index not updated', decisionsAfterAppend)
  process.exit(1)
}

// Tools: wb_get / wb_set / wb_close operate on the same record and the same
// generated block. wb_close is the only writer of the close outcome.
const tool = name => registered.find(r => r.regType === 'tool' && r.name === name)
const setTool = await tool('wb_set').execute({ mainline: '工具写回：v1.0 记忆收口', next: '验工具; 验画布' })
if (!String(setTool.text).includes('已写回')) { console.error('FAIL: wb_set text', setTool.text); process.exit(1) }
const afterSet = JSON.parse(readFileSync(memoryFile, 'utf8'))
if (afterSet.mainline !== '工具写回：v1.0 记忆收口' || afterSet.next.length !== 2 || afterSet.openedAt === '') {
  console.error('FAIL: wb_set did not write the record', afterSet)
  process.exit(1)
}
const agentsAfterSet = readFileSync(join(tempWorkspace, 'AGENTS.md'), 'utf8')
if (!agentsAfterSet.includes('工具写回：v1.0 记忆收口') || !agentsAfterSet.includes('这条是用户自己写的，生成器不许动。')) {
  console.error('FAIL: wb_set did not regenerate AGENTS.md correctly')
  process.exit(1)
}

const getState = await tool('wb_get').execute({ section: 'state' })
if (!String(getState.text).includes('工具写回：v1.0 记忆收口') || !String(getState.text).includes('缺口')) {
  console.error('FAIL: wb_get state', getState.text)
  process.exit(1)
}
const closeTool = await tool('wb_close').execute({
  next: '重启 DSH 后按清单验收',
  decision: '背景：记忆有三套半。决定：只留 JSON 真源 + 生成块。代价：旧 memory 预览下线。',
  title: 'v1.0 记忆收口',
  outcome: 'yellow',
  runId: 'run_tool_close_1',
})
if (!String(closeTool.text).includes('已收工')) { console.error('FAIL: wb_close text', closeTool.text); process.exit(1) }
const afterClose = JSON.parse(readFileSync(memoryFile, 'utf8'))
if (!afterClose.closedAt || afterClose.outcome !== 'yellow' || afterClose.basis.runId !== 'run_tool_close_1') {
  console.error('FAIL: wb_close did not record the close', afterClose)
  process.exit(1)
}
const closedDecisions = afterClose.decisions
if (closedDecisions[closedDecisions.length - 1].title !== 'v1.0 记忆收口') {
  console.error('FAIL: wb_close decision title', closedDecisions)
  process.exit(1)
}
const getDecisions = await tool('wb_get').execute({ section: 'decisions' })
if (!String(getDecisions.text).includes('v1.0 记忆收口')) {
  console.error('FAIL: wb_get decisions', getDecisions.text)
  process.exit(1)
}

// A second project gets its own record and its own AGENTS.md; the first one is
// untouched. This is the whole point of per-project memory.
const secondProject = join(tempWorkspace, 'proj-second')
mkdirSync(secondProject, { recursive: true })
const secondRes = response()
await memoryRoute.handler(postReq(memoryRoute.path, { root: secondProject, sessionId: 'sess-harness-1', requestId: 'harness-memory-2' }), secondRes)
if (secondRes.statusCode !== 200) { console.error('FAIL: memory activate status', secondRes.statusCode, secondRes.body); process.exit(1) }
const second = JSON.parse(secondRes.body)
if (second.active === memory.active || second.root !== realpathSync(secondProject)) {
  console.error('FAIL: second project not activated', second.active, second.root)
  process.exit(1)
}
const secondSet = await tool('wb_set').execute({ mainline: '第二个项目：互不干扰' })
if (!String(secondSet.text).includes('已写回')) { console.error('FAIL: second wb_set', secondSet.text); process.exit(1) }
const secondAgents = readFileSync(join(secondProject, 'AGENTS.md'), 'utf8')
if (!secondAgents.includes('第二个项目：互不干扰') || !secondAgents.includes('# AGENTS.md')) {
  console.error('FAIL: second project AGENTS.md', secondAgents)
  process.exit(1)
}
if (JSON.parse(readFileSync(memoryFile, 'utf8')).mainline !== '工具写回：v1.0 记忆收口') {
  console.error('FAIL: first project overwritten by second project write')
  process.exit(1)
}
const listTool = await tool('wb_get').execute({ section: 'projects' })
if (!String(listTool.text).includes('proj-second') || !String(listTool.text).includes('* = 当前激活项目')) {
  console.error('FAIL: wb_get projects', listTool.text)
  process.exit(1)
}

// The generated block is bounded even when every field is at its limit: the
// harness injects this file, so a 20 KB block would be a transcript.
const fatProject = join(tempWorkspace, 'proj-fat')
mkdirSync(fatProject, { recursive: true })
const fatRes = response()
await memoryRoute.handler(postReq(memoryRoute.path, { root: fatProject }), fatRes)
const fatSet = await tool('wb_set').execute({
  mainline: '长'.repeat(500),
  stopped_at: '停'.repeat(500),
  next: ['一'.repeat(500), '二'.repeat(500), '三'.repeat(500)].join(';'),
  red_lines: Array.from({ length: 20 }, (_, i) => `红线${i}：` + '禁'.repeat(280)).join(';'),
})
if (!String(fatSet.text).includes('已写回')) { console.error('FAIL: fat wb_set', fatSet.text); process.exit(1) }
const fatAgents = readFileSync(join(fatProject, 'AGENTS.md'), 'utf8')
const fatStart = fatAgents.indexOf('<!-- dsh-workbench:generated:start -->')
const fatEnd = fatAgents.indexOf('<!-- dsh-workbench:generated:end -->', fatStart)
const fatBlock = fatAgents.slice(fatStart, fatEnd)
if (fatStart < 0 || fatEnd < 0 || Buffer.byteLength(fatBlock, 'utf8') > 2048) {
  console.error('FAIL: generated block exceeded the budget with fat fields', Buffer.byteLength(fatBlock, 'utf8'))
  process.exit(1)
}
// Restore the first project as the active one for the rest of the harness.
const restoreRes = response()
await memoryRoute.handler(postReq(memoryRoute.path, { root: tempWorkspace }), restoreRes)
console.log('memory.second:', second.active)
console.log('memory.fatBlockBytes:', Buffer.byteLength(fatBlock, 'utf8'))

const auditRes = response()
await auditRoute.handler(getReq(auditRoute.path + '?limit=10'), auditRes)
if (auditRes.statusCode !== 200) { console.error('FAIL: audit status', auditRes.statusCode); process.exit(1) }
const audit = JSON.parse(auditRes.body)
if (!Array.isArray(audit.entries) || audit.entries.length < 2) { console.error('FAIL: audit entries', audit); process.exit(1) }
const actions = audit.entries.map(entry => entry.action)
if (!actions.includes('state.edit') || !actions.includes('decision.append')) {
  console.error('FAIL: audit actions missing', actions)
  process.exit(1)
}
if (!audit.entries.some(entry => entry.changes && entry.changes.mainline && entry.changes.mainline.to === '面板主线：闭环验证')) {
  console.error('FAIL: audit change detail missing', audit.entries[0])
  process.exit(1)
}

const methodRes = response()
await stateEditRoute.handler(getReq(stateEditRoute.path), methodRes)
if (methodRes.statusCode !== 405) { console.error('FAIL: state-edit accepted GET', methodRes.statusCode); process.exit(1) }

requestRejection = 401
const untrustedRes = response()
await stateEditRoute.handler(postReq(stateEditRoute.path, { mainline: 'x' }), untrustedRes)
if (untrustedRes.statusCode !== 401) { console.error('FAIL: untrusted write accepted', untrustedRes.statusCode); process.exit(1) }
requestRejection = null

const remoteRes = response()
await stateEditRoute.handler({ ...postReq(stateEditRoute.path, { mainline: 'x' }), headers: { host: '192.168.1.5:55293' } }, remoteRes)
if (remoteRes.statusCode !== 403) { console.error('FAIL: non-loopback write accepted', remoteRes.statusCode); process.exit(1) }

console.log('audit entries:', audit.entries.length, '| actions:', actions.join(', '))
console.log('state-edit guards: 405/401/403/413/400 all enforced')

// --- dispatch: dry run, disabled gate, real dispatch, status, cancel --------
const configPath = join(tempWorkspace, 'workbench.config.json')
const configWithExecution = JSON.stringify({
  memory: { primary: ['primary.md'], secondary: ['secondary.md'], budgetTokens: 91 },
  execution: { enabled: true, cwd: '.' },
})
const configWithoutExecution = JSON.stringify({
  memory: { primary: ['primary.md'], secondary: ['secondary.md'], budgetTokens: 91 },
})

// The state payload must advertise the execution capability.
const stateRes2 = response()
await route.handler(getReq(route.path), stateRes2)
const statePayload2 = JSON.parse(stateRes2.body)
if (statePayload2.execution?.controller !== true || statePayload2.execution?.enabled !== true) {
  console.error('FAIL: state payload execution info', statePayload2.execution)
  process.exit(1)
}

const dryRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, { goal: '闭环测试', plan: '步骤', instruction: '注意', model: 'deepseek-official/deepseek-flash', dryRun: true }), dryRes)
if (dryRes.statusCode !== 200) { console.error('FAIL: dry-run status', dryRes.statusCode, dryRes.body); process.exit(1) }
const dry = JSON.parse(dryRes.body)
if (dry.available !== true || dry.executionEnabled !== true || !String(dry.prompt).includes('闭环测试')) {
  console.error('FAIL: dry-run payload', dry)
  process.exit(1)
}
if (dispatchCalls.create.length !== 0) { console.error('FAIL: dry run created a session'); process.exit(1) }

writeFileSync(configPath, configWithoutExecution, 'utf8')
const disabledRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, { goal: '不应执行' }), disabledRes)
if (disabledRes.statusCode !== 409) { console.error('FAIL: disabled execution accepted', disabledRes.statusCode); process.exit(1) }
writeFileSync(configPath, configWithExecution, 'utf8')

const dispatchRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, {
  goal: '闭环测试：派发一次真实任务',
  plan: '1. 检查 2. 执行',
  instruction: '只做最小改动',
  model: 'deepseek-official/deepseek-flash',
}), dispatchRes)
if (dispatchRes.statusCode !== 200) { console.error('FAIL: dispatch status', dispatchRes.statusCode, dispatchRes.body); process.exit(1) }
const dispatch = JSON.parse(dispatchRes.body)
if (dispatch.ok !== true || dispatch.run?.status !== 'running' || dispatch.run?.sessionId !== createdSessionId) {
  console.error('FAIL: dispatch run', dispatch)
  process.exit(1)
}
const run = dispatch.run
if (dispatchCalls.create.length !== 1 || dispatchCalls.create[0].cwd !== realpathSync(tempWorkspace)) {
  console.error('FAIL: create cwd', dispatchCalls.create)
  process.exit(1)
}
if (dispatchCalls.selectModel.length !== 1 || dispatchCalls.selectModel[0].provider !== 'deepseek-official') {
  console.error('FAIL: selectModel call', dispatchCalls.selectModel)
  process.exit(1)
}
if (!dispatchCalls.prompt[0]?.content?.[0]?.text?.includes('闭环测试')) {
  console.error('FAIL: prompt content', dispatchCalls.prompt)
  process.exit(1)
}
const persistedRuns = JSON.parse(readFileSync(join(tempWorkspace, 'runs.json'), 'utf8'))
if (!persistedRuns.items.some(item => item.runId === run.runId && item.status === 'running')) {
  console.error('FAIL: run registry not written', persistedRuns)
  process.exit(1)
}

const runsRes = response()
await runsRoute.handler(getReq(runsRoute.path), runsRes)
const runsPayload = JSON.parse(runsRes.body)
if (runsPayload.items?.[0]?.status !== 'running') { console.error('FAIL: live run status', runsPayload.items?.[0]); process.exit(1) }
// Live progress annotation: the panel needs counts and a "parked on a question"
// flag, otherwise a waiting run looks identical to a working one.
const liveRun = runsPayload.items[0]
if (liveRun.steps !== 2 || liveRun.toolCalls !== 1) {
  console.error('FAIL: run progress annotation', { steps: liveRun.steps, toolCalls: liveRun.toolCalls })
  process.exit(1)
}
if (liveRun.waiting !== false) { console.error('FAIL: waiting flag set for a working run', liveRun.waiting); process.exit(1) }
if (liveRun.activityAt !== 1793945006000) { console.error('FAIL: activityAt not derived from session events', liveRun.activityAt); process.exit(1) }

sessionWaiting = true
const runsWaitingRes = response()
await runsRoute.handler(getReq(runsRoute.path), runsWaitingRes)
const waitingRun = JSON.parse(runsWaitingRes.body).items?.[0]
if (waitingRun?.waiting !== true || waitingRun?.steps !== 1) {
  console.error('FAIL: waiting annotation', waitingRun)
  process.exit(1)
}
sessionWaiting = false

sessionRunning = false
const runsDoneRes = response()
await runsRoute.handler(getReq(runsRoute.path), runsDoneRes)
const runsDone = JSON.parse(runsDoneRes.body)
const doneRun = runsDone.items.find(item => item.runId === run.runId)
if (doneRun?.status !== 'done' || !String(doneRun.reply || '').includes('完成：测试回复。')) {
  console.error('FAIL: finished run status/reply', doneRun)
  process.exit(1)
}

const wbRunsTool = registered.find(r => r.regType === 'tool' && r.name === 'wb_runs')
const wbRunsResult = await wbRunsTool.execute({})
if (!wbRunsResult?.text?.includes(run.runId)) { console.error('FAIL: wb_runs tool output', wbRunsResult); process.exit(1) }

const cancelRes = response()
await runsCancelRoute.handler(postReq(runsCancelRoute.path, { runId: run.runId }), cancelRes)
if (cancelRes.statusCode !== 200 || JSON.parse(cancelRes.body).run?.status !== 'cancelled') {
  console.error('FAIL: cancel result', cancelRes.statusCode, cancelRes.body)
  process.exit(1)
}
if (dispatchCalls.cancel.length !== 1) { console.error('FAIL: controller.cancel not called'); process.exit(1) }

const dispatchGetRes = response()
await dispatchRoute.handler(getReq(dispatchRoute.path), dispatchGetRes)
if (dispatchGetRes.statusCode !== 405) { console.error('FAIL: dispatch accepted GET', dispatchGetRes.statusCode); process.exit(1) }

const emptyGoalRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, { goal: '' }), emptyGoalRes)
if (emptyGoalRes.statusCode !== 400) { console.error('FAIL: empty goal accepted', emptyGoalRes.statusCode); process.exit(1) }

requestRejection = 401
const untrustedDispatch = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, { goal: 'x' }), untrustedDispatch)
if (untrustedDispatch.statusCode !== 401) { console.error('FAIL: untrusted dispatch accepted', untrustedDispatch.statusCode); process.exit(1) }
requestRejection = null

const remoteDispatch = response()
await dispatchRoute.handler({ ...postReq(dispatchRoute.path, { goal: 'x' }), headers: { host: '10.0.0.9:55293' } }, remoteDispatch)
if (remoteDispatch.statusCode !== 403) { console.error('FAIL: non-loopback dispatch accepted', remoteDispatch.statusCode); process.exit(1) }

const auditDispatchRes = response()
await auditRoute.handler(getReq(auditRoute.path + '?limit=20'), auditDispatchRes)
const dispatchAudit = JSON.parse(auditDispatchRes.body)
const dispatchActions = dispatchAudit.entries.map(entry => entry.action)
if (!dispatchActions.includes('dispatch.start') || !dispatchActions.includes('dispatch.cancel') || !dispatchActions.includes('dispatch.done')) {
  console.error('FAIL: dispatch audit missing', dispatchActions)
  process.exit(1)
}
// The terminal entry must be answerable to the run's start: same requestId.
const doneEntry = dispatchAudit.entries.find(entry => entry.action === 'dispatch.done')
if (!doneEntry || doneEntry.requestId !== run.runId) {
  console.error('FAIL: dispatch.done not linked to run', doneEntry)
  process.exit(1)
}

// A terminal run must never read as "waiting", even when its session events still
// end on ask_user_question in the Host's cache.
sessionWaiting = true
const doneWaitingRes = response()
await runsRoute.handler(getReq(runsRoute.path), doneWaitingRes)
const doneWaiting = JSON.parse(doneWaitingRes.body).items.find(item => item.runId === run.runId)
if (!['done', 'cancelled', 'error'].includes(doneWaiting?.status) || doneWaiting?.waiting !== false) {
  console.error('FAIL: terminal run picked up the waiting flag', doneWaiting)
  process.exit(1)
}
sessionWaiting = false

// Cancelling a run that is parked on a question must clear the waiting flag
// instead of leaving "cancelled" and "waiting for your answer" on the same card.
const runsFile = join(tempWorkspace, 'runs.json')
const storedRuns = JSON.parse(readFileSync(runsFile, 'utf8'))
storedRuns.items.push({
  runId: 'run_waiting_fixture',
  sessionId: 'sess-harness-waiting',
  goal: '停在提问上的运行',
  model: 'deepseek-official/deepseek-flash',
  status: 'running',
  waiting: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  cwd: tempWorkspace,
})
writeFileSync(runsFile, JSON.stringify(storedRuns, null, 2), 'utf8')
const cancelWaitingRes = response()
await runsCancelRoute.handler(postReq(runsCancelRoute.path, { runId: 'run_waiting_fixture' }), cancelWaitingRes)
const cancelledWaiting = JSON.parse(cancelWaitingRes.body).run
if (cancelledWaiting?.status !== 'cancelled' || cancelledWaiting?.waiting !== false) {
  console.error('FAIL: cancel left the waiting flag set', cancelledWaiting)
  process.exit(1)
}

// --- v0.6: session targeting, module library, derived report ----------------
const fail = message => { console.error('FAIL:', message); process.exit(1) }

const sessionsRes = response()
await sessionsRoute.handler(getReq(sessionsRoute.path), sessionsRes)
if (sessionsRes.statusCode !== 200) fail('sessions status ' + sessionsRes.statusCode)
const sessionsPayload = JSON.parse(sessionsRes.body)
if (sessionsPayload.ok !== true || sessionsPayload.available !== true) fail('sessions payload ' + sessionsRes.body)
const titledSession = sessionsPayload.items.find(item => item.sessionId === 'sess-titled')
if (!titledSession) fail('titled session missing from list')
if (titledSession.title !== '已有的会话标题') fail('session title not read from session/title events: ' + JSON.stringify(titledSession))
if (typeof titledSession.running !== 'boolean' || typeof titledSession.updatedAt !== 'number') fail('session flags not normalized')

// Dispatching with an explicit sessionId must reuse that session and skip create.
const createCountBefore = dispatchCalls.create.length
const existingRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, {
  goal: '指定会话派发',
  model: 'deepseek-official/deepseek-flash',
  sessionId: 'sess-titled',
}), existingRes)
if (existingRes.statusCode !== 200) fail('existing-session dispatch status ' + existingRes.body)
const existingRun = JSON.parse(existingRes.body).run
if (existingRun.sessionId !== 'sess-titled') fail('run did not target the given session: ' + existingRun.sessionId)
if (existingRun.sessionMode !== 'existing') fail('sessionMode should be existing, got ' + existingRun.sessionMode)
if (dispatchCalls.create.length !== createCountBefore) fail('created a session despite an explicit target')
if (dispatchCalls.prompt.at(-1)?.sessionId !== 'sess-titled') fail('prompt did not target the given session')

// Module library: save / list / upsert / remove, all audited and guarded.
const saveRes = response()
await modulesRoute.handler(postReq(modulesRoute.path, {
  kind: 'goal', title: '统计行数', text: '统计 _workbench 下 md 行数并给出 top3',
}), saveRes)
if (saveRes.statusCode !== 200) fail('module save status ' + saveRes.body)
const savedModule = JSON.parse(saveRes.body)
if (!savedModule.module?.id || savedModule.module.uses !== 0) fail('saved module shape ' + saveRes.body)
if (savedModule.items.length !== 1) fail('module list should hold one item')

const modulesListRes = response()
await modulesRoute.handler(getReq(modulesRoute.path), modulesListRes)
const modulesListed = JSON.parse(modulesListRes.body)
if (!Array.isArray(modulesListed.items) || modulesListed.items.length !== 1) fail('module list GET ' + modulesListRes.body)
const moduleId = savedModule.module.id

const saveAgainRes = response()
await modulesRoute.handler(postReq(modulesRoute.path, {
  kind: 'goal', title: '统计行数', text: '统计 _workbench 下 md 行数并给出 top5',
}), saveAgainRes)
const savedAgain = JSON.parse(saveAgainRes.body)
if (savedAgain.items.length !== 1) fail('same kind+title duplicated instead of updating')
if (savedAgain.module.id !== moduleId) fail('upsert changed the module id')
if (!savedAgain.module.text.includes('top5')) fail('upsert did not update the text')

const badKindRes = response()
await modulesRoute.handler(postReq(modulesRoute.path, { kind: 'other', title: 'x', text: 'y' }), badKindRes)
if (badKindRes.statusCode !== 400) fail('invalid module kind accepted: ' + badKindRes.statusCode)
const noTitleRes = response()
await modulesRoute.handler(postReq(modulesRoute.path, { kind: 'goal', title: '', text: 'y' }), noTitleRes)
if (noTitleRes.statusCode !== 400) fail('empty module title accepted')
const bigModuleRes = response()
await modulesRoute.handler(postReq(modulesRoute.path, { kind: 'goal', title: 'big', text: 'x'.repeat(70 * 1024) }), bigModuleRes)
if (bigModuleRes.statusCode !== 413) fail('oversized module body accepted')
const moduleMethodRes = response()
await modulesRoute.handler({ ...getReq(modulesRoute.path), method: 'PUT' }, moduleMethodRes)
if (moduleMethodRes.statusCode !== 405) fail('modules route accepted PUT')

// A dispatch that names modules bumps their use counter: that is the raw data
// the future canvas needs to rank reusable pieces.
const useRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, {
  goal: '用了模块的派发', moduleIds: [moduleId], model: 'deepseek-official/deepseek-flash',
}), useRes)
if (useRes.statusCode !== 200) fail('module-using dispatch failed ' + useRes.body)
const modulesAfterUse = JSON.parse(readFileSync(join(tempWorkspace, 'modules.json'), 'utf8'))
if (modulesAfterUse.items[0].uses !== 1) fail('module use counter not bumped: ' + JSON.stringify(modulesAfterUse.items[0]))

const removeRes = response()
await modulesRoute.handler(postReq(modulesRoute.path, { id: moduleId, remove: true }), removeRes)
if (removeRes.statusCode !== 200) fail('module remove status ' + removeRes.body)
if (JSON.parse(removeRes.body).items.length !== 0) fail('module not removed')
const missingRemoveRes = response()
await modulesRoute.handler(postReq(modulesRoute.path, { id: 'mod_missing', remove: true }), missingRemoveRes)
if (missingRemoveRes.statusCode !== 404) fail('removing an absent module should be 404')

// ---- v0.7: templates ------------------------------------------------------
// A template is the recipe (slots + module ids + default session target). It is
// what makes reuse cheaper than retyping, so it has to survive a round trip and
// actually drive a dispatch.
const tplRes = response()
await templatesRoute.handler(postReq(templatesRoute.path, {
  title: '行数巡检', goal: '统计 _workbench 下 md 行数Top3', plan: '1.扫描 2.统计 3.排序',
  instruction: '只读，不改文件', moduleIds: ['mod_a', 'mod_c'],
  model: 'deepseek-official/deepseek-flash', sessionMode: 'new',
}), tplRes)
if (tplRes.statusCode !== 200) fail('template save status ' + tplRes.body)
const savedTpl = JSON.parse(tplRes.body)
const templateId = savedTpl.template.id
if (!templateId || !templateId.startsWith('tpl_')) fail('template id missing: ' + tplRes.body)
if (savedTpl.template.moduleIds.length !== 2) fail('template did not keep its module ids')

const tplListRes = response()
await templatesRoute.handler(getReq(templatesRoute.path), tplListRes)
const tplListed = JSON.parse(tplListRes.body)
if (!Array.isArray(tplListed.items) || tplListed.items.length !== 1) fail('template list GET ' + tplListRes.body)
if (tplListed.items[0].goal !== '统计 _workbench 下 md 行数Top3') fail('template goal lost on read')

const tplUpsertRes = response()
await templatesRoute.handler(postReq(templatesRoute.path, {
  title: '行数巡检', goal: '统计 md 行数Top5', plan: '', instruction: '', moduleIds: ['mod_a', 'mod_b'], sessionMode: 'any',
}), tplUpsertRes)
const tplUpserted = JSON.parse(tplUpsertRes.body)
if (tplUpserted.items.length !== 1) fail('same-title template duplicated instead of updating')
if (tplUpserted.template.id !== templateId) fail('template upsert changed the id')
if (!tplUpserted.template.goal.includes('Top5')) fail('template upsert did not update the goal')

const tplGuards = [
  [{ title: '', goal: 'x', model: '', sessionMode: 'any' }, 400, 'empty template title'],
  [{ title: 'x', goal: '', model: '', sessionMode: 'any' }, 400, 'template without goal'],
  [{ title: 'x', goal: 'y', sessionMode: 'weird' }, 400, 'invalid sessionMode'],
  [{ title: 'x', goal: 'y', moduleIds: 'nope' }, 400, 'non-array moduleIds'],
]
for (const [payload, expected, label] of tplGuards) {
  const res = response()
  await templatesRoute.handler(postReq(templatesRoute.path, payload), res)
  if (res.statusCode !== expected) fail(label + ' got ' + res.statusCode + ' ' + res.body)
}
const tplMethodRes = response()
await templatesRoute.handler({ ...getReq(templatesRoute.path), method: 'PUT' }, tplMethodRes)
if (tplMethodRes.statusCode !== 405) fail('templates route accepted PUT')
const tplMissingRemove = response()
await templatesRoute.handler(postReq(templatesRoute.path, { id: 'tpl_missing', remove: true }), tplMissingRemove)
if (tplMissingRemove.statusCode !== 404) fail('removing an absent template should be 404')

// A template-driven dispatch must land its identity on the run, inherit the
// template's module ids when the caller sent none, and bump the template counter.
const tplDispatchRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, {
  goal: '统计 md 行数Top3', templateId, model: 'deepseek-official/deepseek-flash',
}), tplDispatchRes)
if (tplDispatchRes.statusCode !== 200) fail('template dispatch failed ' + tplDispatchRes.body)
const tplDispatch = JSON.parse(tplDispatchRes.body)
if (tplDispatch.run.templateId !== templateId) fail('run did not record templateId: ' + tplDispatchRes.body)
if (tplDispatch.run.templateTitle !== '行数巡检') fail('run did not snapshot templateTitle')
const tplAfterUse = JSON.parse(readFileSync(join(tempWorkspace, 'templates.json'), 'utf8')).items[0]
if (tplAfterUse.uses !== 1) fail('template use counter not bumped: ' + JSON.stringify(tplAfterUse))
if (tplAfterUse.moduleIds.length !== 2) fail('template module ids were not inherited by the dispatch')

// A stale template id must not block the work: dispatch succeeds, run has no
// template, and the response says the template was missing.
const staleRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, {
  goal: '模板没了也要能派发', templateId: 'tpl_gone', model: 'deepseek-official/deepseek-flash',
}), staleRes)
if (staleRes.statusCode !== 200) fail('stale template id blocked the dispatch: ' + staleRes.body)
const stale = JSON.parse(staleRes.body)
if (stale.templateMissing !== true) fail('stale template id was not reported')
if (stale.run.templateId) fail('stale template id leaked onto the run')

const tplDryRunRes = response()
await dispatchRoute.handler(postReq(dispatchRoute.path, {
  goal: '预览模板', templateId, dryRun: true, model: 'deepseek-official/deepseek-flash',
}), tplDryRunRes)
const tplDryRun = JSON.parse(tplDryRunRes.body)
if (!tplDryRun.dryRun) fail('template dry run did not preview')
if (!tplDryRun.templateId) fail('template dry run did not echo the template id')
if (tplDryRun.templateModuleIds.length !== 2) fail('template dry run did not resolve the module ids')

// Deleting is audited and does not touch history: runs keep their snapshot.
const tplRemoveRes = response()
await templatesRoute.handler(postReq(templatesRoute.path, { id: templateId, remove: true }), tplRemoveRes)
if (tplRemoveRes.statusCode !== 200) fail('template remove status ' + tplRemoveRes.body)
if (JSON.parse(tplRemoveRes.body).items.length !== 0) fail('template not removed')
const runsAfterTplRemove = JSON.parse(readFileSync(join(tempWorkspace, 'runs.json'), 'utf8')).items
const tplRun = runsAfterTplRemove.find(item => item.runId === tplDispatch.run.runId)
if (!tplRun || tplRun.templateTitle !== '行数巡检') fail('deleting a template erased its run snapshot')

// The report is the panel's payload: it must be a digest, never the raw text.
const reportRes = response()
await reportRoute.handler(getReq(reportRoute.path + '?runId=' + encodeURIComponent(run.runId)), reportRes)
if (reportRes.statusCode !== 200) fail('report status ' + reportRes.body)
const report = JSON.parse(reportRes.body)
if (report.ok !== true || report.derived !== true) fail('report must be marked as a derived summary')
if (report.conclusion !== '完成：测试回复。') fail('conclusion is not the first paragraph: ' + JSON.stringify(report.conclusion))
if (!Array.isArray(report.points) || report.points.length !== 2) fail('points not extracted: ' + JSON.stringify(report.points))
if (!report.points.includes('结论二')) fail('points content wrong: ' + JSON.stringify(report.points))
if (!report.pending.some(item => item.includes('需要确认'))) fail('pending question not extracted: ' + JSON.stringify(report.pending))
if (!report.artifacts.some(item => item.path === 'D:/workbench/out/result.md' && item.tool === 'ops_bash')) {
  fail('artifact path not extracted from tool/call: ' + JSON.stringify(report.artifacts))
}
if (report.artifacts.length !== 1) fail('artifact list not deduplicated: ' + JSON.stringify(report.artifacts))
if (!String(report.reply).includes('需要确认：是否继续？')) fail('raw reply not carried for the disclosure')
if (report.stats.toolCalls !== 1 || report.stats.steps !== 2) fail('report stats wrong: ' + JSON.stringify(report.stats))
if (report.run.goal !== '闭环测试：派发一次真实任务') fail('report run identity wrong: ' + report.run.goal)

// A run that has not finished yet says so instead of inventing a conclusion.
const liveReportRes = response()
await reportRoute.handler(getReq(reportRoute.path + '?runId=' + encodeURIComponent(existingRun.runId)), liveReportRes)
const liveReport = JSON.parse(liveReportRes.body)
if (!String(liveReport.conclusion).includes('运行中')) fail('live run report should admit it has no conclusion: ' + liveReport.conclusion)

// The default report is the most recent run, and an unknown id is a real 404.
const latestReportRes = response()
await reportRoute.handler(getReq(reportRoute.path), latestReportRes)
const latestReport = JSON.parse(latestReportRes.body)
const storedIds = JSON.parse(readFileSync(join(tempWorkspace, 'runs.json'), 'utf8')).items.map(item => item.runId)
if (latestReport.ok !== true || !storedIds.includes(latestReport.run?.runId)) {
  fail('default report did not resolve to a stored run: ' + latestReportRes.body)
}
const missingReportRes = response()
await reportRoute.handler(getReq(reportRoute.path + '?runId=run_missing'), missingReportRes)
if (missingReportRes.statusCode !== 404) fail('unknown runId should be 404, got ' + missingReportRes.statusCode)

// A run whose session this Host no longer lists must not stay "running" as a
// lie: it is flagged, and archiving closes it locally (no fake cancellation).
const runsPath = join(tempWorkspace, 'runs.json')
const storedForGhost = JSON.parse(readFileSync(runsPath, 'utf8'))
storedForGhost.items.unshift({
  runId: 'run_ghost', sessionId: 'session-ghost', goal: '重启前派发的任务',
  model: 'deepseek-official/deepseek-flash', status: 'running', cwd: tempWorkspace,
  createdAt: Date.now() - 3600000, updatedAt: Date.now() - 3600000,
})
writeFileSync(runsPath, JSON.stringify(storedForGhost, null, 2))
const ghostListRes = response()
await runsRoute.handler(getReq(runsRoute.path), ghostListRes)
const ghostRun = JSON.parse(ghostListRes.body).items.find(item => item.runId === 'run_ghost')
if (!ghostRun) fail('ghost run disappeared from runs.json')
if (ghostRun.orphaned !== true) fail('untracked running run not flagged as orphaned: ' + JSON.stringify(ghostRun))
if (ghostRun.status !== 'running') fail('orphaned run should keep its recorded status until archived')

const ghostReportRes = response()
await reportRoute.handler(getReq(reportRoute.path + '?runId=run_ghost'), ghostReportRes)
const ghostReport = JSON.parse(ghostReportRes.body)
if (!Array.isArray(ghostReport.pending)) fail('report should stay printable for an orphaned run')

const archiveRes = response()
await runsCancelRoute.handler(postReq(runsCancelRoute.path, { runId: 'run_ghost', archive: true }), archiveRes)
if (archiveRes.statusCode !== 200) fail('archive status ' + archiveRes.body)
const archived = JSON.parse(archiveRes.body).run
if (archived.status !== 'cancelled' || archived.orphaned !== false || !archived.archivedAt) {
  fail('archive did not close the run locally: ' + JSON.stringify(archived))
}
const promptCountBeforeArchive = dispatchCalls.prompt.length
if (dispatchCalls.prompt.length !== promptCountBeforeArchive) fail('archive must not touch the session')

// The real cancel path is unchanged: when the session itself refuses, the route
// reports 409 instead of pretending the run was cancelled.
failCancel = true
const brokenCancelRes = response()
await runsCancelRoute.handler(postReq(runsCancelRoute.path, { runId: 'run_ghost' }), brokenCancelRes)
failCancel = false
if (brokenCancelRes.statusCode !== 409) {
  fail('failed cancellation should be 409, got ' + brokenCancelRes.statusCode + ' ' + brokenCancelRes.body)
}

const auditV6Res = response()
await auditRoute.handler(getReq(auditRoute.path + '?limit=30'), auditV6Res)
const auditV6Actions = JSON.parse(auditV6Res.body).entries.map(entry => entry.action)
for (const action of ['module.save', 'module.remove', 'template.save', 'template.remove', 'dispatch.archive']) {
  if (!auditV6Actions.includes(action)) fail('audit missing ' + action)
}

console.log('sessions:', sessionsPayload.items.length, '| titled ok | existing-session dispatch ok')
console.log('modules: save/upsert/list/remove ok | use counter ok')
console.log('report: conclusion ok, points', report.points.length, ', artifacts', report.artifacts.length, ', pending', report.pending.length)
console.log('v0.6 guards: 400/404/405/413 enforced')
console.log('templates: save/upsert/list/remove ok | dispatch inherits modules, uses+1 | stale id → templateMissing')

console.log('dispatch:', run.runId, '| session:', run.sessionId, '| dry-run ok | disabled gate ok | cancel ok')
console.log('dispatch guards: 405/400/401/403 enforced')
console.log('audit actions:', dispatchActions.slice(0, 6).join(', '))

// --- v1.0 flow: channel rule, sync route, live view, close-out write --------
const channelRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/channel')
const syncRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/sync')
const liveRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/live')
const closeRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/close')
if (!channelRoute || !syncRoute || !liveRoute || !closeRoute) fail('v1.0 flow routes missing')

const shortRes = response()
await channelRoute.handler(postReq(channelRoute.path, { text: '把刚写的模块标题改一下' }), shortRes)
if (shortRes.statusCode !== 200) fail('channel status ' + shortRes.statusCode + ' ' + shortRes.body)
const shortDecision = JSON.parse(shortRes.body)
if (shortDecision.channel !== 'sync' || shortDecision.maxMinutes !== 2) fail('short work must be sync: ' + shortRes.body)

const genRes = response()
await channelRoute.handler(postReq(channelRoute.path, { text: '帮我生一张封面图' }), genRes)
const genDecision = JSON.parse(genRes.body)
if (genDecision.channel !== 'async' || !genDecision.reasons.some(reason => reason.includes('外部生成'))) {
  fail('generation must be async: ' + genRes.body)
}

const minutesRes = response()
await channelRoute.handler(postReq(channelRoute.path, { text: '整理一下', minutes: 9 }), minutesRes)
if (JSON.parse(minutesRes.body).channel !== 'async') fail('9 minutes must be async')

const leavingRes = response()
await channelRoute.handler(postReq(channelRoute.path, { text: '先做一步', leaving: true }), leavingRes)
if (JSON.parse(leavingRes.body).channel !== 'async') fail('leaving must be async')

const noSessionRes = response()
await syncRoute.handler(postReq(syncRoute.path, { text: '改个标题' }), noSessionRes)
if (noSessionRes.statusCode !== 400) fail('sync accepted no sessionId')

sessionRunning = true
const asyncRefusedRes = response()
await syncRoute.handler(postReq(syncRoute.path, { sessionId: createdSessionId, text: '帮我生一段视频' }), asyncRefusedRes)
if (asyncRefusedRes.statusCode !== 409 || JSON.parse(asyncRefusedRes.body).code !== 'channel-async') {
  fail('sync route did not enforce the channel rule: ' + asyncRefusedRes.statusCode + ' ' + asyncRefusedRes.body)
}

const promptsBefore = dispatchCalls.prompt.length
const syncOkRes = response()
await syncRoute.handler(postReq(syncRoute.path, { sessionId: createdSessionId, text: '把那段话改短一点' }), syncOkRes)
if (syncOkRes.statusCode !== 200) fail('sync status ' + syncOkRes.statusCode + ' ' + syncOkRes.body)
const syncResult = JSON.parse(syncOkRes.body)
const lastSyncPrompt = dispatchCalls.prompt[dispatchCalls.prompt.length - 1]
if (dispatchCalls.prompt.length !== promptsBefore + 1) fail('sync did not prompt')
if (lastSyncPrompt.sessionId !== createdSessionId || lastSyncPrompt.mode !== 'queue') {
  fail('sync did not queue into the current session: ' + JSON.stringify(lastSyncPrompt))
}
if (!String(lastSyncPrompt.content?.[0]?.text || '').includes('把那段话改短一点')) fail('sync prompt text missing')
if (syncResult.channel !== 'sync' || !syncResult.requestId) fail('sync result ' + syncOkRes.body)

const ghostRes = response()
await syncRoute.handler(postReq(syncRoute.path, { sessionId: 'sess-does-not-exist', text: '改个标题' }), ghostRes)
if (ghostRes.statusCode !== 404) fail('sync accepted an unknown session')

const liveRes = response()
await liveRoute.handler(getReq(liveRoute.path + '?sessionId=' + createdSessionId), liveRes)
if (liveRes.statusCode !== 200) fail('live status ' + liveRes.statusCode + ' ' + liveRes.body)
const live = JSON.parse(liveRes.body)
if (live.sessionId !== createdSessionId || live.running !== true) fail('live payload ' + liveRes.body)
if (live.steps < 1 || live.toolCalls < 1 || !live.lastText.includes('完成')) fail('live progress ' + liveRes.body)
const liveNoSession = response()
await liveRoute.handler(getReq(liveRoute.path), liveNoSession)
if (liveNoSession.statusCode !== 400) fail('live accepted no sessionId')
sessionRunning = false
const liveIdleRes = response()
await liveRoute.handler(getReq(liveRoute.path + '?sessionId=' + createdSessionId), liveIdleRes)
if (JSON.parse(liveIdleRes.body).running !== false) fail('live reported running after the session settled')

const closeEmptyRes = response()
await closeRoute.handler(postReq(closeRoute.path, { next: [] }), closeEmptyRes)
if (closeEmptyRes.statusCode !== 400) fail('close accepted an empty next step')
const closeColourRes = response()
await closeRoute.handler(postReq(closeRoute.path, { next: '下一步', outcome: 'blue' }), closeColourRes)
if (closeColourRes.statusCode !== 400) fail('close accepted a bad outcome colour')
const closeOkRes = response()
await closeRoute.handler(postReq(closeRoute.path, {
  next: '重启后按清单验收',
  outcome: 'yellow',
  title: '面板收工走这一条',
  decision: '背景：面板收工要一次写完。决定：/api/close 与 wb_close 共用一条写入路径。',
  runId: 'run_close_route_1',
}), closeOkRes)
if (closeOkRes.statusCode !== 200) fail('close status ' + closeOkRes.statusCode + ' ' + closeOkRes.body)
const closedPayload = JSON.parse(closeOkRes.body)
if (!closedPayload.closedAt || closedPayload.outcome !== 'yellow') fail('close payload ' + closeOkRes.body)
if (closedPayload.gap?.open !== false) fail('close left the gap open: ' + closeOkRes.body)
const closedRecord = JSON.parse(readFileSync(memoryFile, 'utf8'))
if (closedRecord.outcome !== 'yellow' || closedRecord.basis.runId !== 'run_close_route_1') {
  fail('close did not write the record: ' + closedRecord.outcome + ' ' + JSON.stringify(closedRecord.basis))
}
if (closedRecord.decisions[closedRecord.decisions.length - 1].title !== '面板收工走这一条') {
  fail('close decision title ' + JSON.stringify(closedRecord.decisions[closedRecord.decisions.length - 1]))
}
const closedAgents = readFileSync(join(tempWorkspace, 'AGENTS.md'), 'utf8')
if (!closedAgents.includes('重启后按清单验收')) fail('close did not regenerate the injected block')
console.log('flow: short→sync, generation→async, minutes→async, leaving→async | sync queues into the current session | live running/idle | close writes one record')

// --- v1.0 node graph: typed ports, refused edges, real artifacts ------------
const flowRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/flow')
const nodeRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/flow/node')
const nodeDeleteRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/flow/node/delete')
const edgeRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/flow/edge')
const edgeDeleteRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/flow/edge/delete')
const runRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/flow/run')
const verifyRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/flow/verify')
if (!flowRoute || !nodeRoute || !nodeDeleteRoute || !edgeRoute || !edgeDeleteRoute || !runRoute || !verifyRoute) {
  fail('node graph routes missing')
}

const emptyFlowRes = response()
await flowRoute.handler(getReq(flowRoute.path), emptyFlowRes)
if (emptyFlowRes.statusCode !== 200) fail('flow read status ' + emptyFlowRes.statusCode + ' ' + emptyFlowRes.body)
const emptyFlow = JSON.parse(emptyFlowRes.body)
if (emptyFlow.nodes.length !== 0 || emptyFlow.edges.length !== 0) fail('a fresh graph must be empty')
if (!emptyFlow.executors.some(item => item.kind === 'text' && item.available === true)) fail('text executor not registered')
if (!emptyFlow.executors.some(item => item.kind === 'image' && item.available === false)) fail('image executor should be unregistered (gray)')

// node A: the material, produced locally and verified by matching text
const makeNode = async payload => {
  const res = response()
  await nodeRoute.handler(postReq(nodeRoute.path, payload), res)
  return { res, payload: res.statusCode === 200 ? JSON.parse(res.body) : null }
}

const sourceMade = await makeNode({
  title: '资料',
  kind: 'source',
  inputs: [],
  outputs: [{ name: 'text', type: 'text' }],
  executor: { kind: 'text', params: { content: '资料：画布必须先有类型，再有执行。' } },
  verifier: { kind: 'file-contains', path: '', contains: '画布必须先有类型' },
})
if (!sourceMade.payload) fail('source node rejected: ' + sourceMade.res.body)
const sourceNode = sourceMade.payload.nodes.find(node => node.title === '资料')
if (!sourceNode || sourceNode.runtime.available !== true) fail('source node not runnable')

// node B: the text, consuming A's output through a typed port
const textMade = await makeNode({
  title: '文本',
  kind: 'sink',
  inputs: [{ name: 'input', type: 'text' }],
  outputs: [{ name: 'doc', type: 'file' }],
  executor: { kind: 'text', params: { template: '# 定稿\n{{input}}\n\n收束：先类型后执行。' } },
  verifier: { kind: 'file-contains', path: '', contains: '收束：先类型后执行' },
})
if (!textMade.payload) fail('text node rejected: ' + textMade.res.body)
const textNode = textMade.payload.nodes.find(node => node.title === '文本')
if (!textNode) fail('text node not saved')

const illegalEdges = [
  [{ fromNode: textNode.id, fromPort: 'doc', toNode: sourceNode.id, toPort: 'text' }, 'file→text'],
  [{ fromNode: sourceNode.id, fromPort: 'nope', toNode: textNode.id, toPort: 'input' }, 'unknown port'],
  [{ fromNode: sourceNode.id, fromPort: 'text', toNode: sourceNode.id, toPort: 'text' }, 'self loop'],
  [{ fromNode: sourceNode.id, fromPort: 'text', toNode: 'n_missing', toPort: 'input' }, 'unknown node'],
]
for (const [payload, label] of illegalEdges) {
  const res = response()
  await edgeRoute.handler(postReq(edgeRoute.path, payload), res)
  if (res.statusCode !== 409 || JSON.parse(res.body).code !== 'edge-rejected') {
    fail('illegal edge accepted (' + label + '): ' + res.statusCode + ' ' + res.body)
  }
}

const noConfirmRes = response()
await runRoute.handler(postReq(runRoute.path, {}), noConfirmRes)
if (noConfirmRes.statusCode !== 400) fail('flow ran without confirm:true')

const legalEdgeRes = response()
await edgeRoute.handler(postReq(edgeRoute.path, { fromNode: sourceNode.id, fromPort: 'text', toNode: textNode.id, toPort: 'input' }), legalEdgeRes)
if (legalEdgeRes.statusCode !== 200) fail('legal edge refused: ' + legalEdgeRes.statusCode + ' ' + legalEdgeRes.body)
const afterEdge = JSON.parse(legalEdgeRes.body)
if (afterEdge.edges.length !== 1 || afterEdge.validation.ok !== true) fail('legal edge not stored cleanly: ' + legalEdgeRes.body)

// a second edge into the same input is refused
const duplicateEdgeRes = response()
await edgeRoute.handler(postReq(edgeRoute.path, { fromNode: textNode.id, fromPort: 'doc', toNode: textNode.id, toPort: 'input' }), duplicateEdgeRes)
if (duplicateEdgeRes.statusCode !== 409) fail('double-bound input accepted')

// a cycle is refused: give the source node an input port, then point B at A
const sourceWithInput = await makeNode({
  id: sourceNode.id,
  inputs: [{ name: 'loop', type: 'file' }],
})
if (!sourceWithInput.payload) fail('source node update rejected: ' + sourceWithInput.res.body)
const cycleRes = response()
await edgeRoute.handler(postReq(edgeRoute.path, { fromNode: textNode.id, fromPort: 'doc', toNode: sourceNode.id, toPort: 'loop' }), cycleRes)
if (cycleRes.statusCode !== 409 || !JSON.parse(cycleRes.body).issues.some(issue => issue.code === 'cycle')) {
  fail('cycle accepted: ' + cycleRes.statusCode + ' ' + cycleRes.body)
}

const flowRunRes = response()
await runRoute.handler(postReq(runRoute.path, { confirm: true, requestId: 'harness-flow-run-1' }), flowRunRes)
if (flowRunRes.statusCode !== 200) fail('flow run status ' + flowRunRes.statusCode + ' ' + flowRunRes.body)
const flowRun = JSON.parse(flowRunRes.body)
const sourceResult = flowRun.results.find(item => item.nodeId === sourceNode.id)
const textResult = flowRun.results.find(item => item.nodeId === textNode.id)
if (sourceResult.status !== 'green' || !sourceResult.artifact) fail('source node did not go green: ' + JSON.stringify(sourceResult))
if (textResult.status !== 'green') fail('text node did not go green: ' + JSON.stringify(textResult))
if (!existsSync(sourceResult.artifact)) fail('source artifact missing on disk: ' + sourceResult.artifact)
const textArtifact = readFileSync(textResult.artifact, 'utf8')
if (!textArtifact.includes('画布必须先有类型') || !textArtifact.includes('收束：先类型后执行')) {
  fail('the text node did not consume the upstream artifact: ' + JSON.stringify(textArtifact.slice(0, 120)))
}

// a node with a verifier that cannot pass must be red, not green
const brokenMade = await makeNode({
  title: '会失败的一步',
  kind: 'check',
  inputs: [{ name: 'input', type: 'text' }],
  outputs: [{ name: 'doc', type: 'file' }],
  executor: { kind: 'text', params: { template: '这里没有那个词' } },
  verifier: { kind: 'file-contains', path: '', contains: '必须出现的词' },
})
if (!brokenMade.payload) fail('broken node rejected: ' + brokenMade.res.body)
const brokenNode = brokenMade.payload.nodes.find(node => node.title === '会失败的一步')
const brokenEdge = response()
await edgeRoute.handler(postReq(edgeRoute.path, { fromNode: sourceNode.id, fromPort: 'text', toNode: brokenNode.id, toPort: 'input' }), brokenEdge)
// that edge binds text→input again only for a different node, so it is legal
if (brokenEdge.statusCode !== 200) fail('edge to the check node refused: ' + brokenEdge.body)
const failedRunRes = response()
await runRoute.handler(postReq(runRoute.path, { confirm: true }), failedRunRes)
const failedRun = JSON.parse(failedRunRes.body)
const brokenResult = failedRun.results.find(item => item.nodeId === brokenNode.id)
if (brokenResult.status !== 'red') fail('a verifier that cannot pass must be red: ' + JSON.stringify(brokenResult))
if (failedRun.flow.nodes.find(node => node.id === brokenNode.id).runtime.status !== 'red') fail('red state not persisted')

// gray: a node whose executor is not registered can neither run nor go green
const imageMade = await makeNode({
  title: '封面图',
  kind: 'media',
  inputs: [{ name: 'prompt', type: 'text' }],
  outputs: [{ name: 'image', type: 'image' }],
  executor: { kind: 'image', params: {} },
  verifier: { kind: 'file-exists', path: 'cover.png' },
})
if (!imageMade.payload) fail('image node rejected: ' + imageMade.res.body)
const imageNode = imageMade.payload.nodes.find(node => node.title === '封面图')
if (imageNode.runtime.available !== false || imageNode.runtime.status !== 'gray') {
  fail('unregistered executor must render gray: ' + JSON.stringify(imageNode.runtime))
}
const grayRunRes = response()
await runRoute.handler(postReq(runRoute.path, { confirm: true }), grayRunRes)
const grayRun = JSON.parse(grayRunRes.body)
const imageResult = grayRun.results.find(item => item.nodeId === imageNode.id)
if (imageResult.status !== 'gray' || imageResult.artifact) fail('gray node produced something: ' + JSON.stringify(imageResult))
if (existsSync(join(tempRoot, 'flow-out', imageNode.id + '.md'))) fail('gray node wrote an artifact')

// verify re-checks disk: deleting the artifact turns green into red
const verifyRes = response()
await verifyRoute.handler(postReq(verifyRoute.path, {}), verifyRes)
if (verifyRes.statusCode !== 200) fail('verify status ' + verifyRes.statusCode + ' ' + verifyRes.body)
const verified = JSON.parse(verifyRes.body)
if (verified.results.find(item => item.nodeId === sourceNode.id).status !== 'green') fail('verify lost the green')
rmSync(sourceResult.artifact, { force: true })
const reverifyRes = response()
await verifyRoute.handler(postReq(verifyRoute.path, {}), reverifyRes)
const reverified = JSON.parse(reverifyRes.body)
if (reverified.results.find(item => item.nodeId === sourceNode.id).status !== 'red') {
  fail('a deleted artifact must turn the node red: ' + JSON.stringify(reverified.results))
}

const flowAuditRes = response()
await auditRoute.handler(getReq(auditRoute.path + '?limit=60'), flowAuditRes)
const flowActions = JSON.parse(flowAuditRes.body).entries.map(entry => entry.action)
for (const action of ['flow.node', 'flow.node.update', 'flow.edge', 'flow.run', 'flow.verify']) {
  if (!flowActions.includes(action)) fail('audit missing ' + action)
}
console.log('graph: typed ports + refused edges (type/port/self/node/cycle) | a two-node text flow writes real artifacts | verifier red on a missing word, red after the artifact is deleted | unregistered executor stays gray and writes nothing')

// --- v1.0 flywheel: three colours, promotion/demotion, cost, ranking --------
const flyRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/flywheel')
const outcomeRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/outcome')
if (!flyRoute || !outcomeRoute) fail('flywheel routes missing')

const flyTplRes = response()
await templatesRoute.handler(postReq(templatesRoute.path, {
  title: '飞轮候选', goal: '写一段周报摘要', plan: '', instruction: '',
  model: 'deepseek-official/deepseek-flash', sessionMode: 'new',
}), flyTplRes)
if (flyTplRes.statusCode !== 200) fail('flywheel template save ' + flyTplRes.body)
const flyTplId = JSON.parse(flyTplRes.body).template.id

const dispatchForFly = async label => {
  const res = response()
  await dispatchRoute.handler(postReq(dispatchRoute.path, { goal: label, templateId: flyTplId, model: 'deepseek-official/deepseek-flash' }), res)
  if (res.statusCode !== 200) fail('flywheel dispatch failed ' + res.body)
  return JSON.parse(res.body).run.runId
}
const recordColour = async (runId, colour, extra = {}) => {
  const res = response()
  await outcomeRoute.handler(postReq(outcomeRoute.path, { runId, colour, ...extra }), res)
  return res
}
const readFly = async () => {
  const res = response()
  await flyRoute.handler(getReq(flyRoute.path), res)
  if (res.statusCode !== 200) fail('flywheel read ' + res.statusCode + ' ' + res.body)
  return JSON.parse(res.body)
}

const r1 = await dispatchForFly('第一次绿')
const r2 = await dispatchForFly('第二次绿')
const greenA = await recordColour(r1, 'green', { tokens: { input: 1000, output: 200, cacheRead: 400, cacheWrite: 100 } })
if (greenA.statusCode !== 200) fail('green outcome rejected: ' + greenA.body)
if ((await recordColour(r2, 'green', { tokens: { input: 500, output: 100 } })).statusCode !== 200) fail('second green rejected')

let fly = await readFly()
let card = fly.cards.find(item => item.id === flyTplId)
if (!card) fail('template has no flywheel card')
if (card.promoted !== true || card.demoted !== false) fail('two greens and no red must promote: ' + JSON.stringify(card))
if (fly.candidates[0]?.id !== flyTplId) fail('the promoted card is not the first candidate: ' + JSON.stringify(fly.candidates))
if (!card.costKnown || card.costPerGreen.input !== 750 || card.costPerGreen.output !== 150 || card.costPerGreen.cacheRead !== 200 || card.costPerGreen.cacheWrite !== 50) {
  fail('per-green cost is wrong: ' + JSON.stringify(card.costPerGreen))
}

const redNoReason = await recordColour(r2, 'red')
if (redNoReason.statusCode !== 400) fail('a red without a reason was accepted')
const unknownRun = await recordColour('run_does_not_exist', 'green')
if (unknownRun.statusCode !== 404) fail('outcome accepted an unknown run')
const badColour = await recordColour(r2, 'blue', { reason: 'x' })
if (badColour.statusCode !== 400) fail('outcome accepted a colour outside green/yellow/red')

const r3 = await dispatchForFly('一次红')
const redOk = await recordColour(r3, 'red', { reason: '产物没落盘' })
if (redOk.statusCode !== 200) fail('red with a reason rejected: ' + redOk.body)
fly = await readFly()
card = fly.cards.find(item => item.id === flyTplId)
if (card.demoted !== true || card.promoted !== false) fail('one red must demote: ' + JSON.stringify(card))
if (fly.candidates.some(item => item.id === flyTplId)) fail('a demoted card is still recommended')

// promotion is earned back with two fresh greens, and then it must be reused
const r4 = await dispatchForFly('红后第一绿')
const r5 = await dispatchForFly('红后第二绿')
if ((await recordColour(r4, 'green')).statusCode !== 200) fail('recovery green 1 rejected')
if ((await recordColour(r5, 'green')).statusCode !== 200) fail('recovery green 2 rejected')
const r6 = await dispatchForFly('晋升后复用 1')
await dispatchForFly('晋升后复用 2')
fly = await readFly()
card = fly.cards.find(item => item.id === flyTplId)
if (card.promoted !== true) fail('two greens after a red must re-promote: ' + JSON.stringify(card))
if (card.reuseAfterPromotion < 2) fail('the exit condition (reused ≥2 after promotion) not met: ' + JSON.stringify(card))
if (!card.promotedAt) fail('promotion timestamp missing')
if (fly.candidates[0]?.reuseAfterPromotion < 2) fail('the recommended candidate does not show its reuse')

// one colour per run: re-recording replaces, it does not double count
const beforeDedupe = (await readFly()).totals.recorded
const againRes = await recordColour(r5, 'green')
if (againRes.statusCode !== 200) fail('re-recording a colour failed')
const afterDedupe = (await readFly()).totals.recorded
if (afterDedupe !== beforeDedupe) fail('recording the same run twice double counted: ' + beforeDedupe + ' → ' + afterDedupe)

// the close-out route is a second door into the same record
const closeRedNoReason = response()
await closeRoute.handler(postReq(closeRoute.path, { next: '继续', outcome: 'red' }), closeRedNoReason)
if (closeRedNoReason.statusCode !== 400) fail('close accepted a red without a reason')
const rClose = await dispatchForFly('收工时判绿')
const closeWithRun = response()
await closeRoute.handler(postReq(closeRoute.path, {
  next: '按推荐继续', outcome: 'green', title: '收工即记账', decision: '决定：收工三色直接进飞轮。', runId: rClose,
}), closeWithRun)
if (closeWithRun.statusCode !== 200) fail('close with a run failed: ' + closeWithRun.body)
const closePayload = JSON.parse(closeWithRun.body)
if (!closePayload.outcomeRecord || closePayload.outcomeRecord.colour !== 'green') fail('close did not record the colour: ' + closeWithRun.body)
const closedRun = JSON.parse(readFileSync(join(tempWorkspace, 'runs.json'), 'utf8')).items.find(item => item.runId === rClose)
if (closedRun?.outcome !== 'green') fail('close did not stamp the run outcome')
const flyAfterClose = await readFly()
const closeCard = flyAfterClose.cards.find(item => item.id === flyTplId)
if (closeCard.green < 4) fail('close-time green did not reach the flywheel: ' + JSON.stringify(closeCard))

// decay: an unused card is archived, never deleted
const templatesPath = join(tempWorkspace, 'templates.json')
const templatesOnDisk = JSON.parse(readFileSync(templatesPath, 'utf8'))
const flyTpl = templatesOnDisk.items.find(item => item.id === flyTplId)
flyTpl.lastUsedAt = Date.now() - 40 * 86400000
writeFileSync(templatesPath, JSON.stringify(templatesOnDisk, null, 2), 'utf8')
const decayed = await readFly()
const decayedCard = decayed.cards.find(item => item.id === flyTplId)
if (decayedCard.archived !== true) fail('a card unused for 40 days must be archived: ' + JSON.stringify(decayedCard))
if (decayed.candidates.some(item => item.id === flyTplId)) fail('an archived card is still recommended')
flyTpl.lastUsedAt = Date.now()
writeFileSync(templatesPath, JSON.stringify(templatesOnDisk, null, 2), 'utf8')
if (JSON.parse(readFileSync(templatesPath, 'utf8')).items.length !== templatesOnDisk.items.length) fail('decay test lost a template')

const flyMethodRes = response()
await flyRoute.handler({ ...getReq(flyRoute.path), method: 'POST' }, flyMethodRes)
if (flyMethodRes.statusCode !== 405) fail('flywheel route accepted POST')
const flyAuditRes = response()
await auditRoute.handler(getReq(auditRoute.path + '?limit=40'), flyAuditRes)
if (!JSON.parse(flyAuditRes.body).entries.some(entry => entry.action === 'outcome.record')) fail('audit missing outcome.record')
console.log('flywheel: 2 green promote, 1 red demotes, 2 fresh greens re-promote | per-green cost from tokens | one colour per run | close-time colour reaches the flywheel | 40 days idle archives | a promoted template is reused', card.reuseAfterPromotion, 'times')

rmSync(tempRoot, { recursive: true, force: true })
delete process.env.DSH_WORKBENCH_DIR
console.log('\nHOST HARNESS PASS')
