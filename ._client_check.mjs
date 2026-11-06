// Headless harness for the CLIENT bundle (client.js), v1.0.
// Proves the shape the flow work depends on:
//   1. the panel is a RIGHT-COLUMN tab (no main panel, no panellist icon), so it
//      cannot take the chat column, and it is told which session it renders;
//   2. the moment is derived from data (live run → working; unclosed gap →
//      close out; else attach) and each moment paints one job;
//   3. sync work queues into the bound session through the flow routes, and the
//      channel rule is visible before the click;
//   4. the close-out form writes one record through /api/close;
//   5. the reused views (composer, report, decisions, canvas) still render.

let captured = null
globalThis.window = { __ModuleLoader__: { load: (spec) => { captured = spec } } }

const h = (type, props, ...children) => ({
  type, props: { ...(props || {}), children: children.flat().filter(c => c !== false && c != null) },
})

let hookStates = []
let hookIndex = 0
let pendingCleanups = []
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
  useEffect: (fn) => {
    const cleanup = fn()
    if (typeof cleanup === 'function') pendingCleanups.push(cleanup)
  },
}

// --- mock Host -------------------------------------------------------------
let sessionRunning = true
let memoryGapOpen = false
const requests = []
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
    conclusion: '结论：行数统计完成。',
    points: ['记录 72 行', 'top3 已列出'],
    artifacts: ['D:/AI Pj/_workbench/out/result.md'],
    pending: [],
    stats: { durationMs: 100000, steps: 2, toolCalls: 1, messages: 2 },
    reply: '原始回复正文：全部完成。',
  },
}

let flowBroken = false
let canvasEmpty = false
const mockView = { positions: { n_src: { x: 150, y: 36 } }, zoom: 1 }
function graphPayload() {
  const nodes = [
    {
      id: 'n_src', kind: 'source', title: '资料', inputs: [], outputs: [{ name: 'text', type: 'text' }],
      executor: { kind: 'text', params: { content: '资料正文' } }, verifier: { kind: 'file-contains', contains: '资料' },
      runtime: { executor: 'text', executorLabel: '模板拼装（本地，真跑）', available: true, status: 'green', artifact: 'flow-out/n_src.md', note: 'n_src.md', checkedAt: '2026-11-06T12:00:00.000Z' },
      issues: [], blocked: false,
    },
    {
      id: 'n_cover', kind: 'media', title: '封面图', inputs: [{ name: 'prompt', type: 'text' }], outputs: [{ name: 'image', type: 'image' }],
      executor: { kind: 'image', params: {} }, verifier: { kind: 'file-exists', path: 'cover.png' },
      runtime: { executor: 'image', executorLabel: '模型生图（v1.1 桥，未接）', available: false, status: 'gray', artifact: '', note: '没有 executor：这个节点在 v1.0 里跑不了。', checkedAt: '' },
      issues: [], blocked: false,
    },
  ]
  return {
    ok: true,
    version: 1,
    nodes: canvasEmpty ? [] : nodes,
    edges: canvasEmpty ? [] : [{ id: 'e_1', from: { node: 'n_src', port: 'text' }, to: { node: 'n_cover', port: 'prompt' }, valid: true }],
    validation: {
      ok: !flowBroken,
      issues: flowBroken ? [{ code: 'type-mismatch', edgeId: 'e_2', message: '资料.text 产出 file，而 文本.input 需要 text' }] : [],
      order: ['n_src', 'n_cover'],
    },
    order: ['n_src', 'n_cover'],
    executors: [
      { kind: 'text', label: '模板拼装（本地，真跑）', available: true },
      { kind: 'image', label: '模型生图（v1.1 桥，未接）', available: false },
    ],
    view: { positions: canvasEmpty ? {} : mockView.positions, zoom: canvasEmpty ? 1 : mockView.zoom },
    verifiers: ['file-exists', 'file-contains'],
    fetchedAt: '2026-11-06T12:00:00.000Z',
  }
}

function statePayload() {
  return {
    ok: true,
    state: {
      mainline: '测试主线',
      stopped_at: '停在 P0',
      next: ['保存一次编辑', '查看审计'],
      red_lines: ['不绕过权限'],
      updated: '2026-10-31T00:00:00.000Z',
    },
    decisions: '### 2026-10-31T00:00:00.000Z\n面板改成三时刻\n背景：五个标签谁都不知道该点哪个\n决定：接上/在做/收工\n代价：要按数据自动判时刻',
    tasks: [{ id: 'T-001', status: '绿', goal: '测试任务' }],
    ledger: { rows: [], totalTokens: 0, greenCards: 1 },
    execution: { enabled: true, cwd: 'D:/workspace', controller: true },
    memory: {
      ok: true,
      active: 'abc123',
      root: 'D:/AI Pj/_workbench',
      name: '_workbench',
      memory: {
        key: 'abc123', name: '_workbench', root: 'D:/AI Pj/_workbench',
        mainline: 'v1.0：会话接续层 + 装配层', stopped_at: 'Phase A 已提交',
        next: ['Phase B 面板进右栏'], red_lines: ['判断不下放'], decisions: [],
        outcome: '', openedAt: '2026-11-06T10:00:00.000Z', closedAt: '2026-11-06T11:05:00.000Z',
        gap: { open: memoryGapOpen, finishedAfterClose: memoryGapOpen ? 2 : 0, note: memoryGapOpen ? '其后还有 2 次运行完成' : '' },
      },
    },
    fetchedAt: '2026-10-31T00:00:00.000Z',
  }
}

