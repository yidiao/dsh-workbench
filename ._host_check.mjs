// Headless harness for the HOST bundle (index.js).
// 1) Imports apply() with a mock ctx and verifies route + tools register without throwing.
// 2) Invokes the registered API handler against the REAL filesystem to prove the
//    relay-dir sibling resolution fix returns live ledger data.

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from 'node:fs'

const here = new URL('.', import.meta.url)
const indexUrl = new URL('./index.js', here)
const tempRoot = mkdtempSync(join(tmpdir(), 'dsh-workbench-host-check-'))
const tempWorkspace = join(tempRoot, 'workspace')
mkdirSync(tempWorkspace, { recursive: true })
writeFileSync(join(tempWorkspace, 'primary.md'), 'Primary memory fixture.\n', 'utf8')
writeFileSync(join(tempWorkspace, 'secondary.md'), 'Secondary memory fixture.\n', 'utf8')
writeFileSync(join(tempWorkspace, 'workbench.config.json'), JSON.stringify({
  memory: { primary: ['primary.md'], secondary: ['secondary.md'], budgetTokens: 91 },
  execution: { enabled: true, cwd: '.' },
}), 'utf8')
process.env.DSH_WORKBENCH_DIR = tempWorkspace

const registered = []
let requestRejection = null
let streamCalls = 0
let sessionRunning = true
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
  cancel: async (request) => { dispatchCalls.cancel.push(request); return { accepted: true } },
  list: async () => [{ sessionId: createdSessionId, agentAvailable: true, running: sessionRunning, blank: false, updatedAt: Date.now() }],
}
let sessionWaiting = false
const sessionEvents = [
  { type: 'turn/start', time: 1793945000000, data: {} },
  { type: 'step/start', time: 1793945001000, data: {} },
  { type: 'tool/call', time: 1793945002000, data: { name: 'ops_bash', callId: 'call-1' } },
  { type: 'tool/result', time: 1793945003000, data: { callId: 'call-1' } },
  { type: 'step/start', time: 1793945004000, data: {} },
  { type: 'assistant/message', time: 1793945005000, data: { message: { content: [{ type: 'text', text: '完成：测试回复。' }] } } },
  { type: 'turn/end', time: 1793945006000, data: { reason: { kind: 'end_turn' } } },
]
const waitingEvents = [
  { type: 'turn/start', time: 1793945000000, data: {} },
  { type: 'step/start', time: 1793945001000, data: {} },
  { type: 'tool/call', time: 1793945002000, data: { name: 'ask_user_question', callId: 'call-9' } },
]
const mockSessions = {
  get: (id) => id === createdSessionId ? {
    snapshotEvents: () => (sessionWaiting ? waitingEvents : sessionEvents),
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
const previewRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/preview')
const previewVersionRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/preview-v1')
const modelsRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/models')
const stateEditRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/state-edit')
const decisionRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/decision-add')
const auditRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/audit')
const dispatchRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/dispatch')
const runsRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/runs')
const runsCancelRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/runs/cancel')
const toolNames = registered.filter(r => r.regType === 'tool').map(r => r.name)

console.log('registered count:', registered.length)
console.log('route path:', route?.path)
console.log('preview paths:', previewRoute?.path, previewVersionRoute?.path)
console.log('models path:', modelsRoute?.path)
console.log('write paths:', stateEditRoute?.path, decisionRoute?.path, auditRoute?.path)
console.log('dispatch paths:', dispatchRoute?.path, runsRoute?.path, runsCancelRoute?.path)
console.log('tool names:', toolNames)

const ok =
  route && route.path === '/dsh-workbench/api/state-v2' &&
  previewRoute && previewVersionRoute && modelsRoute && stateEditRoute && decisionRoute && auditRoute &&
  dispatchRoute && runsRoute && runsCancelRoute &&
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
// Preview is loopback + trusted-connection guarded, GET-only, and must expose
// a disabled execution marker instead of attempting a model call.
const previewResponse = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
await previewRoute.handler({ method: 'GET', headers: { host: '127.0.0.1:55293' }, url: previewRoute.path }, previewResponse)
if (previewResponse.statusCode !== 200) { console.error('FAIL: preview status', previewResponse.statusCode); process.exit(1) }
const preview = JSON.parse(previewResponse.body)
if (preview.ok !== true || preview.mode !== 'preview' || preview.execution?.enabled !== false || !preview.memory?.fingerprint) {
  console.error('FAIL: preview payload', preview)
  process.exit(1)
}
if (preview.config?.budgetTokens !== 91 || preview.memory?.primary?.[0]?.source !== 'primary.md' || preview.memory?.secondary?.[0]?.source !== 'secondary.md') {
  console.error('FAIL: configured sources/budget not resolved', preview.config, preview.memory)
  process.exit(1)
}
if (!preview.memory.snippets.some(item => item.text.includes('Primary memory fixture')) || JSON.stringify(preview).includes(tempRoot)) {
  console.error('FAIL: preview content/path sanitization', preview.memory)
  process.exit(1)
}
const blockedResponse = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
await previewRoute.handler({ method: 'POST', headers: { host: '127.0.0.1:55293' }, url: previewRoute.path }, blockedResponse)
if (blockedResponse.statusCode !== 405) { console.error('FAIL: preview accepted non-GET', blockedResponse.statusCode); process.exit(1) }
console.log('preview.mode:', preview.mode)
console.log('preview.execution:', preview.execution.status)
console.log('preview.memory.fingerprint:', preview.memory.fingerprint)

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
const savedState = JSON.parse(readFileSync(join(tempWorkspace, 'state.json'), 'utf8'))
if (savedState.mainline !== '面板主线：闭环验证' || savedState.next.length !== 2) {
  console.error('FAIL: state.json not written', savedState)
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
if (!readFileSync(join(tempWorkspace, 'decisions.md'), 'utf8').includes('审计决策：面板写入路径已接通。')) {
  console.error('FAIL: decision not appended')
  process.exit(1)
}

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

console.log('dispatch:', run.runId, '| session:', run.sessionId, '| dry-run ok | disabled gate ok | cancel ok')
console.log('dispatch guards: 405/400/401/403 enforced')
console.log('audit actions:', dispatchActions.slice(0, 6).join(', '))

rmSync(tempRoot, { recursive: true, force: true })
delete process.env.DSH_WORKBENCH_DIR
console.log('\nHOST HARNESS PASS')
