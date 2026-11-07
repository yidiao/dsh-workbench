// Headless harness for the CLIENT bundle (client.js), v2.0.0.
// Proves the shape the main-area panel depends on:
//   1. the panel is a MAIN-AREA page reached from a left-rail icon, injected
//      through slots + locale only;
//   2. the tab bar is exactly 主页 / 配置 / closable per-project canvas tabs —
//      任务 / 历史 / 工作区 are gone;
//   3. every dictionary string is short: zh ≤30, en ≤44, measured not eyeballed;
//   4. the canvas paints nodes/edges/state from the snapshot and 跑一遍 posts
//      /api/run with confirm:true — the client never fakes a green either;
//   5. design tokens ride on theme variables (--dsw-alias-*), no hardcoded
//      light/dark palette.

import { readFileSync } from 'node:fs'
import vm from 'node:vm'

let failures = 0
const ok = (cond, msg) => {
  if (cond) { console.log('ok - ' + msg) } else { failures += 1; console.error('FAIL - ' + msg) }
}

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8')

// ---- mock React ---------------------------------------------------------------
let hookStates = []
let hookIndex = 0
const React = {
  createElement: (type, props, ...children) => ({
    type, props: { ...(props || {}), children: children.flat().filter(c => c !== false && c != null) },
  }),
  useState: init => {
    const index = hookIndex++
    if (!(index in hookStates)) hookStates[index] = typeof init === 'function' ? init() : init
    const set = value => {
      hookStates[index] = typeof value === 'function' ? value(hookStates[index]) : value
    }
    return [hookStates[index], set]
  },
  useCallback: fn => fn,
  useRef: init => {
    const index = hookIndex++
    if (!(index in hookStates)) hookStates[index] = { current: init }
    return hookStates[index]
  },
  useEffect: fn => { fn() },
}
const require = name => {
  if (name === 'react') return React
  throw new Error('client required an unexpected module: ' + name)
}