globalThis.fetch = async (raw, options) => {
  const path = String(raw).split('?')[0]
  const body = options?.body ? JSON.parse(options.body) : null
  requests.push({ path, url: String(raw), method: options?.method || 'GET', body })
  const ok = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload })

  if (path === '/dsh-workbench/api/state-v2') return ok(statePayload())
  if (path === '/dsh-workbench/api/models') return ok({
    ok: true, available: true,
    groups: [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-flash', name: 'Flash' }] }],
    current: { provider: 'deepseek-official', model: 'deepseek-flash' },
  })
  if (path === '/dsh-workbench/api/audit') return ok({
    ok: true,
    entries: [
      { ts: '2026-10-31T10:00:03.000Z', action: 'dispatch.start', summary: 'session session-aaa · 统计 md 行数 top3' },
      { ts: '2026-10-31T10:00:09.000Z', action: 'state.edit', summary: 'mainline' },
    ],
  })
  if (path === '/dsh-workbench/api/runs') return ok({
    ok: true,
    items: [
      {
        runId: 'run_A', sessionId: 'session-aaa', goal: '统计 md 行数 top3',
        model: 'deepseek-flash', status: sessionRunning ? 'running' : 'done', cwd: 'D:/AI Pj',
        createdAt: 1793944774996, updatedAt: 1793944774996, steps: 6, toolCalls: 11,
        orphaned: true,
      },
      {
        runId: 'run_C', sessionId: 'session-ggg', goal: '裸派发的历史任务',
        model: 'deepseek-flash', status: 'done', cwd: 'D:/AI Pj',
        createdAt: 1793943000000, updatedAt: 1793943100000,
      },
      {
        runId: 'run_B', sessionId: 'session-bbb', goal: '上一条已完成的任务',
        model: 'deepseek-flash', status: 'done', cwd: 'D:/AI Pj', plan: '步骤B', instruction: '注意B',
        templateId: 'tpl_1', templateTitle: '行数巡检模板',
        createdAt: 1793944000000, updatedAt: 1793944100000, reply: '上一次运行的回复正文',
      },
    ],
  })
  if (path === '/dsh-workbench/api/sessions') return ok({
    ok: true, available: true,
    items: [
      { sessionId: 'session-aaa', title: '正在跑的会话', running: sessionRunning, blank: false, updatedAt: 1793944774996 },
      { sessionId: 'session-ccc', title: '', running: false, blank: false, updatedAt: 1793944000000 },
    ],
  })
  if (path === '/dsh-workbench/api/modules') return ok({
    ok: true,
    items: [{ id: 'mod_1', kind: 'goal', title: '统计行数模块', text: '模块正文：统计 md 行数并给出 top3', uses: 2 }],
  })
  if (path === '/dsh-workbench/api/templates') return ok({
    ok: true,
    items: [{
      id: 'tpl_1', title: '行数巡检模板', goal: '模板目标：统计 md 行数 top3',
      plan: '模板计划：先扫描再排序', instruction: '模板指令：只读不改文件',
      moduleIds: ['mod_2'], model: 'deepseek-official/deepseek-flash', sessionMode: 'new', uses: 4,
    }, {
      id: 'tpl_fly', title: '飞轮推荐模板', goal: '飞轮目标：写一段周报摘要',
      plan: '', instruction: '', moduleIds: [], model: '', sessionMode: 'new', uses: 3,
    }],
  })
  if (path === '/dsh-workbench/api/live') return ok({
    ok: true, sessionId: 'session-aaa', running: sessionRunning,
    steps: 6, toolCalls: 11, messages: 3, waiting: false,
    lastText: '当前会话的最后一段回复。', turnEnd: 'end_turn',
  })
  if (path === '/dsh-workbench/api/report') {
    const runId = new URL(String(raw), 'http://127.0.0.1').searchParams.get('runId') || 'run_A'
    const payload = reports[runId]
    return payload ? ok(payload) : ok({ ok: false, error: '没有这次运行的记录' }, 404)
  }
  if (path === '/dsh-workbench/api/channel') {
    const text = String(body?.text || '')
    const long = /(生成|生|画|出|做)[^，。！？\n]{0,6}(图|封面|视频)/.test(text) || /批量|重构/.test(text)
    return ok({
      ok: true, channel: long ? 'async' : 'sync', maxMinutes: 2,
      reasons: long ? ['文字里有长活信号「生成」：要外部生成（图/视频）', '改为派一条长活（独立会话），当前会话不被长时间占用'] : ['不超过 2 分钟的短活', '留在当前会话里接着做：同一个会话、同一段历史'],
      decidedAt: '2026-10-31T00:00:00.000Z',
    })
  }
  if (path === '/dsh-workbench/api/sync') return ok({
    ok: true, sessionId: body?.sessionId, requestId: 'req_sync_1', channel: 'sync',
    reasons: ['不超过 2 分钟的短活'], acceptedAt: '2026-10-31T00:00:00.000Z',
  })
  if (path === '/dsh-workbench/api/close') return ok({
    ok: true, closedAt: '2026-10-31T12:00:00.000Z', outcome: body?.outcome || 'yellow',
    next: [String(body?.next || '')], decisionAppended: Boolean(body?.decision),
    project: { key: 'abc123', root: 'D:/AI Pj/_workbench', name: '_workbench' },
    agents: { ok: true, bytes: 900 }, gap: { open: false },
  })
  if (path === '/dsh-workbench/api/memory') return ok({ ok: true, active: 'abc123', memory: statePayload().memory.memory })
  if (path === '/dsh-workbench/api/flywheel') return ok({
    ok: true,
    cards: [],
    candidates: [{
      id: 'tpl_fly', title: '飞轮推荐模板', green: 3, red: 0, greenRate: 1,
      costPerGreen: { input: 750, output: 150, cacheRead: 200, cacheWrite: 50 },
      reuseAfterPromotion: 2, because: '3 绿 / 0 红 · 绿率 100%',
    }, {
      id: 'tpl_gone_now', title: '已消失的模板', green: 2, red: 0, greenRate: 1,
      costPerGreen: null, reuseAfterPromotion: 2, because: '2 绿 / 0 红 · 绿率 100%',
    }],
    rules: { promote: '2 green', demote: '1 red', decay: '30 days', cost: 'per green' },
    totals: { templates: 2, recorded: 5, promoted: 2, demoted: 0, archived: 0 },
    fetchedAt: '2026-11-06T12:00:00.000Z',
  })
  if (path === '/dsh-workbench/api/flow') return ok(graphPayload())
  if (path === '/dsh-workbench/api/flow/run') {
    const payload = graphPayload()
    payload.nodes[0].runtime.status = 'green'
    return ok({
      ok: true,
      results: [
        { nodeId: 'n_src', status: 'green', artifact: 'flow-out/n_src.md' },
        { nodeId: 'n_cover', status: 'gray', artifact: '' },
      ],
      flow: payload,
    })
  }
  if (path === '/dsh-workbench/api/flow/view/save') {
    if (body?.arrange === true) mockView.positions = {}
    if (body?.positions && typeof body.positions === 'object') mockView.positions = { ...mockView.positions, ...body.positions }
    if (body?.zoom !== undefined) mockView.zoom = Number(body.zoom)
    return ok({ ok: true, version: 1, positions: mockView.positions, zoom: mockView.zoom })
  }
  if (path === '/dsh-workbench/api/flow/demo') {
    canvasEmpty = false
    return ok({ ok: true, seeded: true, flow: graphPayload() })
  }
  if (path === '/dsh-workbench/api/flow/node') {
    const payload = graphPayload()
    payload.nodes.push({
      id: 'n_added', kind: 'step', title: String(body?.title || ''),
      inputs: [], outputs: [{ name: 'out', type: 'text' }],
      executor: { kind: 'text', params: { content: '' } }, verifier: { kind: 'file-exists', path: '' },
      runtime: { executor: 'text', executorLabel: '模板拼装（本地，真跑）', available: true, status: 'idle', artifact: '', note: '', checkedAt: '' },
      issues: [], blocked: false,
    })
    payload.edges.push({ id: 'e_2', from: { node: 'n_added', port: 'out' }, to: { node: 'n_src', port: 'in' }, valid: true })
    return ok(payload)
  }
  if (path === '/dsh-workbench/api/flow/edge') return ok(graphPayload())
  if (path === '/dsh-workbench/api/flow/node/delete') return ok(graphPayload())
  if (path === '/dsh-workbench/api/flow/edge/delete') return ok(graphPayload())
  if (path === '/dsh-workbench/api/flow/verify') {
    return ok({ ok: true, results: [{ nodeId: 'n_src', status: 'green' }], flow: graphPayload() })
  }
  if (path === '/dsh-workbench/api/dispatch') {
    return ok({
      ok: true, dryRun: body?.dryRun === true, available: true, executionEnabled: true,
      prompt: '[DSH Workbench 任务]\n目标：' + String(body?.goal || ''), cwd: 'D:/workspace',
      model: body?.model || '', sessionMode: body?.sessionId ? 'existing' : 'new', sessionId: body?.sessionId || '',
    })
  }
  return ok({ ok: false, error: 'no mock for ' + path }, 404)
}

