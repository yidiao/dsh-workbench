// One-off: run the real plugin against the real workbench dir so the migration
// and the generated AGENTS.md can be inspected on disk (not in a temp copy).
process.env.DSH_WORKBENCH_DIR = 'D:/AI Pj/_workbench'
const registered = []
const ctx = {
  webServer: { register: (r) => { registered.push({ regType: 'web', ...r }); return () => {} } },
  tools: { register: (t) => { registered.push({ regType: 'tool', ...t }); return () => {} } },
  connection: { requestRejection: () => null },
  get: () => undefined,
}
const mod = await import('file:///D:/AI Pj/_workbench/plugin/dsh-workbench/index.js')
await mod.apply(ctx)
const get = registered.find(r => r.regType === 'tool' && r.name === 'wb_get')
console.log('--- wb_get state ---')
console.log((await get.execute({ section: 'state' })).text)
console.log('--- wb_get projects ---')
console.log((await get.execute({ section: 'projects' })).text)
const route = registered.find(r => r.regType === 'web' && r.path === '/dsh-workbench/api/memory')
const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v }, end(body) { this.body = body } }
await route.handler({ method: 'GET', headers: { host: '127.0.0.1:53815' }, url: route.path }, res)
const payload = JSON.parse(res.body)
console.log('--- memory payload ---')
console.log('active:', payload.active, '| root:', payload.root, '| agentsBytes:', payload.agentsBytes, '| items:', payload.items.length)
console.log('decisions:', payload.memory.decisions.length, '| gap:', JSON.stringify(payload.memory.gap))
console.log('agentsPath:', payload.agentsPath)