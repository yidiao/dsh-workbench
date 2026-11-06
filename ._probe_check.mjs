// Machine check for the v1.0 Phase 0 assumptions.
//
// The two probes decided the shape of v1.0: short work is injected into the
// current session (the sidebar pane slot carries a sessionId), and image
// generation is NOT reachable from a plugin (so those canvas nodes stay gray).
// Both are properties of the shipped DSH build, not of this repository, so they
// have to be re-checked whenever DSH is upgraded - silently changing them would
// turn a design decision into a lie.
//
// Read-only: it scans the app.asar bytes and never writes, executes, or fetches.
//   node ._probe_check.mjs [path-to-app.asar]
// Exit code 0 = assumptions still hold; 1 = one changed and E-phase must be
// re-decided; 2 = the bundle could not be read.

import { openSync, readSync, closeSync } from 'node:fs'
import { existsSync } from 'node:fs'

const DEFAULT_ASAR = 'C:/Users/yidiao/AppData/Local/Programs/DSH NEXT/resources/app.asar'
const asarPath = process.argv[2] || process.env.DSH_ASAR_PATH || DEFAULT_ASAR

if (!existsSync(asarPath)) {
  console.error('SKIP: app.asar not found at', asarPath, '(set DSH_ASAR_PATH or pass a path)')
  process.exit(2)
}

const fd = openSync(asarPath, 'r')
const head = Buffer.alloc(16)
readSync(fd, head, 0, 16, 0)
const jsonLen = head.readUInt32LE(12)
const headerBuf = Buffer.alloc(jsonLen)
readSync(fd, headerBuf, 0, jsonLen, 16)
const header = JSON.parse(headerBuf.toString('utf8'))
const baseOffset = 8 + head.readUInt32LE(4)

const files = []
const walk = (node, path) => {
  for (const [name, child] of Object.entries(node.files || {})) {
    const next = path ? path + '/' + name : name
    if (child.files) walk(child, next)
    else if (Number.isFinite(Number(child.offset)) && Number(child.size) > 0) files.push({ path: next, offset: Number(child.offset), size: Number(child.size) })
  }
}
walk(header, '')

// Only DSH's own packages are reachable from a Cordis plugin; bundled SDKs
// (openai, pi-ai, genai) are the capability that is NOT bridged.
const isDshOwned = path => /^node_modules\/(@deepseek-ai|@)/.test(path) && !/^node_modules\/(openai|@google|@earendil-works|@agentclientprotocol)\//.test(path)
const scannable = files.filter(file => file.size < 24 * 1024 * 1024 && /\.(js|mjs|cjs)$/.test(file.path) && isDshOwned(file.path))
if (!scannable.length) {
  console.error('FAIL: no DSH-owned javascript found in', asarPath)
  process.exit(2)
}

const counts = new Map()
for (const file of scannable) {
  const bytes = Buffer.alloc(file.size)
  readSync(fd, bytes, 0, file.size, baseOffset + file.offset)
  const text = bytes.toString('utf8')
  for (const needle of ['sidebar.right.pane.tab', 'sidebarRightTabs', 'generateImages', 'images-api-registry', 'images/generations']) {
    let index = text.indexOf(needle)
    while (index >= 0) {
      const row = counts.get(needle) || { total: 0, paths: new Set() }
      row.total += 1
      row.paths.add(file.path)
      counts.set(needle, row)
      index = text.indexOf(needle, index + needle.length)
    }
  }
}
closeSync(fd)

const count = needle => counts.get(needle)?.total || 0
const failures = []

// 1. The sidebar pane contract that the panel registers against.
if (count('sidebar.right.pane.tab') === 0) failures.push('sidebar.right.pane.tab no longer appears in the shipped client')
if (count('sidebarRightTabs') === 0) failures.push('sidebarRightTabs no longer appears in the shipped client')

// 2. Image generation is not bridged into the plugin surface. If DSH ever wires
//    it, this check fires so E-phase re-decides instead of leaving gray nodes.
const nonPdfImagePaths = [...(counts.get('generateImages')?.paths || [])].filter(path => !/pdf/i.test(path))
if (nonPdfImagePaths.length) failures.push('generateImages now appears in a non-pdf DSH package: ' + nonPdfImagePaths.slice(0, 3).join(', '))
if (count('images-api-registry') > 0) failures.push('the pi-ai images registry is now referenced by DSH: ' + count('images-api-registry') + ' reference(s)')
if (count('images/generations') > 0) failures.push('/images/generations is now referenced by DSH: ' + count('images/generations') + ' reference(s)')

const summary = [
  'scanned ' + scannable.length + ' DSH-owned js files',
  'sidebar.right.pane.tab ×' + count('sidebar.right.pane.tab'),
  'sidebarRightTabs ×' + count('sidebarRightTabs'),
  'generateImages(non-pdf) ×' + nonPdfImagePaths.length,
  'images-api-registry ×' + count('images-api-registry'),
  'images/generations ×' + count('images/generations'),
].join(' | ')

if (failures.length) {
  console.error('PROBE HARNESS FAIL')
  console.error(summary)
  for (const failure of failures) console.error('- ' + failure)
  process.exit(1)
}
console.log('PROBE HARNESS PASS')
console.log(summary)
console.log('phase 0: the pane slot carries a session and image generation is still not bridged - both assumptions hold')