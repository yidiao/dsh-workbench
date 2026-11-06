// Headless harness for the CLIENT bundle (client.js), v0.6.
// Proves: the four tabs really switch the rendered subtree, the task tab can be
// assembled from a saved module and targets a chosen session, the history tab
// paints a derived report with the raw record folded away, and the workspace tab
// carries continuity / decision cards / audit timeline / real metrics.

let captured = null
globalThis.window = { __ModuleLoader__: { load: (spec) => { captured = spec } } }

const h = (type, props, ...children) => ({
  type, props: { ...(props || {}), children: children.flat().filter(c => c !== false && c != null) },
})

let hookStates = []
let hookIndex = 0
const React = {
  createElement: h,
  useState: (init) => {
    const index = hookIndex++
    if (!(index in hookStates)) hookStates[index] = typeof init === 'function' ? init() : init
    const set = (value) => {
      hookStates[index] = typeof value === 'function' ? value(hookStates[index]) : value
    }
    return [hookStates[index], set]
  },
  useCallback: (fn) => fn,
  useRef: (init) => {
    const index = hookIndex++
    if (!(index in hookStates)) hookStates[index] = { current: init }
    return hookStates[index]
  },
  useEffect: (fn) => { try { fn() } catch {} },
}

const payloads = {
  '/dsh-workbench/api/state-v2': {
    ok: true,
    state: {
      mainline: '测试主线',
      stopped_at: '停在 P0',
      next: ['保存一次编辑', '查看审计'],
      red_lines: ['不绕过权限'],
      updated: '2026-10-31T00:00:00.000Z',
    },
    decisions: '### 2026-10-31T00:00:00.000Z\n面板改成标签页\n背景：所有功能挤在一屏\n决定：运行/任务/历史/工作区\n代价：需要多点一次',
    tasks: [{ id: 'T-001', status: '绿', goal: '测试任务' }],
    ledger: { rows: [], totalTokens: 0, greenCards: 1 },
    execution: { enabled: true, cwd: 'D:/workspace', controller: true },
    fetchedAt: '2026-10-31T00:00:00.000Z',
  },
  '/dsh-workbench/api/runs': {
    ok: true,
    items: [
      {
        runId: 'run_A', sessionId: 'session-aaa', goal: '统计 md 行数 top3',
        model: 'deepseek-flash', status: 'running', cwd: 'D:/AI Pj',
        createdAt: 1793944774996, updatedAt: 1793944774996, steps: 6, toolCalls: 11,
        orphaned: true,
      },
      {
        runId: 'run_B', sessionId: 'session-bbb', goal: '上一条已完成的任务',
        model: 'deepseek-flash', status: 'done', cwd: 'D:/AI Pj', plan: '步骤B', instruction: '注意B',
        createdAt: 1793944000000, updatedAt: 1793944100000, reply: '上一次运行的回复正文',
      },
    ],
  },
  '/dsh-workbench/api/models': {
    ok: true,
    available: true,
    groups: [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-flash', name: 'Flash' }] }],
    current: { provider: 'deepseek-official', model: 'deepseek-flash' },
  },
  '/dsh-workbench/api/audit': {
    ok: true,
    entries: [
      { ts: '2026-10-31T10:00:03.000Z', action: 'dispatch.start', summary: 'session session-aaa · 统计 md 行数 top3' },
      { ts: '2026-10-31T10:00:09.000Z', action: 'state.edit', summary: 'mainline' },
    ],
  },
  '/dsh-workbench/api/sessions': {
    ok: true,
    available: true,
    items: [
      { sessionId: 'session-aaa', title: '正在跑的会话', running: true, blank: false, updatedAt: 1793944774996 },
      { sessionId: 'session-ccc', title: '', running: false, blank: false, updatedAt: 1793944000000 },
    ],
  },
  '/dsh-workbench/api/modules': {
    ok: true,
    items: [{ id: 'mod_1', kind: 'goal', title: '统计行数模块', text: '模块正文：统计 md 行数并给出 top3', uses: 2 }],
  },
}

const reports = {
  run_A: {
    ok: true, derived: true, note: '机器摘要：与原文不一致时以原文为准。',
    run: {
      runId: 'run_A', goal: '统计 md 行数 top3', status: 'running', model: 'deepseek-flash',
      sessionId: 'session-aaa', sessionMode: 'new', cwd: 'D:/AI Pj', plan: '', instruction: '', waiting: false,
    },
    conclusion: '这一轮还没有产出结论（运行中）。',
    points: [], artifacts: [], pending: [],
    stats: { durationMs: 1000, steps: 6, toolCalls: 11, messages: 0 },
    reply: '',
  },
  run_B: {
    ok: true, derived: true, note: '机器摘要：与原文不一致时以原文为准。',
    run: {
      runId: 'run_B', goal: '上一条已完成的任务', status: 'done', model: 'deepseek-flash',
      sessionId: 'session-bbb', sessionMode: 'new', cwd: 'D:/AI Pj', plan: '步骤B', instruction: '注意B', waiting: false,
    },
    conclusion: '历史结论摘要',
    points: ['要点一', '要点二'],
    artifacts: [{ path: 'D:/out/report.md', tool: 'ops_bash' }],
    pending: ['是否继续？'],
    stats: { durationMs: 100000, steps: 3, toolCalls: 5, messages: 1 },
    reply: '上一次运行的回复正文',
  },
}

const requests = []
globalThis.fetch = async (url, options) => {
  const raw = String(url)
  const path = raw.split('?')[0]
  const body = options?.body ? JSON.parse(options.body) : null
  requests.push({ path, method: options?.method || 'GET', body })
  if (path === '/dsh-workbench/api/dispatch') {
    return {
      ok: true, status: 200,
      json: async () => ({
        ok: true, dryRun: body?.dryRun === true, available: true, executionEnabled: true,
        prompt: '[DSH Workbench 任务]\n目标：' + String(body?.goal || ''), cwd: 'D:/workspace',
        model: body?.model || '', sessionMode: body?.sessionId ? 'existing' : 'new', sessionId: body?.sessionId || '',
      }),
    }
  }
  if (path === '/dsh-workbench/api/report') {
    const runId = new URL(raw, 'http://127.0.0.1').searchParams.get('runId') || 'run_A'
    const payload = reports[runId]
    if (!payload) return { ok: false, status: 404, json: async () => ({ ok: false, error: '没有这次运行的记录' }) }
    return { ok: true, status: 200, json: async () => payload }
  }
  const payload = payloads[path]
  if (!payload) return { ok: false, status: 404, json: async () => ({ ok: false }) }
  return { ok: true, status: 200, json: async () => payload }
}

await import(new URL('./client.js', import.meta.url).href)

if (!captured) { console.error('FAIL: client did not call __ModuleLoader__.load'); process.exit(1) }
const bundle = captured.factory(() => React)
if (!bundle || !bundle.apply) { console.error('FAIL: bundle factory returned no apply'); process.exit(1) }

const registrations = []
let currentSlot = null
const ctx = {
  effect: (fn) => { try { fn() } catch {}; return () => {} },
  locale: { register: () => {}, bind: () => (k) => String(k) },
  slots: {
    inject: (name, thunk) => { const p = currentSlot; currentSlot = name; try { thunk() } finally { currentSlot = p } },
    register: (spec, renderFn) => { registrations.push({ slot: currentSlot, spec, renderFn }) },
  },
}

bundle.apply(ctx)

const sidebar = registrations.find(r => r.slot === 'sidebar.panellist' && r.spec?.id === 'dsh-workbench')
const main = registrations.find(r => r.slot === 'main' && r.spec?.key === 'dsh-workbench')
if (!sidebar) { console.error('FAIL: no sidebar.panellist entry with id dsh-workbench'); process.exit(1) }
if (!main) { console.error('FAIL: no main panel registered for dsh-workbench'); process.exit(1) }
console.log('sidebar.panellist entry:', sidebar.spec.id, '(order', sidebar.spec.order + ')')
console.log('main panel key:', main.spec.key)

function render(el) {
  if (!el || typeof el !== 'object') return el
  if (typeof el.type === 'function') return render(el.type(el.props || {}))
  const kids = Array.isArray(el.props?.children) ? el.props.children.map(render) : el.props?.children
  return { ...el, props: { ...el.props, children: kids } }
}

function renderPanel() {
  hookIndex = 0
  return render(main.renderFn({ size: 24, active: false }))
}

function findAll(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out
  if (predicate(node)) out.push(node)
  const kids = node.props?.children
  if (Array.isArray(kids)) kids.forEach(kid => findAll(kid, predicate, out))
  return out
}
const findClass = (node, cls) => findAll(node, n => n.props?.className?.includes?.(cls)).length > 0
const findNode = (node, predicate) => findAll(node, predicate)[0] || null
function findText(node, text) {
  if (typeof node === 'string') return node === text
  if (Array.isArray(node)) return node.some(c => findText(c, text))
  if (node && typeof node === 'object') return findText(node.props?.children, text)
  return false
}
function includesText(node, text) {
  const flat = []
  const walk = value => {
    if (typeof value === 'string') { flat.push(value); return }
    if (Array.isArray(value)) { value.forEach(walk); return }
    if (value && typeof value === 'object') walk(value.props?.children)
  }
  walk(node)
  return flat.some(item => item.includes(text))
}
function textDump(node, out = []) {
  if (typeof node === 'string') { if (node.trim()) out.push(node.trim()); return out }
  if (Array.isArray(node)) { node.forEach(child => textDump(child, out)); return out }
  if (node && typeof node === 'object') textDump(node.props?.children, out)
  return out
}
function fail(message, tree) {
  console.error('FAIL:', message)
  if (tree) console.error('rendered text:', JSON.stringify(textDump(tree).slice(0, 30)))
  process.exit(1)
}
const clickTab = (tree, id) => {
  const button = findNode(tree, node => node.type === 'button' && node.props?.['data-tab'] === id)
  if (!button) fail('no tab button for ' + id, tree)
  button.props.onClick()
}
const clickButton = (tree, label) => {
  const button = findNode(tree, node => node.type === 'button' && findText(node.props?.children, label))
  if (!button) fail('no button labelled ' + label, tree)
  button.props.onClick()
}

let tree = renderPanel()
if (!findClass(tree, 'wb-page')) fail('panel did not mount (.wb-page missing)', tree)

// Let the read-only fetches settle, then render again with data present.
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()

// --- tabs: exactly one tab body is rendered ---------------------------------
const tabIds = findAll(tree, n => n.type === 'button' && n.props?.['data-tab']).map(n => n.props['data-tab'])
if (tabIds.join(',') !== 'run,task,history,workspace') fail('tab bar is not run/task/history/workspace: ' + tabIds.join(','), tree)
if (findClass(tree, 'wb-run') === false) fail('run card missing on the run tab (not derived from runs.json)', tree)
if (!findText(tree, '统计 md 行数 top3')) fail('newest run from runs.json not rendered', tree)
// A run whose session this Host lost must say so and offer archiving, not a
// cancellation that cannot possibly work.
if (!findText(tree, 'orphanedChip')) fail('orphaned run not marked in the run card', tree)
if (!includesText(tree, 'orphanedHint')) fail('orphaned run does not explain itself', tree)
if (!findText(tree, 'archiveRun')) fail('orphaned run offers no archive action', tree)
if (findText(tree, 'cancelRun')) fail('orphaned run still offers a cancel that cannot work', tree)
if (findClass(tree, 'wb-compose')) fail('task form leaked into the run tab', tree)
if (findClass(tree, 'wb-report')) fail('report card leaked into the run tab', tree)
if (findClass(tree, 'wb-audit')) fail('audit leaked into the run tab', tree)

// --- task tab: module assembly + session targeting --------------------------
clickTab(tree, 'task')
tree = renderPanel()
if (!findClass(tree, 'wb-compose')) fail('task tab did not render the composer', tree)
if (findClass(tree, 'wb-run')) fail('run card leaked into the task tab', tree)
const goalInput = findNode(tree, n => n.type === 'input' && n.props?.id === 'wb-goal')
if (!goalInput) fail('goal input missing', tree)
// Prefilled from the previous dispatch: the form must not demand retyping.
if (goalInput.props.value !== '统计 md 行数 top3') fail('goal not prefilled from the last run: ' + JSON.stringify(goalInput.props.value))
const sessionSelect = findNode(tree, n => n.type === 'select' && n.props?.id === 'wb-session')
if (!sessionSelect) fail('session target selector missing', tree)
if (!(sessionSelect.props.children || []).some(child => child?.props?.value === 'session-ccc')) {
  fail('sessions from /api/sessions not offered as targets', tree)
}

// Open the module picker on the goal slot and insert a saved module.
const insertButtons = findAll(tree, n => n.type === 'button' && findText(n.props?.children, 'insertModule'))
if (insertButtons.length < 3) fail('each slot should offer a module insert button, got ' + insertButtons.length, tree)
insertButtons[0].props.onClick()
tree = renderPanel()
const picker = findNode(tree, n => n.props?.className?.includes?.('wb-picker'))
if (!picker) fail('module picker did not open', tree)
if (!includesText(picker, '统计行数模块')) fail('saved module not listed in the picker', tree)
const pickerInsert = findNode(picker, n => n.type === 'button' && findText(n.props?.children, 'insertModule'))
if (!pickerInsert) fail('picker has no insert button', tree)
pickerInsert.props.onClick()
tree = renderPanel()
const goalAfterInsert = findNode(tree, n => n.type === 'input' && n.props?.id === 'wb-goal')
if (!String(goalAfterInsert.props.value).includes('模块正文：统计 md 行数并给出 top3')) {
  fail('module text was not inserted into the slot: ' + JSON.stringify(goalAfterInsert.props.value))
}

// Target an existing session, then preview: the request must carry its id.
const sessionAfterRender = findNode(tree, n => n.type === 'select' && n.props?.id === 'wb-session')
sessionAfterRender.props.onChange({ target: { value: 'session-ccc' } })
tree = renderPanel()
const taskForm = findNode(tree, n => n.type === 'form' && typeof n.props?.onSubmit === 'function' && findText(n.props?.children, 'preview'))
if (!taskForm) fail('no preview submit button', tree)
taskForm.props.onSubmit({ preventDefault() {} })
await new Promise(resolve => setTimeout(resolve, 20))
tree = renderPanel()
const dispatchRequest = requests.filter(r => r.path === '/dsh-workbench/api/dispatch').pop()
if (!dispatchRequest) fail('preview did not call the dispatch route', tree)
if (dispatchRequest.body.sessionId !== 'session-ccc') fail('preview did not carry the chosen session: ' + JSON.stringify(dispatchRequest.body))
if (dispatchRequest.body.dryRun !== true) fail('preview was not a dry run: ' + JSON.stringify(dispatchRequest.body))
if (!Array.isArray(dispatchRequest.body.moduleIds) || dispatchRequest.body.moduleIds[0] !== 'mod_1') {
  fail('inserted module was not declared on the dispatch: ' + JSON.stringify(dispatchRequest.body))
}
if (!findText(tree, 'previewReady')) fail('preview confirmation block not rendered', tree)

// --- history tab: digest report, raw text folded ----------------------------
clickTab(tree, 'history')
tree = renderPanel()
if (findClass(tree, 'wb-compose')) fail('task form leaked into the history tab', tree)
if (!findClass(tree, 'wb-runs')) fail('run list missing on the history tab', tree)
// The newest run is selected by default; select the finished one.
const olderRow = findNode(tree, n => n.props?.className?.includes?.('wb-run-row') && n.props?.['data-active'] === 'false')
if (!olderRow) fail('no selectable older run in the history list', tree)
olderRow.props.onClick()
// The report fetch is async: render once to start it, settle, render again.
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 20))
tree = renderPanel()
if (!findClass(tree, 'wb-report')) fail('report card missing after selecting a run', tree)
if (!findText(tree, '历史结论摘要')) fail('report conclusion not rendered', tree)
if (!findText(tree, '要点一')) fail('report points not rendered', tree)
if (!findText(tree, 'D:/out/report.md')) fail('report artifacts not rendered', tree)
if (!findText(tree, '是否继续？')) fail('report pending question not rendered', tree)
// The raw record is a disclosure, never the first thing painted.
const rawDetails = findNode(tree, n => n.type === 'details' && findText(n.props?.children, 'rawReply'))
if (!rawDetails) fail('raw record is not behind a disclosure', tree)
if (!includesText(rawDetails, '上一次运行的回复正文')) fail('raw reply not available inside the disclosure', tree)
if (findText(tree, '上一次运行的回复正文') && !includesText(rawDetails, '上一次运行的回复正文')) {
  fail('raw reply painted outside its disclosure', tree)
}

