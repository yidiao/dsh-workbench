// Headless harness for the CLIENT bundle (client.js).
// Proves the bundle registers a 'sidebar.panellist' entry with id 'dsh-workbench'
// AND that the 'main' panel actually mounts (its component body executes, the
// effect runs, and a real element tree with '.wb-page' is produced).

globalThis.fetch = () => Promise.reject(new Error('headless: no live fetch'))

let captured = null
globalThis.window = { __ModuleLoader__: { load: (spec) => { captured = spec } } }

const h = (type, props, ...children) => ({
  type, props: { ...(props || {}), children: children.flat().filter(c => c !== false && c != null) },
})

const React = {
  createElement: h,
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useCallback: (fn) => fn,
  useEffect: (fn) => { try { fn() } catch {} },
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

// Mount the main panel: render the element tree, executing the component body.
function render(el) {
  if (!el || typeof el !== 'object') return el
  if (typeof el.type === 'function') {
    const out = el.type(el.props || {})
    return render(out)
  }
  const kids = Array.isArray(el.props?.children) ? el.props.children.map(render) : el.props?.children
  return { ...el, props: { ...el.props, children: kids } }
}

const tree = render(main.renderFn({ size: 24, active: false }))
function findClass(node, cls) {
  if (node && typeof node === 'object' && node.props?.className?.includes(cls)) return true
  if (Array.isArray(node?.props?.children)) return node.props.children.some(c => findClass(c, cls))
  return false
}
if (!findClass(tree, 'wb-page')) { console.error('FAIL: panel did not mount (.wb-page missing)'); process.exit(1) }

// Sidebar icon must render an svg element.
const iconTree = render(sidebar.renderFn({ size: 24, active: false }))
if (iconTree?.type !== 'svg') { console.error('FAIL: sidebar icon not an svg'); process.exit(1) }

console.log('panel mounted:', findClass(tree, 'wb-page'), '| sidebar icon:', iconTree.type)
console.log('\nCLIENT HARNESS PASS')
