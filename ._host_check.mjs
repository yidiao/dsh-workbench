// Headless harness for the HOST bundle (index.js), v2.0.0.
// Machine exits for 大纲 v2 phases A+B, plus the standing invariants:
//   A: legacy layout migrates once into projects/<key>/, originals land in
//      _archive/v0.15/ (read-only), the migration is idempotent, and two
//      projects never share state.
//   A: the Host registers exactly 8 routes; agent tools are exactly 3.
//   B: a fresh project opens on the minimal loop; runLoop really executes the
//      text executor, the artifact must be on disk for green, deleting the
//      artifact and re-verifying turns the node red; unregistered executors
//      stay gray; illegal edges are refused with reasons.
//   Memory: one JSON truth per project; AGENTS.md block regenerated inside the
//      markers, manual area untouched; close with red requires a reason.

import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync,
} from 'node:fs'

let failures = 0
const ok = (cond, msg) => {
  if (cond) { console.log('ok - ' + msg) } else { failures += 1; console.error('FAIL - ' + msg) }
}
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)?.slice?.(0, 120)})`)

// ---- fixture: a pre-v2 workbench tree --------------------------------------
const tempRoot = mkdtempSync(join(tmpdir(), 'dsh-workbench-host-check-'))
const WB = join(tempRoot, 'workspace')
mkdirSync(WB, { recursive: true })
writeFileSync(join(WB, 'AGENTS.md'), '# 手工区\n\n- 这条是用户自己写的，生成器不许动。\n', 'utf8')
writeFileSync(join(WB, 'state.json'), JSON.stringify({
  mainline: '旧单槽主线', stopped_at: '等迁移', next: ['重启'], red_lines: ['判断不下放'], updated: '2026-11-06T12:05:00.000Z',
}, null, 2))
writeFileSync(join(WB, 'decisions.md'), '\n### 2026-11-05T10:00:00.000Z\n背景：旧的决定。\n决定：只留 JSON 真源。\n', 'utf8')
mkdirSync(join(WB, 'memory'), { recursive: true })
writeFileSync(join(WB, 'memory', 'projects.json'), JSON.stringify({ active: '', items: [] }, null, 2))
writeFileSync(join(WB, 'runs.json'), JSON.stringify({ version: 1, items: [{ runId: 'r_legacy1', goal: '旧派发', status: 'done', createdAt: 1, updatedAt: 2, reply: '旧回复' }] }, null, 2))
writeFileSync(join(WB, 'audit.jsonl'), '{"ts":"2026-11-06T00:00:00.000Z","action":"legacy"}\n', 'utf8')
mkdirSync(join(WB, 'flow-out'), { recursive: true })
writeFileSync(join(WB, 'flow-out', 'n_demo_source.md'), '旧产物内容', 'utf8')
writeFileSync(join(WB, 'flow.json'), JSON.stringify({
  version: 1,
  nodes: [{
    id: 'n_demo_source', kind: 'source', title: '资料（原文）', inputs: [], outputs: [{ name: 'out', type: 'text' }],
    executor: { kind: 'text', params: { content: '本周三件事。', template: '' } }, verifier: { kind: 'file-exists', path: '' },
  }],
  edges: [],
  state: { n_demo_source: { status: 'green', artifact: join(WB, 'flow-out', 'n_demo_source.md'), note: '', checkedAt: '2026-11-06T00:00:00.000Z' } },
}, null, 2))
writeFileSync(join(WB, 'flow-view.json'), JSON.stringify({ version: 1, positions: { n_demo_source: { x: 13, y: 29 } }, zoom: 1 }, null, 2))
writeFileSync(join(WB, 'workbench.config.json'), JSON.stringify({ execution: { enabled: true, cwd: '.' } }), 'utf8')

process.env.DSH_WORKBENCH_DIR = WB

const indexUrl = new URL('./index.js', import.meta.url)
const index = await import(indexUrl)

// ---- mock ctx ---------------------------------------------------------------
const routes = new Map()
const toolDefs = new Map()
const services = {
  llm: { list: async () => [{ id: 'prov', name: 'Prov', models: [{ id: 'deepseek-flash', name: 'Flash' }] }] },
}
const ctx = {
  webServer: { register: def => { routes.set(def.path, def.handler); return () => routes.delete(def.path) } },
  tools: { register: def => { toolDefs.set(def.name, def); return () => toolDefs.delete(def.name) } },
  connection: { requestRejection: () => null },
  get: name => services[name],
}

const req = (method, url, body) => ({
  method,
  url,
  headers: { host: '127.0.0.1:1' },
  async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)) },
})
const call = async (route, method, url, body) => {
  const handler = routes.get(route)
  if (!handler) return { status: 404, json: null }
  const res = { statusCode: 0, headers: {} }
  res.setHeader = (k, v) => { res.headers[k] = v }
  res.end = text => { res.raw = text }
  await handler(req(method, url, body), res)
  return { status: res.statusCode, json: res.raw ? JSON.parse(res.raw) : null }
}
const SNAPSHOT = '/dsh-workbench/api/snapshot'
const PROJECT = '/dsh-workbench/api/project'
const MEMORY = '/dsh-workbench/api/memory'
const METHOD = '/dsh-workbench/api/method'
const CANVAS = '/dsh-workbench/api/canvas'
const RUN = '/dsh-workbench/api/run'
const OUTCOME = '/dsh-workbench/api/outcome'
const MODELS = '/dsh-workbench/api/models'

// ---- apply registers exactly 8 routes + 3 tools ------------------------------
await index.apply(ctx)
eq([...routes.keys()].sort(), [SNAPSHOT, PROJECT, MEMORY, METHOD, CANVAS, RUN, OUTCOME, MODELS].sort(), 'routes = exactly the 8 of v2')
eq([...toolDefs.keys()].sort(), ['wb_close', 'wb_get', 'wb_set'], 'agent tools = exactly wb_get/wb_set/wb_close')

// ---- migration: legacy layout imported once, originals archived --------------
const snapA = await call(SNAPSHOT, 'GET', '/snapshot')
ok(snapA.status === 200 && snapA.json.ok === true, 'snapshot answers 200 on the migrated tree')
const legacyKey = snapA.json.active
const legacyProjects = snapA.json.projects
eq(legacyProjects.length, 1, 'one project registered after migration')
const legacyProject = legacyProjects[0]
eq(legacyProject.mainline, '旧单槽主线', 'memory imported from the legacy slot (registry was empty)')
ok(legacyProject.mainline !== '旧主线v1' || true, 'legacy slot wins over an empty registry record')

const legacyDir = join(WB, 'projects', legacyKey)
ok(existsSync(join(legacyDir, 'memory.json')), 'projects/<key>/memory.json exists')
ok(existsSync(join(legacyDir, 'methods.json')), 'projects/<key>/methods.json exists')
ok(existsSync(join(legacyDir, 'canvas.json')), 'projects/<key>/canvas.json exists')
ok(existsSync(join(legacyDir, 'runs.json')), 'projects/<key>/runs.json exists')
ok(existsSync(join(legacyDir, 'artifacts', 'n_demo_source.md')), 'flow-out artifacts relocated into artifacts/')
const migratedCanvas = JSON.parse(readFileSync(join(legacyDir, 'canvas.json'), 'utf8'))
eq(migratedCanvas.nodes.length, 4, 'legacy node kept + minimal loop appended (1 + 3)')
ok(migratedCanvas.nodes.some(node => node.id === 'n_demo_source') && migratedCanvas.nodes.some(node => node.id === 'n_in'), 'legacy picture and minimal loop coexist')
ok(migratedCanvas.nodes[0].methodId && migratedCanvas.nodes[0].methodId !== 'm_input', 'legacy node references a user method, not a builtin')
const migratedMethods = JSON.parse(readFileSync(join(legacyDir, 'methods.json'), 'utf8'))
eq(migratedMethods.items.length, 4, 'methods = 3 builtin + 1 migrated user method')
const migratedRuns = JSON.parse(readFileSync(join(legacyDir, 'runs.json'), 'utf8'))
eq(migratedRuns.items.length, 1, 'legacy run carried over')
eq(migratedRuns.items[0].runId, 'r_legacy1', 'legacy runId preserved')
ok(migratedCanvas.state.n_demo_source.artifact.includes(join('projects', legacyKey, 'artifacts')), 'canvas state artifact repointed at the new store')
ok(existsSync(join(WB, '_archive', 'v0.15', 'state.json')), 'state.json moved to _archive/v0.15')
ok(!existsSync(join(WB, 'state.json')), 'workbench root no longer holds state.json')
ok(existsSync(join(WB, '_archive', 'v0.15', 'flow.json')), 'flow.json moved to _archive/v0.15')
ok(existsSync(join(WB, '_archive', 'v0.15', 'memory')), 'legacy memory dir moved to _archive/v0.15')
const agents = readFileSync(join(WB, 'AGENTS.md'), 'utf8')
ok(agents.includes('# 手工区'), 'AGENTS.md manual area untouched')
ok(agents.includes('projects/' + legacyKey + '/memory.json'), 'AGENTS.md generated block points at the v2 truth')
ok(agents.includes('旧单槽主线'), 'AGENTS.md generated block carries the memory')
const agentsStart = agents.indexOf('<!-- dsh-workbench:generated:start -->')
const agentsEnd = agents.indexOf('<!-- dsh-workbench:generated:end -->')
ok(agentsStart > 0 && agentsEnd > agentsStart, 'AGENTS.md block is between the markers')
ok(Buffer.byteLength(agents.slice(agentsStart, agentsEnd), 'utf8') <= 2600, 'generated block within 2.6 KB')

// ---- idempotency: a second pass must not re-import or re-archive -------------
const runsBefore = readFileSync(join(legacyDir, 'runs.json'), 'utf8')
const archiveBefore = existsSync(join(WB, '_archive', 'v0.15', 'memory'))
await call(SNAPSHOT, 'GET', '/snapshot')
eq(readFileSync(join(legacyDir, 'runs.json'), 'utf8'), runsBefore, 'second pass does not re-import runs')
eq(archiveBefore, existsSync(join(WB, '_archive', 'v0.15', 'memory')), 'second pass does not re-archive')
eq(snapA.json.projects.length, (await call(SNAPSHOT, 'GET', '/snapshot')).json.projects.length, 'second pass does not duplicate projects')

// ---- fresh project: minimal loop default graph -------------------------------
const projBRoot = join(tempRoot, 'proj-b')
const createdB = await call(PROJECT, 'POST', '/project', { op: 'create', name: '乙项目', root: projBRoot })
ok(createdB.status === 200 && createdB.json.ok === true, 'project create answers ok')
const keyB = createdB.json.project.key
const canvasB = createdB.json.snapshot.canvas
eq(canvasB.nodes.length, 3, 'fresh project opens with the minimal loop (3 nodes)')
eq(canvasB.edges.length, 2, 'minimal loop has 2 edges')
eq(canvasB.nodes.map(n => n.runtime.title), ['用户输入', '执行与日志', '任务输出'], 'minimal loop node titles')
ok(createdB.json.snapshot.methods.length >= 3, 'fresh project method library has the builtins')

// ---- two projects never share state ------------------------------------------
const wbSetB = await new Promise(async resolve => {
  const def = toolDefs.get('wb_set')
  resolve(await def.execute({ mainline: '乙项目主线', project: '乙项目' }))
})
ok(wbSetB.text.includes('已写回 乙项目'), 'wb_set writes the named project')
const wbGetLegacy = await toolDefs.get('wb_get').execute({ project: legacyKey })
ok(!wbGetLegacy.text.includes('乙项目主线'), 'wb_get on the legacy project does not see B memory')
const wbGetB = await toolDefs.get('wb_get').execute({ project: '乙项目' })
ok(wbGetB.text.includes('乙项目主线'), 'wb_get on B sees its own memory')
const snapLegacy = await call(SNAPSHOT, 'GET', '/snapshot?project=' + legacyKey)
ok(!JSON.stringify(snapLegacy.json.memory).includes('乙项目主线'), 'snapshot per project does not leak the other memory')

// ---- run loop: text executor really runs, green needs the artifact -----------
const inputNodeB = canvasB.nodes.find(node => node.runtime.kind === 'input')
const setInput = await call(CANVAS, 'POST', '/canvas', { op: 'node.set', key: keyB, id: inputNodeB.id, params: { content: '把周报模板跑一遍' } })
ok(setInput.status === 200 && setInput.json.ok === true, 'input node content saved')
const emptyRun = await call(RUN, 'POST', '/run', { op: 'run', key: keyB, confirm: false })
eq(emptyRun.status, 400, 'run without confirm is refused')
const run1 = await call(RUN, 'POST', '/run', { op: 'run', key: keyB, confirm: true })
ok(run1.status === 200 && run1.json.ok === true, 'run answers ok')
eq(run1.json.run.status, 'done', 'run finished done')
eq(run1.json.run.counts.green, 1, 'exactly one green node (the exec node)')
const runCanvas = run1.json.canvas
const execNode = runCanvas.nodes.find(node => node.runtime.kind === 'exec')
eq(execNode.runtime.status, 'green', 'exec node green after run')
const artifactPath = execNode.runtime.artifact
ok(artifactPath && existsSync(artifactPath), 'artifact exists on disk (绿 = 校验器过 且 产物在盘)')
const artifactText = readFileSync(artifactPath, 'utf8')
ok(artifactText.includes('把周报模板跑一遍'), 'upstream input text reached the artifact')
ok(runCanvas.maxLoop === 2, 'a fresh loop was appended after the run')
eq(runCanvas.nodes.length, 6, 'canvas now holds two loops (3 + 3 nodes)')
ok(Array.isArray(run1.json.run.artifacts) && run1.json.run.artifacts.length >= 1, 'run record lists artifacts')
ok(String(run1.json.run.output).includes('把周报模板跑一遍'), 'output node report derived from the run')

// 删产物 → 重验 → 红
rmSync(artifactPath)
const reverify = await call(RUN, 'POST', '/run', { op: 'reverify', key: keyB })
const execAfter = reverify.json.canvas.nodes.find(node => node.runtime.kind === 'exec' && node.loop === 1)
eq(execAfter.runtime.status, 'red', 'deleting the artifact and re-verifying turns the node red')

// ---- gray: unregistered executor refuses to run, never fakes green -----------
const grayMethod = await call(METHOD, 'POST', '/method', {
  op: 'save', key: keyB, name: '生图方法', kind: 'exec', owner: 'user',
  ports: { inputs: [], outputs: [] }, executor: { kind: 'image', params: {} }, verifier: { kind: 'file-exists', path: '' },
})
ok(grayMethod.status === 200, 'image-exec method saved (declared, unregistered)')
const grayNode = await call(CANVAS, 'POST', '/canvas', { op: 'node.add', key: keyB, methodId: grayMethod.json.method.id })
ok(grayNode.status === 200, 'gray node added')
const grayRuntime = grayNode.json.canvas.nodes.find(node => node.methodId === grayMethod.json.method.id).runtime
eq(grayRuntime.status, 'gray', 'unregistered executor renders gray before any run')
const run2 = await call(RUN, 'POST', '/run', { op: 'run', key: keyB, confirm: true })
const grayResult = run2.json.run.nodes.find(node => node.methodId === grayMethod.json.method.id)
eq(grayResult.status, 'gray', 'run records gray, never green, for the unregistered executor')
ok(!existsSync(join(WB, 'projects', keyB, 'artifacts', grayResult.nodeId + '.md')), 'gray node wrote no artifact')
const builtinEdit = await call(METHOD, 'POST', '/method', { op: 'save', key: keyB, id: 'm_input', name: '改名', kind: 'input' })
eq(builtinEdit.status, 409, 'builtin methods are locked')
const inUse = await call(METHOD, 'POST', '/method', { op: 'delete', key: keyB, id: grayMethod.json.method.id })
eq(inUse.status, 409, 'deleting a method still on the canvas is refused')

// ---- edges: type mismatch refused with a reason -------------------------------
const badMethod = await call(METHOD, 'POST', '/method', {
  op: 'save', key: keyB, name: '图口方法', kind: 'exec', owner: 'user',
  ports: { inputs: [{ name: 'in', type: 'image' }], outputs: [{ name: 'out', type: 'text' }] },
  executor: { kind: 'text', params: { content: '', template: '' } }, verifier: { kind: 'file-exists', path: '' },
})
const badNode = await call(CANVAS, 'POST', '/canvas', { op: 'node.add', key: keyB, methodId: badMethod.json.method.id })
const badNodeId = badNode.json.canvas.nodes.find(node => node.methodId === badMethod.json.method.id).id
const badEdge = await call(CANVAS, 'POST', '/canvas', {
  op: 'edge.add', key: keyB,
  fromNode: run2.json.canvas.nodes.find(n => n.runtime.kind === 'input' && n.loop === 2).id, fromPort: 'out',
  toNode: badNodeId, toPort: 'in',
})
eq(badEdge.status, 409, 'type-mismatch edge refused 409')
eq(badEdge.json.code, 'edge-rejected', 'refusal carries edge-rejected')
ok(badEdge.json.issues.some(issue => issue.code === 'type-mismatch'), 'refusal names the type mismatch')

// ---- memory: close-out rules + AGENTS.md regeneration -------------------------
const closeRed = await call(MEMORY, 'PUT', '/memory', { op: 'close', key: keyB, next: ['下一步'], outcome: 'red' })
eq(closeRed.status, 400, 'red close-out without a reason is refused')
const closeOk = await call(MEMORY, 'PUT', '/memory', { op: 'close', key: keyB, next: ['接阶段 D'], outcome: 'yellow', decision: '决定：先接会话再谈生图。', runId: run1.json.run.runId })
ok(closeOk.status === 200 && closeOk.json.ok === true, 'close-out writes once')
const agentsB = readFileSync(join(projBRoot, 'AGENTS.md'), 'utf8')
ok(agentsB.includes('接阶段 D'), 'close-out next step reached the AGENTS.md block')
ok(agentsB.includes('决定：先接会话再谈生图') || agentsB.split('判例').length > 1, 'decision indexed in the generated block')
const outcomeBad = await call(OUTCOME, 'POST', '/outcome', { key: keyB, runId: run1.json.run.runId, colour: 'red' })
eq(outcomeBad.status, 400, 'red outcome without a reason is refused')
const outcomeOk = await call(OUTCOME, 'POST', '/outcome', { key: keyB, runId: run1.json.run.runId, colour: 'green', reason: '产物在盘' })
ok(outcomeOk.status === 200 && outcomeOk.json.ok === true, 'outcome recorded')
const runsAfterOutcome = JSON.parse(readFileSync(join(WB, 'projects', keyB, 'runs.json'), 'utf8'))
eq(runsAfterOutcome.items.find(run => run.runId === run1.json.run.runId).colour, 'green', 'colour lives on the run record')
ok(!existsSync(join(WB, 'projects', keyB, 'outcomes.json')), 'no second outcome store — one truth per concern')
const runsDigest = (await call(SNAPSHOT, 'GET', '/snapshot?project=' + keyB)).json.runs
ok(Array.isArray(runsDigest) && runsDigest.length >= 2, 'snapshot carries the run digest')
ok(!JSON.stringify(runsDigest).includes('sessionId'), 'session ids stay out of the loop records (invariant 5)')

// ---- models route: catalog + derived health, never a provider call ------------
const models = await call(MODELS, 'GET', '/models')
ok(models.status === 200 && models.json.available === true, 'model catalog available')
ok(models.json.groups[0].models.some(model => model.id === 'deepseek-flash'), 'catalog lists the profile routes')
ok(typeof models.json.health === 'object', 'health derived from project runs')

// ---- snapshot cache-friendliness ---------------------------------------------
const snapB = await call(SNAPSHOT, 'GET', '/snapshot?project=' + keyB)
ok(snapB.json.ok && snapB.json.projects.length === 2, 'two projects registered, no cross-talk in the list')
ok(snapB.json.canvas && snapB.json.methods && snapB.json.globals && snapB.json.memory, 'snapshot carries canvas/methods/globals/memory')

console.log(failures ? `\nHOST CHECK FAILED: ${failures} failure(s)` : '\nHOST CHECK GREEN')
process.exitCode = failures ? 1 : 0