// ---- fixture: one project, two loops (loop 1 done+green, loop 2 fresh) --------
const snapshot = {
  ok: true, version: 2, active: 'k1',
  projects: [{
    key: 'k1', root: 'D:/AI Pj/_workbench', name: '_workbench', enabled: true, archived: false,
    roles: { t1: '', t2: '', t3: '' }, outcome: 'yellow', mainline: 'v1.0 四层落地', updatedAt: '',
  }],
  memory: { key: 'k1', name: '_workbench', mainline: 'v1.0 四层落地', stopped_at: '', next: [], red_lines: [], decisions: [], outcome: 'yellow', gap: { open: false } },
  agents: { path: 'D:/AI Pj/_workbench/AGENTS.md', bytes: 900 },
  globals: { phrases: ['回答前，请先向我提问。'], tokens: { radius: 14, gap: 16, accent: '' } },
  execution: { enabled: true, cwd: 'D:/AI Pj' },
  methods: [
    { id: 'm_input', name: '用户输入', kind: 'input', kindLabel: '输入', owner: 'builtin', ports: {}, executor: { kind: '', label: '', available: false }, verifier: {} },
    { id: 'm_exec', name: '执行与日志', kind: 'exec', kindLabel: '执行', owner: 'builtin', ports: {}, executor: { kind: 'text', label: '模板拼装（本地，真跑）', available: true }, verifier: {} },
    { id: 'm_output', name: '任务输出', kind: 'output', kindLabel: '输出', owner: 'builtin', ports: {}, executor: { kind: '', label: '', available: false }, verifier: {} },
  ],
  canvas: {
    ok: true, version: 2,
    nodes: [
      node('n_in1', 'm_input', 'input', '用户输入', '输入', 1, { x: 24, y: 24 }, 'idle'),
      node('n_exec1', 'm_exec', 'exec', '执行与日志', '执行', 1, { x: 384, y: 24 }, 'green'),
      node('n_out1', 'm_output', 'output', '任务输出', '输出', 1, { x: 744, y: 24 }, 'idle'),
      node('n_in2', 'm_input', 'input', '用户输入', '输入', 2, { x: 24, y: 324 }, 'idle'),
      node('n_exec2', 'm_exec', 'exec', '执行与日志', '执行', 2, { x: 384, y: 324 }, 'idle'),
      node('n_out2', 'm_output', 'output', '任务输出', '输出', 2, { x: 744, y: 324 }, 'idle'),
    ],
    edges: [
      { id: 'e1', from: { node: 'n_in1', port: 'out' }, to: { node: 'n_exec1', port: 'in' }, valid: true },
      { id: 'e2', from: { node: 'n_exec1', port: 'out' }, to: { node: 'n_out1', port: 'in' }, valid: true },
      { id: 'e3', from: { node: 'n_in2', port: 'out' }, to: { node: 'n_exec2', port: 'in' }, valid: true },
      { id: 'e4', from: { node: 'n_exec2', port: 'out' }, to: { node: 'n_out2', port: 'in' }, valid: true },
    ],
    validation: { ok: true, issues: [], order: [] },
    view: { positions: {}, zoom: 1 },
    maxLoop: 2,
    loops: [
      { loop: 1, runId: 'r1', status: 'done', colour: 'green', goal: '第一轮：把周报跑出来' },
      { loop: 2, runId: '', status: '', colour: '', goal: '' },
    ],
    methods: [
      { id: 'm_input', name: '用户输入', kind: 'input', kindLabel: '输入', owner: 'builtin' },
      { id: 'm_exec', name: '执行与日志', kind: 'exec', kindLabel: '执行', owner: 'builtin' },
      { id: 'm_output', name: '任务输出', kind: 'output', kindLabel: '输出', owner: 'builtin' },
    ],
    executors: [
      { kind: 'text', label: '模板拼装（本地，真跑）', available: true },
      { kind: 'llm', label: '模型生文（阶段 D 接会话）', available: false },
    ],
  },
  runs: [{ runId: 'r1', loop: 1, goal: '第一轮：把周报跑出来', status: 'done', colour: 'green', endedAt: 1793946352718, counts: { green: 1, gray: 0, red: 0 }, artifactCount: 1, outputFirstLine: '修完了，也验证完了。' }],
  models: { available: true, reason: '', groups: [{ id: 'prov', name: 'Prov', models: [{ id: 'deepseek-flash', name: 'Flash' }] }] },
  modelHealth: { 'prov/deepseek-flash': { lastStatus: 'done', at: 1793946352718 } },
  fetchedAt: '',
}

function node(id, methodId, kind, title, kindLabel, loop, position, status) {
  return {
    id, methodId, params: {}, hasOwnParams: false, position, loop,
    runtime: {
      methodId, kind, kindLabel, title,
      executor: kind === 'exec' ? 'text' : '',
      executorLabel: kind === 'exec' ? '模板拼装（本地，真跑）' : '无执行器（' + kindLabel + '型）',
      available: kind === 'exec',
      status,
      artifact: status === 'green' ? 'D:/AI Pj/_workbench/projects/k1/artifacts/' + id + '.md' : '',
      note: status === 'green' ? 'artifacts/' + id + '.md' : '',
      checkedAt: '',
    },
    issues: [], blocked: false,
  }
}

// ---- fetch mock -----------------------------------------------------------------
const fetchCalls = []
let fetchMode = 'snapshot'
globalThis.fetch = async (path, options) => {
  fetchCalls.push({ path: String(path), options, body: options?.body ? JSON.parse(options.body) : null })
  const url = String(path)
  if (fetchMode === 'oldhost') return { status: 404, ok: false, json: async () => ({ ok: false, error: 'no route' }) }
  const make = json => ({ status: 200, ok: true, json: async () => json })
  if (url.includes('/run')) return make(runResponse)
  return make(snapshot)
}