await import(new URL('./client.js', import.meta.url).href)

if (!captured) { console.error('FAIL: client did not call __ModuleLoader__.load'); process.exit(1) }
const bundle = captured.factory(() => React)
if (!bundle || !bundle.apply) { console.error('FAIL: bundle factory returned no apply'); process.exit(1) }

const registrations = []
const tabTypes = []
let currentSlot = null
const ctx = {
  effect: (fn) => { try { fn() } catch {}; return () => {} },
  locale: { register: () => {}, bind: () => (k) => String(k) },
  sidebarRightTabs: { register: (definition) => { tabTypes.push(definition); return () => {} } },
  slots: {
    inject: (name, thunk) => { const previous = currentSlot; currentSlot = name; try { thunk() } finally { currentSlot = previous } },
    register: (spec, renderFn) => { registrations.push({ slot: currentSlot, spec, renderFn }) },
  },
}

bundle.apply(ctx)

function fail(message, tree) {
  console.error('FAIL:', message)
  if (tree) console.error('rendered text:', JSON.stringify(textDump(tree).slice(0, 40)))
  process.exit(1)
}
function render(el) {
  if (!el || typeof el !== 'object') return el
  if (typeof el.type === 'function') return render(el.type(el.props || {}))
  const kids = Array.isArray(el.props?.children) ? el.props.children.map(render) : el.props?.children
  return { ...el, props: { ...el.props, children: kids } }
}
function renderPanel(sessionId = 'session-aaa') {
  for (const cleanup of pendingCleanups.splice(0)) { try { cleanup() } catch { /* ignore */ } }
  hookIndex = 0
  return render(body.renderFn({ sessionId }))
}
function findAll(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out
  if (predicate(node)) out.push(node)
  const kids = node.props?.children
  if (Array.isArray(kids)) kids.forEach(kid => findAll(kid, predicate, out))
  return out
}
const findClass = (node, cls) => findAll(node, n => String(n.props?.className || '').includes(cls)).length > 0
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
const momentOf = tree => findAll(tree, n => n.type === 'button' && n.props?.['data-moment'])
const activeMoment = tree => (momentOf(tree).find(n => n.props['data-active'] === 'true') || {}).props?.['data-moment']
const clickMoment = (tree, id) => {
  const button = momentOf(tree).find(node => node.props['data-moment'] === id)
  if (!button) fail('no moment button ' + id, tree)
  button.props.onClick()
}
const clickButton = (tree, label) => {
  const button = findNode(tree, node => node.type === 'button' && findText(node.props?.children, label))
  if (!button) fail('no button labelled ' + label, tree)
  button.props.onClick()
}
const setTextarea = (tree, id, value) => {
  const field = findNode(tree, n => n.type === 'textarea' && n.props?.id === id)
  if (!field) fail('no textarea ' + id, tree)
  field.props.onChange({ target: { value } })
}

