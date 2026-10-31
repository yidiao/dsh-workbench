// Headless harness for the HOST bundle (index.js).
// 1) Imports apply() with a mock ctx and verifies route + tools register without throwing.
// 2) Invokes the registered API handler against the REAL filesystem to prove the
//    relay-dir sibling resolution fix returns live ledger data.

import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const here = new URL('.', import.meta.url)
const indexUrl = new URL('./index.js', here)

const registered = []
const ctx = {
  webServer: { register: (r) => registered.push({ regType: 'web', ...r }) },
  tools: { register: (t) => registered.push({ regType: 'tool', ...t }) },
  connection: { requestRejection: () => null }, // null = trusted
}

const mod = await import(indexUrl)
await mod.apply(ctx)

const route = registered.find(r => r.regType === 'web' && r.path?.includes('api/state'))
const toolNames = registered.filter(r => r.regType === 'tool').map(r => r.name)

console.log('registered count:', registered.length)
console.log('route path:', route?.path)
console.log('tool names:', toolNames)

const ok =
  route && route.path === '/dsh-workbench/api/state-v2' &&
  ['wb_get', 'wb_set', 'wb_close'].every(n => toolNames.includes(n)) &&
  toolNames.length === 3
if (!ok) { console.error('FAIL: registration mismatch'); process.exit(1) }

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
console.log('\nHOST HARNESS PASS')
