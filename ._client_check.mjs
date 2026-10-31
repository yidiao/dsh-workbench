// Headless harness for the CLIENT bundle (client.js).
// Proves the bundle registers a 'sidebar.panellist' entry with id 'dsh-workbench'
// AND that the 'main' panel mounts, fetches its read-only payloads, renders the
// continuity editor and audit trail, and that opening the editor produces the
// expected form controls.

let captured = null
globalThis.window = { __ModuleLoader__: { load: (spec) => { captured = spec } } }

const h = (type, props, ...children) => ({
  type, props: { ...(props || {}), children: children.flat().filter(c => c !== false && c != null) },
})

// Minimal hook runtime: useState keeps values between manual renders, so the
// panel can be rendered once (loading), allowed to settle, then rendered again
// with fetched data.
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
    decisions: '### 2026-10-31\n决策一',
    tasks: [{ id: 'T-001', status: '绿', goal: '测试任务' }],
    ledger: { rows: [], totalTokens: 0, greenCards: 1 },
    fetchedAt: '2026-10-31T00:00:00.000Z',
  },
  '/dsh-workbench/api/models': {
    ok: true,
    available: true,
    groups: [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-flash', name: 'Flash' }] }],
    current: { provider: 'deepseek-official', model: 'deepseek-flash' },
  },
  '/dsh-workbench/api/audit': {
    ok: true,
    entries: [{ ts: '2026-10-31T00:00:00.000Z', action: 'state.edit', summary: 'mainline' }],
  },
}
globalThis.fetch = async (url) => {
  const path = String(url).split('?')[0]
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
  if (typeof el.type === 'function') {
    const out = el.type(el.props || {})
    return render(out)
  }
  const kids = Array.isArray(el.props?.children) ? el.props.children.map(render) : el.props?.children
  return { ...el, props: { ...el.props, children: kids } }
}

function renderPanel() {
  hookIndex = 0
  return render(main.renderFn({ size: 24, active: false }))
}

function findClass(node, cls) {
  if (node && typeof node === 'object' && node.props?.className?.includes(cls)) return true
  if (Array.isArray(node?.props?.children)) return node.props.children.some(c => findClass(c, cls))
  return false
}

function findText(node, text) {
  if (typeof node === 'string') return node === text
  if (Array.isArray(node)) return node.some(c => findText(c, text))
  if (node && typeof node === 'object') return findText(node.props?.children, text)
  return false
}

function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  const kids = node.props?.children
  if (Array.isArray(kids)) {
    for (const kid of kids) {
      const found = findNode(kid, predicate)
      if (found) return found
    }
  }
  return null
}

let tree = renderPanel()
if (!findClass(tree, 'wb-page')) { console.error('FAIL: panel did not mount (.wb-page missing)'); process.exit(1) }

// Let the read-only fetches settle, then render again with data present.
await new Promise(resolve => setTimeout(resolve, 20))
tree = renderPanel()
if (!findClass(tree, 'wb-continuity')) { console.error('FAIL: continuity section missing after load'); process.exit(1) }
if (!findClass(tree, 'wb-audit')) { console.error('FAIL: audit section missing after load'); process.exit(1) }
if (!findText(tree, '测试主线')) { console.error('FAIL: fetched mainline not rendered'); process.exit(1) }

// Open the continuity editor and confirm the editable controls exist.
const editButton = findNode(tree, node => node.type === 'button' && findText(node.props?.children, 'edit'))
if (!editButton) { console.error('FAIL: no edit button in the continuity section'); process.exit(1) }
editButton.props.onClick()
tree = renderPanel()
if (!findNode(tree, node => node.type === 'input' && node.props?.id === 'wb-edit-mainline')) {
  console.error('FAIL: continuity editor did not open')
  process.exit(1)
}
if (!findText(tree, 'save')) { console.error('FAIL: no save button in the editor'); process.exit(1) }

// Sidebar icon must render an svg element.
const iconTree = render(sidebar.renderFn({ size: 24, active: false }))
if (iconTree?.type !== 'svg') { console.error('FAIL: sidebar icon not an svg'); process.exit(1) }

console.log('panel mounted: true | continuity editor: true | audit: true | sidebar icon:', iconTree.type)
console.log('\nCLIENT HARNESS PASS')