// --- 1. registration: right column tab, session-scoped body ----------------
const body = registrations.find(r => r.slot === 'sidebar.right.pane.tab' && r.spec?.key === 'dsh-workbench/workbench')
if (!body) fail('no sidebar.right.pane.tab body for dsh-workbench/workbench: ' + JSON.stringify(registrations.map(r => [r.slot, r.spec?.key || r.spec?.id])))
if (!tabTypes.length || tabTypes[0].kind !== 'workbench') fail('no workbench tab type registered')
if (tabTypes[0].priority !== 'extension') fail('workbench tab type must claim the extension band: ' + tabTypes[0].priority)
if (!Array.isArray(tabTypes[0].guide) || tabTypes[0].guide[0].id !== 'workbench') fail('no guide entry for the workbench tab')
if (registrations.some(r => r.slot === 'main')) fail('the panel still registers a main slot (it would take the chat column)')
if (registrations.some(r => r.slot === 'sidebar.panellist')) fail('the panel still registers a left-sidebar entry for a main panel that no longer exists')
const injected = body.spec.inject('session-zzz')
if (injected?.sessionId !== 'session-zzz') fail('tab body did not receive its session id: ' + JSON.stringify(injected))
console.log('registration: right-column tab type + guide entry, session-scoped body, no main panel')