// --- workspace tab: continuity, decisions, timeline, metrics ----------------
clickTab(tree, 'workspace')
tree = renderPanel()
if (findClass(tree, 'wb-report')) fail('report card leaked into the workspace tab', tree)
if (!findClass(tree, 'wb-continuity')) fail('continuity section missing', tree)
if (!findText(tree, '测试主线')) fail('fetched mainline not rendered', tree)
if (!findClass(tree, 'wb-decision-card')) fail('decisions were not turned into cards', tree)
if (!findText(tree, '面板改成标签页')) fail('decision card title not rendered', tree)
if (!findText(tree, '背景')) fail('decision card did not split its labelled parts', tree)
if (!findClass(tree, 'wb-audit')) fail('audit timeline missing', tree)
if (!findText(tree, 'state.edit')) fail('audit entry not rendered as a readable action', tree)
if (!findClass(tree, 'wb-day')) fail('audit timeline is not grouped by day', tree)
if (!findClass(tree, 'wb-metrics')) fail('metrics missing', tree)
if (!includesText(tree, 'dispatches')) fail('metrics do not report the dispatch count', tree)

// Continuity editor opens inside the workspace tab.
clickButton(tree, 'edit')
tree = renderPanel()
if (!findNode(tree, n => n.type === 'input' && n.props?.id === 'wb-edit-mainline')) fail('continuity editor did not open', tree)

// Sidebar icon must render an svg element.
const iconTree = render(sidebar.renderFn({ size: 24, active: false }))
if (iconTree?.type !== 'svg') fail('sidebar icon not an svg', tree)

console.log('tabs: run/task/history/workspace, one body at a time')
console.log('task tab: prefill ok, module insert ok, session target ok')
console.log('history tab: conclusion/points/artifacts/pending ok, raw folded')
console.log('workspace tab: continuity/decision cards/day-grouped audit/metrics ok')
console.log('sidebar icon:', iconTree.type)
console.log('')
console.log('CLIENT HARNESS PASS')