// ---- load the bundle the way DSH does --------------------------------------------
let captured = null
const sandbox = vm.createContext({
  window: { __ModuleLoader__: { load: spec => { captured = spec } }, setTimeout, confirm: () => true },
  fetch: globalThis.fetch,
  setTimeout,
  console,
})
new vm.Script(source, { filename: 'client.js' }).runInContext(sandbox)
ok(captured && captured.id === 'dsh-workbench', 'module registers under id dsh-workbench')

const ZH = {}
const EN = {}
const contributions = {}
const module_ = captured.factory(require)
module_.apply({
  effect: fn => fn(),
  locale: {
    register: (name, dict) => { Object.assign(ZH, dict.zh); Object.assign(EN, dict.en) },
    bind: () => key => ZH[key] || EN[key] || key,
  },
  slots: {
    inject: (name, fn) => { contributions[name] = fn },
    register: (def, render) => ({ def, render }),
  },
})
ok(Boolean(contributions.main), 'main-area contribution registered')
ok(Boolean(contributions['sidebar.panellist']), 'left-rail icon contribution registered')

const panelFn = contributions.main().render
ok(Array.isArray(module_.inject) && module_.inject.join(',') === 'slots,locale', 'client injects slots + locale only')
const t = key => ZH[key] || EN[key] || key
// Execute function components into a plain tree so assertions can walk it.
const execTree = el => {
  if (el == null || typeof el !== 'object') return el
  const rendered = typeof el.type === 'function' ? execTree(el.type(el.props)) : el
  const children = (rendered.props?.children || []).map(child => execTree(child))
  return { type: rendered.type, props: { ...rendered.props, children } }
}
const rerender = () => { hookIndex = 0; return execTree(panelFn({})) }
const flattenText = (node, acc = []) => {
  if (node == null) return acc
  if (typeof node === 'string' || typeof node === 'number') { acc.push(String(node)); return acc }
  if (typeof node !== 'object') return acc
  for (const child of (node.props?.children || [])) flattenText(child, acc)
  return acc
}
const textOf = tree => flattenText(tree).join('')
const findAll = (node, pred, acc = []) => {
  if (node == null || typeof node !== 'object') return acc
  if (pred(node)) acc.push(node)
  for (const child of (node.props?.children || [])) findAll(child, pred, acc)
  return acc
}
const clickByLabel = (tree, label) => {
  const hits = findAll(tree, item => typeof item.type === 'string'
    && ['button', 'span'].includes(item.type)
    && flattenText(item).join('').includes(label)
    && typeof item.props?.onClick === 'function')
  if (!hits.length) throw new Error('no clickable element with text: ' + label)
  return hits[hits.length - 1].props.onClick
}
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

// ---- dictionaries are measured ----------------------------------------------------
const zhOver = Object.entries(ZH).filter(([, v]) => typeof v === 'string' && v.length > 30)
ok(zhOver.length === 0, 'zh strings all ≤30 chars' + (zhOver.length ? ' — offenders: ' + JSON.stringify(zhOver.slice(0, 3)) : ''))
const enOver = Object.entries(EN).filter(([, v]) => typeof v === 'string' && v.length > 44)
ok(enOver.length === 0, 'en strings all ≤44 chars' + (enOver.length ? ' — offenders: ' + JSON.stringify(enOver.slice(0, 3)) : ''))