// --- 2. auto moment: a live run wins --------------------------------------
// First paint mounts and fires the read-only fetches; the second paint is the
// one that can see data.
let tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
if (!findClass(tree, 'wb-page')) fail('panel did not mount (.wb-page missing)', tree)
const moments = momentOf(tree).map(node => node.props['data-moment'])
if (moments.slice(0, 3).join(',') !== 'attach,work,close') fail('moment bar is not attach/work/close: ' + moments.join(','), tree)
if (activeMoment(tree) !== 'work') fail('a live run must open the working moment: ' + activeMoment(tree), tree)
if (!findClass(tree, 'wb-run')) fail('working moment did not paint the run card', tree)
if (!findText(tree, '统计 md 行数 top3')) fail('newest run from runs.json not rendered', tree)
if (!findText(tree, 'orphanedChip')) fail('orphaned run not marked in the run card', tree)
if (findText(tree, 'cancelRun')) fail('orphaned run still offers a cancel that cannot work', tree)
if (findClass(tree, 'wb-live') === false) fail('working moment did not paint the current session', tree)
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
console.log('LIVE-PATH', JSON.stringify(findAll(tree, n => n.props?.className === 'wb-live').length), JSON.stringify(requests.filter(r => r.path === '/dsh-workbench/api/live').length))
if (!includesText(tree, '当前会话的最后一段回复。')) fail('live reply not available', tree)
// the graph is painted from the Host's validation, colours included
if (!findClass(tree, 'wb-flow')) fail('working moment did not paint the node graph', tree)
if (!findText(tree, '资料') || !findText(tree, '封面图')) fail('graph nodes missing from the canvas', tree)
if (!findClass(tree, 'wb-graph-stage')) fail('the canvas stage is not painted', tree)
const drawnEdges = findAll(tree, n => String(n.props?.className || '').includes('wb-graph-line'))
if (drawnEdges.length !== 1) fail('expected one drawn connection, got ' + drawnEdges.length, tree)
if (!drawnEdges[0].props?.d || !String(drawnEdges[0].props.d).startsWith('M')) fail('the connection has no path', tree)
const greenNode = findNode(tree, n => String(n.props?.className || '').includes('wb-graph-node') && n.props?.['data-status'] === 'green')
if (!greenNode) fail('verified node is not painted green', tree)
const grayNode = findNode(tree, n => String(n.props?.className || '').includes('wb-graph-node') && n.props?.['data-status'] === 'gray')
if (!grayNode) fail('a node without an executor must stay gray', tree)
if (!includesText(grayNode, '没有 executor')) fail('gray node does not say why it cannot run', tree)
const runGraphButton = findNode(tree, n => n.type === 'button' && findText(n.props?.children, 'flowRun'))
if (!runGraphButton) fail('no run-graph button', tree)
if (runGraphButton.props.disabled) fail('a valid graph should be runnable')
const beforeGraphRun = requests.length
runGraphButton.props.onClick()
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 30))
tree = renderPanel()
const graphRunCall = requests.slice(beforeGraphRun).find(r => r.path === '/dsh-workbench/api/flow/run')
if (!graphRunCall) fail('run graph did not call the run route')
if (graphRunCall.body.confirm !== true) fail('the graph ran without explicit confirm: ' + JSON.stringify(graphRunCall.body))
if (!includesText(tree, 'flowRan')) fail('graph run result not reported', tree)
if (findClass(tree, 'wb-sync')) fail('attach form leaked into the working moment', tree)
if (findClass(tree, 'wb-close')) fail('close form leaked into the working moment', tree)
// authoring: the canvas is not a museum — a node and a connection can be built here
const titleField = findNode(tree, n => n.type === 'input' && n.props?.id === 'wb-node-title')
if (!titleField) fail('no add-node title field', tree)
titleField.props.onChange({ target: { value: '新加的一步' } })
tree = renderPanel()
const beforeAddNode = requests.length
clickButton(tree, 'graphAddNode')
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
const nodePost = requests.slice(beforeAddNode).find(r => r.path === '/dsh-workbench/api/flow/node' && r.method === 'POST')
if (!nodePost) fail('add node did not call the node route')
if (nodePost.body.title !== '新加的一步') fail('node title not posted: ' + JSON.stringify(nodePost.body))
if (!includesText(tree, 'graphAdded')) fail('node creation not reported', tree)
const fromSelect = findNode(tree, n => n.type === 'select' && n.props?.id === 'wb-edge-from')
const toSelect = findNode(tree, n => n.type === 'select' && n.props?.id === 'wb-edge-to')
if (!fromSelect || !toSelect) fail('no connect form on a canvas with two or more nodes', tree)
fromSelect.props.onChange({ target: { value: 'n_src' } })
tree = renderPanel()
findNode(tree, n => n.type === 'select' && n.props?.id === 'wb-edge-to').props.onChange({ target: { value: 'n_cover' } })
tree = renderPanel()
const beforeEdge = requests.length
clickButton(tree, 'graphAddEdge')
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
const edgePost = requests.slice(beforeEdge).find(r => r.path === '/dsh-workbench/api/flow/edge' && r.method === 'POST')
if (!edgePost) fail('connect did not call the edge route')
if (edgePost.body.from?.node !== 'n_src' || edgePost.body.to?.node !== 'n_cover') fail('edge endpoints not posted: ' + JSON.stringify(edgePost.body))
if (!includesText(tree, 'graphEdgeAdded')) fail('edge creation not reported', tree)
// view state: a saved position wins over the computed slot
const placedNode = findNode(tree, n => n.props?.['data-node'] === 'n_src')
if (!placedNode) fail('no card carries its node id', tree)
if (placedNode.props.style.left !== '150px' || placedNode.props.style.top !== '36px') {
  fail('saved position not honoured: ' + JSON.stringify(placedNode.props.style))
}

// drag: pointerdown records the grab, pointermove moves that card, pointerup saves
placedNode.props.onPointerDown({ button: 0, clientX: 100, clientY: 100, preventDefault() {} })
tree = renderPanel()
const dragStage = findNode(tree, n => String(n.props?.className || '').includes('wb-graph-stage'))
if (!dragStage) fail('no drop surface after grabbing a card', tree)
if (dragStage.props['data-dragging'] !== 'true') fail('the canvas does not know a card is grabbed', tree)
dragStage.props.onPointerMove({ clientX: 160, clientY: 130 })
tree = renderPanel()
const draggedNode = findNode(tree, n => n.props?.['data-node'] === 'n_src')
if (draggedNode.props.style.left !== '210px' || draggedNode.props.style.top !== '66px') {
  fail('the card did not follow the pointer: ' + JSON.stringify(draggedNode.props.style))
}
const beforeViewSave = requests.length
findNode(tree, n => String(n.props?.className || '').includes('wb-graph-stage')).props.onPointerUp({})
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
const viewSaveCall = requests.slice(beforeViewSave).find(r => r.path === '/dsh-workbench/api/flow/view/save')
if (!viewSaveCall) fail('dropping a card did not ask the Host to remember it')
if (viewSaveCall.body.positions?.n_src?.x !== 210 || viewSaveCall.body.positions?.n_src?.y !== 66) {
  fail('the saved position is not the dropped one: ' + JSON.stringify(viewSaveCall.body))
}
if (findNode(tree, n => String(n.props?.className || '').includes('wb-graph-stage')).props['data-dragging'] !== 'false') {
  fail('the canvas still thinks a card is grabbed after the drop', tree)
}

