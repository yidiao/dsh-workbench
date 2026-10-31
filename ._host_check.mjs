// Headless harness for the HOST bundle (index.js).
// 1) Imports apply() with a mock ctx and verifies route + tools register without throwing.
// 2) Invokes the registered API handler against the REAL filesystem to prove the
//    relay-dir sibling resolution fix returns live ledger data.

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'

const here = new URL('.', import.meta.url)
const indexUrl = new URL('./index.js', here)
const tempRoot = mkdtempSync(join(tmpdir(), 'dsh-workbench-host-check-'))
const tempWorkspace = join(tempRoot, 'workspace')
mkdirSync(tempWorkspace, { recursive: true })
writeFileSync(join(tempWorkspace, 'primary.md'), 'Primary memory fixture.\n', 'utf8')
writeFileSync(join(tempWorkspace, 'secondary.md'), 'Secondary memory fixture.\n', 'utf8')
writeFileSync(join(tempWorkspace, 'workbench.config.json'), JSON.stringify({
  memory: { primary: ['primary.md'], secondary: ['secondary.md'], budgetTokens: 91 },
}), 'utf8')
process.env.DSH_WORKBENCH_DIR = tempWorkspace

const registered = []
let requestRejection = null
let streamCalls = 0
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
  get: (name) => name === 'llm' ? mockLlm : name === 'agentDefaultModel' ? mockDefaultModel : undefined,
}

const mod = await import(indexUrl)
await mod.apply(ctx)

const route = registered.find(r => r.regType === 'web' && r.path?.includes('api/state'))
const previewRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/preview')
const previewVersionRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/preview-v1')
const modelsRoute = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/models')
const toolNames = registered.filter(r => r.regType === 'tool').map(r => r.name)

console.log('registered count:', registered.length)
console.log('route path:', route?.path)
console.log('preview paths:', previewRoute?.path, previewVersionRoute?.path)
console.log('models path:', modelsRoute?.path)
console.log('tool names:', toolNames)

const ok =
  route && route.path === '/dsh-workbench/api/state-v2' &&
  previewRoute && previewVersionRoute && modelsRoute &&
  ['wb_get', 'wb_set', 'wb_close', 'wb_models'].every(n => toolNames.includes(n)) &&
  toolNames.length === 4
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
rmSync(tempRoot, { recursive: true, force: true })
delete process.env.DSH_WORKBENCH_DIR
console.log('\nHOST HARNESS PASS')