// ---- CSS: theme-aware cards + tokens -----------------------------------------------
ok(source.includes('--wbx-radius') && source.includes('--wbx-accent'), 'design tokens exist as CSS variables')
ok(source.includes('var(--dsw-alias-bg-layer-1') && source.includes('var(--dsw-alias-bg-base'), 'cards ride the host theme variables')
ok(source.includes('.wbx-card{'), 'modern card class defined')
ok(!/background:\s*#(fff|ffffff|1[0-9a-f]|2[0-9a-f])/i.test(source), 'no hardcoded surface palette')

// ---- first render: home --------------------------------------------------------------
let tree = rerender()
await settle()
tree = rerender()
const homeText = textOf(tree)
let tabTexts = findAll(tree, item => item.props?.role === 'tab').map(textOf)
ok(tabTexts.some(text => text.includes(t('home'))) && tabTexts.some(text => text.includes(t('config'))), 'tab bar shows 主页 and 配置')
ok(tabTexts.length === 2, 'initially exactly two tabs (canvas tabs open from home)')
for (const banned of ['任务', '历史', '工作区']) {
  ok(!tabTexts.some(text => text.includes(banned)), `tab bar has no ${banned} tab`)
}
ok(homeText.includes('_workbench'), 'project card paints the project name')
ok(homeText.includes('v1.0 四层落地'), 'project card paints the mainline')
ok(homeText.includes(t('openCanvas')), 'project card offers 打开画布')
ok(homeText.includes('修完了，也验证完了。'), 'recent loops render the digested line, not the log')
ok(homeText.includes(t('newProject')), 'new-project entry exists')

// ---- open the canvas tab --------------------------------------------------------------
await clickByLabel(tree, t('openCanvas'))()
await settle()
tree = rerender()
const canvasText = textOf(tree)
ok(findAll(tree, item => item.props?.role === 'tab').length === 3, 'canvas tab appears as a third, closable tab')
ok(textOf(tree).includes('✕'), 'canvas tab is closable (✕)')
ok(canvasText.includes(t('runBtn')), 'canvas offers 跑一遍')
ok(canvasText.includes('执行与日志') && canvasText.includes('任务输出') && canvasText.includes('用户输入'), 'canvas paints the three node cards')
ok(canvasText.includes(t('outEmpty')), 'fresh output node shows the empty-state line, not a fake report')
ok(canvasText.includes('第 1'), 'previous loop folds into a one-line card')

// ---- 跑一遍 posts /run with confirm:true, then paints the honest result ---------------
const afterRunCanvas = JSON.parse(JSON.stringify(snapshot.canvas))
const exec2 = afterRunCanvas.nodes.find(item => item.id === 'n_exec2')
exec2.runtime.status = 'green'
exec2.runtime.artifact = 'D:/AI Pj/_workbench/projects/k1/artifacts/n_exec2.md'
exec2.runtime.note = 'artifacts/n_exec2.md'
let runResponse = { ok: true, run: { runId: 'r2', loop: 2, goal: '第二轮', status: 'done', counts: { green: 1, gray: 0, red: 0 }, artifacts: ['n_exec2.md'], output: '第二轮完成，产物在盘。' }, canvas: afterRunCanvas }
fetchCalls.length = 0
await clickByLabel(tree, t('runBtn'))()
await settle()
tree = rerender()
const runCall = fetchCalls.find(item => item.path.includes('/run'))
ok(Boolean(runCall), '跑一遍 issues a run call')
ok(runCall?.body?.confirm === true && runCall?.body?.op === 'run', 'run call is explicit (confirm:true, op:run)')
const afterRunText = textOf(tree)
ok(afterRunText.includes(t('green')), 'exec node shows 校验过 · 产物在盘 after the run')
ok(afterRunText.includes('第二轮完成，产物在盘。'), 'output node renders the fresh report conclusion')

// ---- close-out dialog present on the canvas page ---------------------------------------
await clickByLabel(tree, t('closeOut'))()
await settle()
tree = rerender()
ok(textOf(tree).includes(t('closeTitle')), 'close-out dialog opens from the canvas page')

// ---- old host still running: 404 → restart hint ------------------------------------------
// Loads fired before the flip are still in flight and would land a stale 200
// over the error state; drain them first, then let a 404 load land last.
fetchMode = 'oldhost'
await rerender()
await settle()
await rerender()
await settle()
const oldTree = rerender()
ok(textOf(oldTree).includes('重启 DSH'), 'a 404 host says restart DSH, not debug-the-network')

console.log(failures ? `\nCLIENT CHECK FAILED: ${failures} failure(s)` : '\nCLIENT CHECK GREEN')
process.exitCode = failures ? 1 : 0