// zoom keeps working and is remembered
const beforeZoom = requests.length
clickButton(tree, '+')
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
const zoomCall = requests.slice(beforeZoom).find(r => r.path === '/dsh-workbench/api/flow/view/save')
if (!zoomCall || Math.abs(Number(zoomCall.body.zoom) - 1.2) > 0.001) fail('zoom did not reach the Host: ' + JSON.stringify(zoomCall?.body))
if (!findText(tree, '120%')) fail('the zoom level is not shown', tree)

// arrange drops the saved positions and falls back to the computed layout
const beforeArrange = requests.length
clickButton(tree, 'graphArrange')
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
const arrangeCall = requests.slice(beforeArrange).find(r => r.path === '/dsh-workbench/api/flow/view/save')
if (!arrangeCall || arrangeCall.body.arrange !== true) fail('tidy up did not tell the Host to drop positions')
const rearranged = findNode(tree, n => n.props?.['data-node'] === 'n_src')
if (rearranged.props.style.left !== '6px') fail('tidy up did not fall back to the computed layout: ' + JSON.stringify(rearranged.props.style))
mockView.positions = { n_src: { x: 150, y: 36 } }
console.log('view: saved position honoured | drag follows the pointer and saves | zoom shows and saves | tidy up returns to the computed layout')

// first run on an empty canvas: only the example can make it green, so it must be offered
canvasEmpty = true
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
if (!includesText(tree, 'graphEmpty')) fail('empty canvas does not offer the example', tree)
const demoButton = findNode(tree, n => n.type === 'button' && findText(n.props?.children, 'graphDemo'))
if (!demoButton) fail('no load-example button on an empty canvas', tree)
if (demoButton.props.disabled) fail('load-example must be enabled on an empty canvas')
const beforeDemo = requests.length
demoButton.props.onClick()
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 25))
tree = renderPanel()
if (!requests.slice(beforeDemo).some(r => r.path === '/dsh-workbench/api/flow/demo')) fail('load-example did not call the demo route')
if (!includesText(tree, 'graphDemoDone')) fail('example load not reported', tree)
if (!findText(tree, '资料') || !findText(tree, '封面图')) fail('the example did not repaint the canvas', tree)
canvasEmpty = false
console.log('moment: live run → working, orphan flagged, live session painted, other moments absent')

// --- 3. working → attach: memory is the first thing on screen --------------
clickMoment(tree, 'attach')
tree = renderPanel()
if (activeMoment(tree) !== 'attach') fail('attach moment not selected', tree)
if (!findClass(tree, 'wb-memory')) fail('attach moment did not paint the project memory', tree)
if (!includesText(tree, 'v1.0：会话接续层 + 装配层')) fail('memory mainline missing', tree)
if (!includesText(tree, 'D:/AI Pj/_workbench')) fail('memory project root missing', tree)
if (!findClass(tree, 'wb-sync')) fail('attach moment did not paint the task box', tree)
if (findClass(tree, 'wb-run')) fail('run card leaked into the attach moment', tree)
if (findClass(tree, 'wb-close')) fail('close form leaked into the attach moment', tree)
// the canvas must be reachable from where a fresh session actually opens
const door = findNode(tree, n => n.type === 'button' && findText(n.props?.children, 'graphDoor'))
if (!findClass(tree, 'wb-canvas-door') || !door) fail('attach moment has no way into the canvas', tree)
door.props.onClick()
tree = renderPanel()
if (activeMoment(tree) !== 'work') fail('the canvas door did not switch to the working moment', tree)
if (!findClass(tree, 'wb-graph-stage')) fail('the canvas door opened a moment without the canvas', tree)
// go back: the attach assertions that follow still need the attach moment
clickMoment(tree, 'attach')
tree = renderPanel()


// typing asks the Host what channel this work belongs to
setTextarea(tree, 'wb-sync-text', '把那段话改短一点')
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 400))
tree = renderPanel()
const channelCall = requests.filter(r => r.path === '/dsh-workbench/api/channel').pop()
if (!channelCall || channelCall.body.text !== '把那段话改短一点') fail('typing did not ask the channel route: ' + JSON.stringify(requests.map(r => r.path)))
const channelChip = findAll(tree, n => n.props?.['data-channel'])[0]
if (!channelChip || channelChip.props['data-channel'] !== 'sync') fail('channel chip did not show sync: ' + JSON.stringify(channelChip?.props))
const syncButton = findNode(tree, n => n.type === 'button' && findText(n.props?.children, 'syncGo'))
if (!syncButton) fail('no sync button', tree)
if (syncButton.props.disabled) fail('sync button disabled for a short task')

// the sync click must name the session the slot injected
const before = requests.length
clickButton(tree, 'syncGo')
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 400))
tree = renderPanel()
const syncCall = requests.slice(before).find(r => r.path === '/dsh-workbench/api/sync')
if (!syncCall) fail('sync click did not call the sync route')
if (syncCall.body.sessionId !== 'session-aaa') fail('sync did not target the injected session: ' + JSON.stringify(syncCall.body))
if (syncCall.body.text !== '把那段话改短一点') fail('sync did not carry the task text')
if (!includesText(tree, 'syncQueued')) fail('sync success not reported', tree)
console.log('sync: channel rule shown before the click, prompt queued into the injected session')

// a long task is refused in place and the dispatch form opens by itself
setTextarea(tree, 'wb-sync-text', '帮我生一张封面图')
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 400))
tree = renderPanel()
const asyncChip = findAll(tree, n => n.props?.['data-channel'])[0]
if (asyncChip?.props['data-channel'] !== 'async') fail('generation task not classified async: ' + JSON.stringify(asyncChip?.props))
const asyncButton = findNode(tree, n => n.type === 'button' && findText(n.props?.children, 'syncGo'))
if (!asyncButton?.props.disabled) fail('sync button still enabled for long work')
if (!findClass(tree, 'wb-compose')) fail('long work did not open the dispatch form', tree)
console.log('channel: long work is refused in place and the dispatch form opens')

// the flywheel recommends, and one click puts the recipe back in the form
if (!findClass(tree, 'wb-fly')) fail('attach moment did not render the flywheel card', tree)
if (!includesText(tree, '飞轮推荐模板')) fail('a promoted candidate is not listed', tree)
if (!includesText(tree, '3 绿 / 0 红')) fail('the candidate does not say why it is recommended', tree)
if (!includesText(tree, '750 in / 150 out')) fail('per-green cost not shown', tree)
if (!includesText(tree, 'flyCostUnknown')) fail('an unknown cost must say unknown instead of a number', tree)
const resumeButton = findNode(tree, n => n.type === 'button' && n.props?.className === 'wb-mini' && findText(n.props?.children, 'flyResume'))
if (!resumeButton) fail('no continue button on the recommendation', tree)
resumeButton.props.onClick()
tree = renderPanel()
const flyGoal = findNode(tree, n => n.type === 'input' && n.props?.id === 'wb-goal')
if (!flyGoal || flyGoal.props.value !== '飞轮目标：写一段周报摘要') fail('continue did not fill the form from the template', tree)
if (!includesText(tree, 'flyFilled')) fail('continue did not confirm', tree)
const goneButton = findNode(tree, n => n.type === 'button' && n.props?.className === 'wb-mini' && findText(n.props?.children, 'flyResume'))
if (!goneButton) fail('second candidate has no continue button')
const allResume = []
const walk = node => {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { node.forEach(walk); return }
  if (node.type === 'button' && findText(node.props?.children, 'flyResume')) allResume.push(node)
  walk(node.props?.children)
}
walk(tree)
allResume[allResume.length - 1].props.onClick()
tree = renderPanel()
if (!includesText(tree, 'flyMissing')) fail('a candidate whose template vanished must say so', tree)

// --- 4. the reused composer still assembles from a module and a template ---
const templateSelect = findNode(tree, n => n.type === 'select' && n.props?.id === 'wb-template')
if (!templateSelect) fail('template selector missing in the dispatch form', tree)
const templateOption = templateSelect.props.children.find(child => child?.props?.value === 'tpl_1')
if (!templateOption) fail('templates from /api/templates not offered', tree)
templateSelect.props.onChange({ target: { value: 'tpl_1' } })
tree = renderPanel()
const goalInput = findNode(tree, n => n.type === 'input' && n.props?.id === 'wb-goal')
if (!goalInput) fail('goal input missing', tree)
if (goalInput.props.value !== '模板目标：统计 md 行数 top3') fail('template did not fill the goal slot: ' + JSON.stringify(goalInput.props.value), tree)
// Insertion is a slot tool: open the picker on the goal slot, then take the
// module. A saved module must not require retyping what it already holds.
const goalSlot = findNode(tree, n => n.props?.htmlFor === 'wb-goal')
if (!goalSlot) fail('goal slot label missing', tree)
const openPicker = findAll(tree, n => n.type === 'button' && n.props?.className === 'wb-mini' && findText(n.props?.children, 'insertModule'))[0]
if (!openPicker) fail('no module tool on the goal slot', tree)
openPicker.props.onClick()
tree = renderPanel()
const insertOne = findAll(tree, n => n.type === 'button' && n.props?.className === 'wb-mini' && findText(n.props?.children, 'insertModule'))[1]
if (!insertOne) fail('module picker did not list the saved module', tree)
insertOne.props.onClick()
tree = renderPanel()
const goalFromModule = findNode(tree, n => n.type === 'input' && n.props?.id === 'wb-goal')
if (!String(goalFromModule.props.value).includes('统计 md 行数并给出 top3')) fail('module did not fill the goal slot', tree)
console.log('flywheel: promoted candidate with reason + per-green cost, unknown cost says unknown, continue refills the form, a vanished template says so')
console.log('graph: verified green, no-executor gray, run carries confirm:true, refused graph cannot run')
console.log('composer: template fills the slots, module insertion still works')

// --- 5. close-out: one form, one write ------------------------------------
clickMoment(tree, 'close')
tree = renderPanel()
if (activeMoment(tree) !== 'close') fail('close moment not selected', tree)
if (!findClass(tree, 'wb-close')) fail('close moment did not paint the close form', tree)
if (!findClass(tree, 'wb-report')) fail('close moment did not paint the run report', tree)
if (findClass(tree, 'wb-sync')) fail('task box leaked into the close moment', tree)
// Each control is a fresh render, exactly like a human editing one field at a
// time; a single render would keep re-spreading a stale draft object.
setTextarea(tree, 'wb-close-next', '重启后按清单验收')
tree = renderPanel()
const outcomeSelect = findNode(tree, n => n.type === 'select' && n.props?.id === 'wb-close-outcome')
if (!outcomeSelect) fail('outcome selector missing', tree)
outcomeSelect.props.onChange({ target: { value: 'green' } })
tree = renderPanel()
const titleInput = findNode(tree, n => n.type === 'input' && n.props?.id === 'wb-close-title')
if (!titleInput) fail('decision title field missing', tree)
titleInput.props.onChange({ target: { value: '收工要一次写完' } })
tree = renderPanel()
setTextarea(tree, 'wb-close-decision', '决定：面板收工只写一次。')
tree = renderPanel()
const draftCheck = findNode(tree, n => n.type === 'textarea' && n.props?.id === 'wb-close-next')
if (draftCheck.props.value !== '重启后按清单验收') fail('editing a later field wiped the next step', tree)
const beforeClose = requests.length
clickButton(tree, 'closeSubmit')
tree = renderPanel()
await new Promise(resolve => setTimeout(resolve, 400))
tree = renderPanel()
const closeCall = requests.slice(beforeClose).find(r => r.path === '/dsh-workbench/api/close')
if (!closeCall) fail('close submit did not call the close route')
if (closeCall.body.next !== '重启后按清单验收') fail('close did not carry the next step: ' + JSON.stringify(closeCall.body))
if (closeCall.body.outcome !== 'green') fail('close did not carry the outcome colour: ' + JSON.stringify(closeCall.body))
if (closeCall.body.title !== '收工要一次写完') fail('close did not carry the decision title: ' + JSON.stringify(closeCall.body))
if (closeCall.body.runId !== 'run_A') fail('close did not name the run it closes: ' + JSON.stringify(closeCall.body))
if (!includesText(tree, 'closeDone')) fail('close success not reported', tree)
// The outcome colour is a claim, so the form must let the user pick each one.
const outcomeOptions = outcomeSelect.props.children.map(child => child.props.value)
if (outcomeOptions.join(',') !== 'green,yellow,red') fail('outcome selector is not green/yellow/red: ' + outcomeOptions.join(','))
console.log('close: one form writes next + outcome + decision through /api/close')

// --- 6. auto moment from the gap; and no session means no sync ------------
// A fresh mount paints loading first, then the data; two paints per case.
const remount = async sessionId => {
  for (const cleanup of pendingCleanups.splice(0)) { try { cleanup() } catch { /* ignore */ } }
  hookStates = []
  renderPanel(sessionId)
  await new Promise(resolve => setTimeout(resolve, 25))
  return renderPanel(sessionId)
}

sessionRunning = false
memoryGapOpen = true
tree = await remount()
if (activeMoment(tree) !== 'close') fail('an unclosed gap must open the close moment: ' + activeMoment(tree), tree)
memoryGapOpen = false
tree = await remount()
if (activeMoment(tree) !== 'attach') fail('a closed project with no run must open attach: ' + activeMoment(tree), tree)
tree = await remount('')
if (!includesText(tree, 'sessionMissing')) fail('a panel without a session must say so', tree)
const orphanSync = findNode(tree, n => n.type === 'button' && findText(n.props?.children, 'syncGo'))
if (!orphanSync?.props.disabled) fail('sync must be disabled without a session')
// a graph the Host refused cannot be run, and the reason is on screen
sessionRunning = true
flowBroken = true
tree = await remount()
if (activeMoment(tree) !== 'work') fail('a live run must still open the working moment with a broken graph')
const brokenButton = findNode(tree, n => n.type === 'button' && findText(n.props?.children, 'flowRun'))
if (!brokenButton) fail('graph section vanished on a broken graph', tree)
if (!brokenButton.props.disabled) fail('a refused graph still offered a run button', tree)
if (!findClass(tree, 'wb-warn-note')) fail('the refused edge reason is not on screen', tree)
flowBroken = false
sessionRunning = false
// remount again so the live-poll interval from the working moment is cleaned up
tree = await remount()

console.log('moment: gap → close out, closed → attach; no session disables sync and says why')
console.log('graph: a refused graph cannot be run and shows the edge reason')

console.log('\nCLIENT HARNESS PASS')

// The panel keeps a poll interval alive for the moment it shows, so a test
// process would sit there after every assertion has passed. Leaving explicitly
// keeps the exit code honest: only the assertions above can fail this run.
const stragglers = process._getActiveHandles().filter(handle => handle.constructor?.name === 'Timeout').length
if (stragglers > 0) console.log('note: ' + stragglers + ' panel poll timer(s) still armed; the test exits instead of waiting')
process.exit(0)