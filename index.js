// dsh-workbench v0.12.0 —— 工作台：会话接续层 + 装配层 + 画布 + 飞轮
//
// 面板的每一次改版都在消灭同一种浪费：让用户重复陈述 agent 已经知道的东西。
//   v0.6：记录先消化（/api/report），原文只当证据；一屏一件事（四个标签页）。
//   v0.7：可复用从「模块」升到「模板」——/api/templates 存的是整套配方（三槽 +
//         模块 id + 默认模型/会话目标），选中即填满；派发带 templateId，运行时
//         记下 templateId/templateTitle，模板被删也不改历史。
// v1.0 把「记着」和「顺手」拆成四层，每一层都只有一个真源：
//   A 记忆：memory/<key>.json 唯一真源，saveMemory 生成 AGENTS.md 的受管区块。
//   B 流程：右栏三时刻（接上/在做/收工）由数据推导；短活 /api/sync 进当前会话，
//           长活才派生子会话，判别在 Host（/api/channel），不在按钮文字里。
//   C 画布：五元组（kind / 端口类型 / executor / verifier），没注册 executor 的节点
//           必须灰显；绿 = 校验器过 **且** 产物在盘上，删掉产物重验会转红。
//   D 飞轮：/api/outcome 一跑一色（红要写原因），2 绿晋升、1 红降级、每绿卡成本、
//           30 天未用归档；推荐只从晋升过的卡片里出，点「继续」即回填表单。
// 三个 Host 工具（wb_get / wb_set / wb_close）保持不变。

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  openSync,
  readSync,
  closeSync,
  realpathSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve, isAbsolute, sep, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url))

// Upward probe: walk from `start` toward the filesystem root until `predicate`
// matches. Returns the matching directory or undefined. Never hardcodes a path.
function findAncestor(start, predicate) {
  let current = start
  while (true) {
    if (predicate(current)) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

// Locate the relay data directory by probing upward. A relay directory holds
// either `relay/ledger.csv` (preferred) or a bare `ledger.csv`. We probe both
// from the resolved workbench directory and from the package directory, so the
// relay folder can legitimately live as a SIBLING of the workbench directory
// (e.g. `_workbench/` and `relay/` under the same parent) without any path
// being hardcoded. Env override (DSH_RELAY_DIR) still wins.
function findRelayDir(start) {
  let current = start
  while (true) {
    if (existsSync(join(current, 'relay', 'ledger.csv'))) return join(current, 'relay')
    if (existsSync(join(current, 'ledger.csv'))) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

const DEFAULT_WB_DIR = findAncestor(PACKAGE_DIR, dir => existsSync(join(dir, 'state.json')))
  || join(homedir(), 'dsh-workbench')
// Probe from the workbench dir first (catches a sibling `relay`), then from the
// package dir, then fall back to `<workbench>/relay`.
const DEFAULT_RELAY_DIR = findRelayDir(DEFAULT_WB_DIR)
  || findRelayDir(PACKAGE_DIR)
  || join(DEFAULT_WB_DIR, 'relay')
const WB_DIR = process.env.DSH_WORKBENCH_DIR || DEFAULT_WB_DIR
const RELAY_DIR = process.env.DSH_RELAY_DIR || DEFAULT_RELAY_DIR
const RELAY_LEDGER = join(RELAY_DIR, 'ledger.csv')
const RELAY_CARDS = join(RELAY_DIR, 'cards')
const STATE_JSON = join(WB_DIR, 'state.json')
const DECISIONS = join(WB_DIR, 'decisions.md')
const LEDGER = join(WB_DIR, 'ledger.json')
const AUDIT = join(WB_DIR, 'audit.jsonl')
const MAX_AUDIT_CHARS = 256 * 1024
const MAX_AUDIT_ENTRIES = 400
const API_PATH = '/dsh-workbench/api/state-v2'

const MEMORY_API_PATH = '/dsh-workbench/api/memory'
const CHANNEL_API_PATH = '/dsh-workbench/api/channel'
const SYNC_API_PATH = '/dsh-workbench/api/sync'
const LIVE_API_PATH = '/dsh-workbench/api/live'
const CLOSE_API_PATH = '/dsh-workbench/api/close'
const FLOW_API_PATH = '/dsh-workbench/api/flow'
const FLOW_NODE_API_PATH = '/dsh-workbench/api/flow/node'
const FLOW_NODE_DELETE_API_PATH = '/dsh-workbench/api/flow/node/delete'
const FLOW_EDGE_API_PATH = '/dsh-workbench/api/flow/edge'
const FLOW_EDGE_DELETE_API_PATH = '/dsh-workbench/api/flow/edge/delete'
const FLOW_RUN_API_PATH = '/dsh-workbench/api/flow/run'
const FLOW_VERIFY_API_PATH = '/dsh-workbench/api/flow/verify'
const FLOW_DEMO_API_PATH = '/dsh-workbench/api/flow/demo'
const FLYWHEEL_API_PATH = '/dsh-workbench/api/flywheel'
const OUTCOME_API_PATH = '/dsh-workbench/api/outcome'
const MODELS_API_PATH = '/dsh-workbench/api/models'
const STATE_EDIT_API_PATH = '/dsh-workbench/api/state-edit'
const DECISION_API_PATH = '/dsh-workbench/api/decision-add'
const AUDIT_API_PATH = '/dsh-workbench/api/audit'
const DISPATCH_API_PATH = '/dsh-workbench/api/dispatch'
const RUNS_API_PATH = '/dsh-workbench/api/runs'
const RUNS_CANCEL_API_PATH = '/dsh-workbench/api/runs/cancel'
const RUNS = join(WB_DIR, 'runs.json')
const MODULES = join(WB_DIR, 'modules.json')
const TEMPLATES = join(WB_DIR, 'templates.json')
const MAX_RUNS = 50
const MAX_MODULES = 200
const MAX_TEMPLATES = 100
const SESSIONS_API_PATH = '/dsh-workbench/api/sessions'
const MODULES_API_PATH = '/dsh-workbench/api/modules'
const TEMPLATES_API_PATH = '/dsh-workbench/api/templates'
const REPORT_API_PATH = '/dsh-workbench/api/report'
const MAX_SOURCE_BYTES = 256 * 1024
const BOUNDED_TEXT_CHARS = 12000

// ---- v1.0 memory: one JSON truth per project, one generated AGENTS.md block --
//
// The old primary/secondary "memory preview" never reached a model or a screen.
// v1.0 keeps one authoritative record per project and renders exactly one
// bounded block into the project's AGENTS.md, which the harness injects on the
// first request of a session (no custom pre-step code, no cache-prefix churn).
const MEMORY_DIR = join(WB_DIR, 'memory')
const PROJECTS_JSON = join(MEMORY_DIR, 'projects.json')
const MEMORY_VERSION = 1
// The harness injects this whole file once per session; keep the generated part
// small enough that it is a prefix, not a transcript.
const MAX_AGENTS_BLOCK_BYTES = 2048
const AGENTS_START = '<!-- dsh-workbench:generated:start -->'
const AGENTS_END = '<!-- dsh-workbench:generated:end -->'
const AGENTS_MANUAL_HEADER = [
  '# AGENTS.md',
  '',
  '> 手工区：这一块由你维护，工作台只改写下面 `dsh-workbench:generated` 之间的内容。',
  '> 生成的记忆来自 `<工作台>/memory/*.json`，真源在文件里，不在会话里。',
  '',
].join('\n')

const textOutput = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  render(_args, value) {
    return [{ type: 'text', text: String(value?.text ?? '') }]
  },
}

function ensureDir() {
  if (!existsSync(WB_DIR)) mkdirSync(WB_DIR, { recursive: true })
}

function readSafe(path) {
  try { return readFileSync(path, 'utf-8') } catch { return '' }
}

function readJsonSafe(path, fallback = null) {
  try { return JSON.parse(readSafe(path)) } catch { return fallback }
}

function boundedTail(text, maxChars) {
  const value = String(text)
  if (value.length <= maxChars) return value
  return `[较旧内容已截断，保留最近 ${maxChars} 个字符]\n` + value.slice(-maxChars)
}

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '')
}

function asPositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.floor(parsed), max)
}

function readWorkspaceConfig() {
  // The explicit path wins; otherwise probe upward from the workbench and
  // package dirs. Standard UTF-8 JSON is used to avoid ambiguous comment parsing.
  const candidates = []
  const explicit = firstValue(process.env.DSH_WORKBENCH_CONFIG, process.env.DSH_CONFIG)
  if (explicit) candidates.push(isAbsolute(String(explicit)) ? String(explicit) : resolve(WB_DIR, String(explicit)))
  for (const name of ['workbench.config.json', 'dsh-workbench.json', 'config.json']) {
    const found = findAncestor(WB_DIR, dir => existsSync(join(dir, name)))
    if (found) candidates.push(join(found, name))
    const packageFound = findAncestor(PACKAGE_DIR, dir => existsSync(join(dir, name)))
    if (packageFound) candidates.push(join(packageFound, name))
  }
  const path = candidates.find(candidate => existsSync(candidate)) || ''
  if (!path) return { path: '', value: {}, error: '' }
  const read = safeReadBounded(path)
  if (read.error) return { path, value: {}, error: read.error }
  if (read.truncated) return { path, value: {}, error: 'config-too-large' }
  try {
    const value = JSON.parse(read.text.replace(/^\uFEFF/, ''))
    return { path, value: value && typeof value === 'object' && !Array.isArray(value) ? value : {}, error: '' }
  } catch {
    // Do not echo parser messages: they may include source text from a private config.
    return { path, value: {}, error: 'invalid-json' }
  }
}

function safeReadBounded(path, maxBytes = MAX_SOURCE_BYTES) {
  let fd = 0
  try {
    const info = statSync(path)
    if (!info.isFile()) return { text: '', bytes: 0, truncated: false, error: 'not-a-file' }
    fd = openSync(path, 'r')
    const size = Math.min(info.size, maxBytes)
    const buffer = Buffer.alloc(size)
    const bytes = readSync(fd, buffer, 0, size, 0)
    return { text: buffer.subarray(0, bytes).toString('utf8'), bytes, truncated: info.size > maxBytes, error: '' }
  } catch (error) {
    return { text: '', bytes: 0, truncated: false, error: String(error?.code || error?.message || 'unreadable') }
  } finally {
    if (fd) {
      try { closeSync(fd) } catch { /* best effort */ }
    }
  }
}

function canonicalPath(path) {
  try { return realpathSync(path) } catch { return resolve(path) }
}

// ---- v1.0 memory core ------------------------------------------------------
//
// One JSON truth per project root, one generated block inside that root's
// AGENTS.md. The old primary/secondary "memory preview" is gone: it was a third
// half-system that only listed file sizes and never reached a model.
//
// Why AGENTS.md: the harness already injects the file chain on the first request
// of a session. Rendering into it means zero custom prompt code, no
// cache-prefix damage, and one place the user can read with their own eyes.

function memoryKeyFor(root) {
  return createHash('sha256').update(String(root).toLowerCase()).digest('hex').slice(0, 12)
}

function projectNameFor(root) {
  return basename(canonicalPath(String(root))) || 'project'
}

function memoryPath(key) {
  return join(MEMORY_DIR, key + '.json')
}

function memoryDecisionsPath(key) {
  return join(MEMORY_DIR, key + '.decisions.md')
}

function readProjects() {
  const raw = readJsonSafe(PROJECTS_JSON, null)
  const source = raw && typeof raw === 'object' ? raw : {}
  const items = Array.isArray(source.items)
    ? source.items.filter(item => item && typeof item.key === 'string' && typeof item.root === 'string')
    : []
  return { version: MEMORY_VERSION, active: typeof source.active === 'string' ? source.active : '', items }
}

function writeProjects(value) {
  ensureDir()
  mkdirSync(MEMORY_DIR, { recursive: true })
  writeFileSync(PROJECTS_JSON, JSON.stringify({
    version: MEMORY_VERSION,
    active: value.active || '',
    items: value.items.slice(0, 50),
  }, null, 2), 'utf-8')
}

function emptyMemory(key, root) {
  const stamp = new Date().toISOString()
  return {
    version: MEMORY_VERSION,
    key,
    name: projectNameFor(root),
    root,
    mainline: '',
    stopped_at: '',
    next: [],
    red_lines: [],
    decisions: [],
    outcome: '',
    openedAt: '',
    closedAt: '',
    basis: { runId: '', sessionId: '' },
    createdAt: stamp,
    updatedAt: stamp,
    migratedFrom: '',
  }
}

function normaliseMemory(raw, key) {
  const strings = value => (Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [])
  const decisions = Array.isArray(raw.decisions)
    ? raw.decisions
      .filter(item => item && typeof item === 'object' && typeof item.id === 'string')
      .map(item => ({ id: item.id, at: String(item.at || ''), title: String(item.title || '') }))
      .slice(-40)
    : []
  return {
    version: MEMORY_VERSION,
    key: typeof raw.key === 'string' ? raw.key : key,
    name: typeof raw.name === 'string' ? raw.name : '',
    root: typeof raw.root === 'string' ? raw.root : '',
    mainline: typeof raw.mainline === 'string' ? raw.mainline : '',
    stopped_at: typeof raw.stopped_at === 'string' ? raw.stopped_at : '',
    next: strings(raw.next),
    red_lines: strings(raw.red_lines),
    decisions,
    outcome: typeof raw.outcome === 'string' ? raw.outcome : '',
    openedAt: typeof raw.openedAt === 'string' ? raw.openedAt : '',
    closedAt: typeof raw.closedAt === 'string' ? raw.closedAt : '',
    basis: raw.basis && typeof raw.basis === 'object'
      ? { runId: String(raw.basis.runId || ''), sessionId: String(raw.basis.sessionId || '') }
      : { runId: '', sessionId: '' },
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    migratedFrom: typeof raw.migratedFrom === 'string' ? raw.migratedFrom : '',
  }
}

function readMemory(key) {
  const raw = readJsonSafe(memoryPath(key), null)
  if (!raw || typeof raw !== 'object') return null
  return normaliseMemory(raw, key)
}

function writeMemoryJson(memory) {
  ensureDir()
  mkdirSync(MEMORY_DIR, { recursive: true })
  writeFileSync(memoryPath(memory.key), JSON.stringify(memory, null, 2), 'utf-8')
}

function defaultMemoryRoot() {
  const loaded = readWorkspaceConfig()
  const memory = loaded.value && typeof loaded.value.memory === 'object' ? loaded.value.memory : {}
  const candidate = String(firstValue(process.env.DSH_MEMORY_ROOT, memory.root, '') || '').trim()
  if (candidate) {
    const path = isAbsolute(candidate) ? resolve(candidate) : resolve(WB_DIR, candidate)
    try {
      if (existsSync(path) && statSync(path).isDirectory()) return canonicalPath(path)
    } catch { /* fall through to the workbench dir */ }
  }
  return canonicalPath(WB_DIR)
}

function ensureProject(rootInput, sessionId = '') {
  const requested = String(rootInput || '').trim() || defaultMemoryRoot()
  const lexical = isAbsolute(requested) ? resolve(requested) : resolve(WB_DIR, requested)
  try {
    if (!existsSync(lexical) || !statSync(lexical).isDirectory()) return { ok: false, error: '项目目录不存在：' + lexical }
  } catch {
    return { ok: false, error: '项目目录不可读：' + lexical }
  }
  const root = canonicalPath(lexical)
  const key = memoryKeyFor(root)
  const projects = readProjects()
  const stamp = new Date().toISOString()
  let item = projects.items.find(entry => entry.key === key)
  if (!item) {
    item = { key, root, name: projectNameFor(root), sessionId: '', createdAt: stamp, updatedAt: stamp }
    projects.items.unshift(item)
  }
  if (sessionId) item.sessionId = String(sessionId).slice(0, 120)
  item.updatedAt = stamp
  if (!projects.active) projects.active = key
  writeProjects(projects)
  let memory = readMemory(key)
  if (!memory) {
    memory = emptyMemory(key, root)
    writeMemoryJson(memory)
  }
  memory.root = root
  if (!memory.name) memory.name = projectNameFor(root)
  return { ok: true, key, root, item, memory, projects }
}

let memoryReady = false

function ensureMemoryReady() {
  if (memoryReady) return
  memoryReady = true
  try { migrateLegacyState() } catch { /* best effort: memory is not a startup gate */ }
}

function activeProject() {
  ensureMemoryReady()
  const projects = readProjects()
  const item = projects.items.find(entry => entry.key === projects.active) || projects.items[0]
  if (item) {
    const memory = readMemory(item.key)
    if (memory) return { ok: true, key: item.key, root: item.root, item, memory, projects }
  }
  return ensureProject(defaultMemoryRoot())
}

// The legacy single slot (state.json / state.md / decisions.md at the workbench
// root) is imported once, into the project whose root is the workbench itself.
// DSH_WORKBENCH_DIR temp runs get their own copy, so tests stay isolated.
function migrateLegacyState() {
  const projects = readProjects()
  if (projects.items.length) return null
  const legacy = readJsonSafe(STATE_JSON, null)
  const legacyDecisions = readSafe(DECISIONS)
  const created = ensureProject(defaultMemoryRoot(), '')
  if (!created.ok) return created
  if (!legacy && !legacyDecisions.trim()) return created
  const memory = created.memory
  if (legacy && typeof legacy === 'object') {
    memory.mainline = typeof legacy.mainline === 'string' ? legacy.mainline : memory.mainline
    memory.stopped_at = typeof legacy.stopped_at === 'string' ? legacy.stopped_at : memory.stopped_at
    memory.next = Array.isArray(legacy.next) ? legacy.next.map(String).filter(Boolean) : memory.next
    memory.red_lines = Array.isArray(legacy.red_lines) ? legacy.red_lines.map(String).filter(Boolean) : memory.red_lines
    // The old file's last write is the closest thing to a close time; without it
    // every migrated project would look like it never closed a cycle.
    if (typeof legacy.updated === 'string' && legacy.updated) memory.closedAt = legacy.updated
  }
  if (legacyDecisions.trim()) {
    writeFileSync(memoryDecisionsPath(memory.key), legacyDecisions.replace(/\s*$/, '') + '\n', 'utf-8')
    memory.decisions = parseDecisionIndex(legacyDecisions).slice(-20)
  }
  memory.migratedFrom = 'state.json+decisions.md'
  memory.updatedAt = new Date().toISOString()
  writeMemoryJson(memory)
  syncAgentsFile(created.root, memory)
  return created
}

function decisionId(at, title) {
  return 'dec_' + createHash('sha256').update(String(at) + '|' + String(title)).digest('hex').slice(0, 10)
}

// A decision card is read by a human in a 2 KB block, so the index title is the
// "决定" line when there is one — "背景：" describes the problem, not the choice.
function decisionTitleFromBody(body, max = 90) {
  const text = String(body || '')
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const decidedLine = lines.find(line => /^决定[：:]/.test(line))
  if (decidedLine) return decidedLine.replace(/^决定[：:]\s*/, '').slice(0, max)
  // Many legacy entries pack "背景…决定…" into one paragraph; the choice is the
  // part a reader needs, so take what follows the marker when it exists.
  const inline = /决定[：:]\s*([\s\S]+)$/.exec(text)
  if (inline) return inline[1].replace(/\s+/g, ' ').trim().slice(0, max)
  return (lines[0] || '').slice(0, max)
}

function parseDecisionIndex(text) {
  const sections = []
  let current = null
  for (const line of String(text).split(/\r?\n/)) {
    const heading = /^###\s+(\S+)\s*$/.exec(line.trim())
    if (heading) {
      if (current) sections.push(current)
      current = { at: heading[1], lines: [] }
      continue
    }
    if (current && line.trim()) current.lines.push(line.trim())
  }
  if (current) sections.push(current)
  return sections.map(section => {
    const title = decisionTitleFromBody(section.lines.join('\n'))
    return { id: decisionId(section.at, title), at: section.at, title }
  })
}

function appendDecision(memory, { text, title = '' }) {
  const stamp = new Date().toISOString()
  const body = String(text || '').trim()
  if (!body) return memory
  const firstLine = body.split(/\r?\n/).map(line => line.trim()).find(Boolean) || ''
  const explicit = String(title || '').trim().slice(0, 90)
  const heading = explicit || decisionTitleFromBody(body) || firstLine.slice(0, 90)
  // An explicit title leads the entry so the markdown keeps the same heading
  // the index shows; without it the body already starts with that line.
  const entry = explicit && explicit !== firstLine ? `${explicit}\n\n${body}` : body
  ensureDir()
  mkdirSync(MEMORY_DIR, { recursive: true })
  appendBounded(memoryDecisionsPath(memory.key), `\n### ${stamp}\n${entry}\n`, 120000)
  memory.decisions = [...memory.decisions, { id: decisionId(stamp, heading), at: stamp, title: heading }].slice(-40)
  return memory
}

function renderMemoryBlock(memory, options = {}) {
  const decisions = options.decisions ?? 6
  const nextCount = options.next ?? 3
  const redCount = options.red ?? 4
  const lines = []
  lines.push(AGENTS_START)
  lines.push(`## 工作台记忆 · ${memory.name || memory.key}`)
  lines.push(`> 真源 \`memory/${memory.key}.json\`；本段由 dsh-workbench 生成，只读。`)
  lines.push('- 主线：' + (memory.mainline || '（未填）'))
  lines.push('- 停在哪：' + (memory.stopped_at || '（未填）'))
  const next = memory.next.slice(0, nextCount)
  if (next.length) {
    lines.push('- 下一步：')
    next.forEach((item, index) => lines.push(`  ${index + 1}. ${item}`))
  } else {
    lines.push('- 下一步：（未填）')
  }
  lines.push('- 红线：' + (memory.red_lines.length ? memory.red_lines.slice(0, redCount).join(' · ') : '（未填）'))
  if (decisions > 0 && memory.decisions.length) {
    const shown = memory.decisions.slice(-decisions)
    lines.push(`- 判例（最近 ${shown.length} 条，全文用 wb_get section=decisions）：`)
    for (const item of shown) lines.push(`  - ${String(item.at).slice(0, 10)} ${String(item.title).slice(0, 60)}`)
  }
  const closed = memory.closedAt
    ? `上次收工 ${memory.closedAt.slice(0, 16)}（结论：${memory.outcome || '未记录'}）`
    : '上次收工：无记录'
  const basis = memory.basis && memory.basis.runId ? ` · 依据 ${memory.basis.runId}` : ''
  lines.push('- ' + closed + basis)
  if (memory.gapNote) lines.push('- 注意：' + memory.gapNote)
  lines.push(AGENTS_END)
  return lines.join('\n')
}

const BLOCK_SHAPES = [
  { decisions: 6, next: 3, red: 4 },
  { decisions: 4, next: 3, red: 3 },
  { decisions: 2, next: 2, red: 2 },
  { decisions: 0, next: 2, red: 2 },
  { decisions: 0, next: 1, red: 1 },
  { decisions: 0, next: 1, red: 0 },
]

function fitMemoryBlock(memory) {
  for (const shape of BLOCK_SHAPES) {
    const block = renderMemoryBlock(memory, shape)
    if (Buffer.byteLength(block, 'utf8') <= MAX_AGENTS_BLOCK_BYTES) return block
  }
  // Last resort: a bounded summary is better than an unbounded injection.
  const tight = {
    ...memory,
    mainline: String(memory.mainline || '').slice(0, 120),
    stopped_at: String(memory.stopped_at || '').slice(0, 120),
    next: memory.next.slice(0, 1).map(item => String(item).slice(0, 120)),
    red_lines: memory.red_lines.slice(0, 1).map(item => String(item).slice(0, 120)),
    decisions: [],
  }
  return renderMemoryBlock(tight, { decisions: 0, next: 1, red: 1 })
}

function syncAgentsFile(root, memory) {
  const target = join(root, 'AGENTS.md')
  const block = fitMemoryBlock(memory)
  let existing = ''
  try {
    existing = existsSync(target) ? readFileSync(target, 'utf-8') : ''
  } catch {
    return { ok: false, path: target, bytes: 0, error: 'unreadable' }
  }
  const start = existing.indexOf(AGENTS_START)
  const end = existing.indexOf(AGENTS_END)
  let next
  if (start >= 0 && end > start) {
    next = existing.slice(0, start) + block + existing.slice(end + AGENTS_END.length)
  } else if (existing.trim()) {
    next = existing.replace(/\s*$/, '') + '\n\n' + block + '\n'
  } else {
    next = AGENTS_MANUAL_HEADER + block + '\n'
  }
  try {
    writeFileSync(target, next, 'utf-8')
    return { ok: true, path: target, bytes: Buffer.byteLength(block, 'utf8'), created: !existing }
  } catch (error) {
    return { ok: false, path: target, bytes: 0, error: String(error?.code || error?.message || 'unwritable') }
  }
}

function saveMemory(memory, extra = {}) {
  const next = { ...memory, ...extra, updatedAt: new Date().toISOString() }
  writeMemoryJson(next)
  const agents = syncAgentsFile(next.root, next)
  return { memory: next, agents }
}

// A cycle is "closed" only when a close happened after the last work write. The
// panel shows the open gap; nothing blocks on it.
function memoryGap(memory) {
  const closedAt = Date.parse(memory.closedAt || '') || 0
  const openedAt = Date.parse(memory.openedAt || '') || 0
  const open = openedAt > closedAt
  let finishedAfterClose = 0
  let lastRunId = ''
  let lastAt = 0
  try {
    const root = canonicalPath(memory.root || '')
    for (const run of readRuns()) {
      if (!run || typeof run.cwd !== 'string' || !run.cwd) continue
      if (canonicalPath(run.cwd) !== root) continue
      if (!run.status || run.status === 'running' || run.status === 'queued') continue
      const at = Number(run.updatedAt || run.createdAt || 0)
      if (!(at > closedAt)) continue
      finishedAfterClose += 1
      if (at > lastAt) { lastAt = at; lastRunId = String(run.runId || '') }
    }
  } catch { /* run history is advisory here */ }
  return { open, finishedAfterClose, lastRunId }
}

function publicMemory(memory) {
  return {
    key: memory.key,
    name: memory.name,
    root: memory.root,
    mainline: memory.mainline,
    stopped_at: memory.stopped_at,
    next: memory.next,
    red_lines: memory.red_lines,
    decisions: memory.decisions,
    outcome: memory.outcome,
    openedAt: memory.openedAt,
    closedAt: memory.closedAt,
    updatedAt: memory.updatedAt,
    migratedFrom: memory.migratedFrom,
  }
}

function memoryPayload(resolved) {
  const project = resolved && resolved.ok ? resolved : activeProject()
  if (!project.ok) return { ok: false, error: project.error, active: '', items: [], memory: null }
  const gap = memoryGap(project.memory)
  const withGap = {
    ...project.memory,
    gapNote: gap.open
      ? `上次没有收工（${gap.finishedAfterClose ? '其后还有 ' + gap.finishedAfterClose + ' 次运行完成' : '只是写了状态'}），先用 wb_close 或 wb_set 续上。`
      : '',
  }
  return {
    ok: true,
    active: project.key,
    root: project.root,
    name: project.memory.name,
    memory: { ...publicMemory(project.memory), gap },
    agentsPath: join(project.root, 'AGENTS.md'),
    agentsBytes: Buffer.byteLength(fitMemoryBlock(withGap), 'utf8'),
    items: project.projects.items.map(item => ({
      key: item.key,
      root: item.root,
      name: item.name,
      sessionId: item.sessionId || '',
      updatedAt: item.updatedAt || '',
    })),
    fetchedAt: new Date().toISOString(),
  }
}

function memoryText(memory, { project, gap }) {
  const lines = []
  lines.push(`项目：${memory.name} · ${memory.root}`)
  lines.push(`主线：${memory.mainline || '（未填）'}`)
  lines.push(`停在哪：${memory.stopped_at || '（未填）'}`)
  lines.push(`下一步：${memory.next.length ? memory.next.join('；') : '（未填）'}`)
  lines.push(`红线：${memory.red_lines.length ? memory.red_lines.join('；') : '（未填）'}`)
  lines.push(`上次收工：${memory.closedAt ? memory.closedAt.slice(0, 16) + '（' + (memory.outcome || '未记录') + '）' : '无记录'}${memory.basis?.runId ? ' · ' + memory.basis.runId : ''}`)
  if (gap?.open) lines.push(`缺口：未收工${gap.finishedAfterClose ? '（其后 ' + gap.finishedAfterClose + ' 次运行已完成）' : ''}`)
  if (project && project.projects && project.projects.items.length > 1) lines.push(`已知项目：${project.projects.items.length} 个（wb_get section=projects）`)
  return lines.join('\n')
}

function resolveProjectArg(value) {
  const text = String(value || '').trim()
  if (!text) return activeProject()
  ensureMemoryReady()
  const projects = readProjects()
  const byName = projects.items.find(item => item.key === text || item.name === text || item.root === text)
  if (byName) {
    const memory = readMemory(byName.key)
    if (memory) return { ok: true, key: byName.key, root: byName.root, item: byName, memory, projects }
  }
  return ensureProject(text, '')
}

function serviceGet(ctx, name) {
  try {
    if (typeof ctx?.get === 'function') return ctx.get(name)
    return ctx?.[name]
  } catch {
    return undefined
  }
}

function normalizeModelEntry(value) {
  if (typeof value === 'string') return { id: value, name: value }
  if (!value || typeof value !== 'object') return null
  const id = firstValue(value.id, value.model, value.slug, value.name)
  if (!id) return null
  return { id: String(id), name: String(firstValue(value.name, value.displayName, value.id, value.model) || id) }
}

function normalizeProviderEntry(value) {
  if (typeof value === 'string') return { id: value, name: value, models: [] }
  if (!value || typeof value !== 'object') return null
  const id = firstValue(value.id, value.provider, value.name)
  if (!id) return null
  return {
    id: String(id),
    name: String(firstValue(value.name, value.displayName, value.id, value.provider) || id),
    models: [],
  }
}

// Read-only model catalog for the command-center selector. It uses the Host
// `llm` service when the profile provides one and degrades to an empty catalog
// (never an error page) when it does not. No model request is made here.
async function modelCatalogPayload(ctx) {
  const llm = serviceGet(ctx, 'llm')
  if (!llm || typeof llm.listProviders !== 'function') {
    return { ok: true, available: false, groups: [], reason: 'llm service not available in this profile' }
  }
  let rawProviders = []
  try { rawProviders = await llm.listProviders() } catch { rawProviders = [] }
  if (!Array.isArray(rawProviders)) rawProviders = []
  const groups = []
  for (const rawProvider of rawProviders) {
    const provider = normalizeProviderEntry(rawProvider)
    if (!provider) continue
    let rawModels = []
    try {
      rawModels = await llm.listModels(provider.id)
    } catch {
      rawModels = []
    }
    if (!Array.isArray(rawModels)) {
      if (rawModels && typeof rawModels === 'object') rawModels = Object.values(rawModels)
      else rawModels = []
    }
    provider.models = rawModels.map(normalizeModelEntry).filter(Boolean)
    groups.push(provider)
  }
  let current = null
  const defaults = serviceGet(ctx, 'agentDefaultModel')
  if (defaults && typeof defaults.currentSelection === 'function') {
    try {
      const selection = await defaults.currentSelection()
      if (selection && typeof selection === 'object') {
        current = {
          provider: selection.provider ? String(selection.provider) : '',
          model: selection.model ? String(selection.model) : '',
        }
      }
    } catch {
      current = null
    }
  }
  return { ok: true, available: true, groups, current, fetchedAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// Phase 3: one-shot dispatch into a real DSH Session.
//
// The panel sends a composed instruction to the Host `sessionController`
// (create -> optional selectModel -> prompt). This reuses DSH's own durable
// Session, Agent loop, tool permissions and cancellation lifecycle; it never
// calls a provider directly. Dispatch stays opt-in per workspace through
// `execution.enabled` in the workspace config, and every start/cancel is
// audited. A dry run composes the prompt without creating anything.
// ---------------------------------------------------------------------------
function executionConfig() {
  const config = readWorkspaceConfig().value
  const execution = config?.execution && typeof config.execution === 'object' ? config.execution : {}
  const flag = firstValue(process.env.DSH_WORKBENCH_EXECUTION, execution.enabled)
  const enabled = flag === true || String(flag).toLowerCase() === 'true' || String(flag) === '1'
  const base = canonicalPath(WB_DIR)
  const configured = firstValue(execution.cwd, execution.rootDir, execution.workspaceRoot)
  let cwd = ''
  if (typeof configured === 'string' && configured.trim()) {
    const candidate = isAbsolute(configured.trim()) ? resolve(configured.trim()) : resolve(base, configured.trim())
    try {
      if (existsSync(candidate) && statSync(candidate).isDirectory()) cwd = canonicalPath(candidate)
    } catch {
      cwd = ''
    }
  }
  if (!cwd) {
    const parent = dirname(base)
    const preferred = basename(base).startsWith('_') && existsSync(parent) ? parent : base
    cwd = canonicalPath(preferred)
  }
  return { enabled, cwd, configured: Boolean(configured) }
}

function composeDispatchPrompt({ goal, plan, instruction }) {
  const lines = ['[DSH Workbench 任务]', `目标：${goal}`]
  if (plan) lines.push(`计划：\n${plan}`)
  if (instruction) lines.push(`补充指令：\n${instruction}`)
  lines.push('要求：完成本轮后给出简短结论（做了什么、结果、产物路径）；如需回写工作台状态，使用工作台的 wb_set / wb_close 工具。')
  return lines.join('\n\n').slice(0, 12000)
}

function readRuns() {
  const raw = readJsonSafe(RUNS, null)
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.items)) return raw.items
  return []
}

function writeRuns(items) {
  ensureDir()
  try {
    writeFileSync(RUNS, JSON.stringify({ version: 1, items: items.slice(0, MAX_RUNS) }, null, 2), 'utf-8')
  } catch {
    // Best effort: a failed run-registry write must not break dispatch.
  }
}

function newRunId() {
  return 'run_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function sessionEventsOf(ctx, sessionId) {
  try {
    const session = serviceGet(ctx, 'sessions')?.get?.(sessionId)
    const events = session?.snapshotEvents?.()
    return Array.isArray(events) ? events : []
  } catch {
    return []
  }
}

function lastTurnEndKind(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event?.type === 'turn/end') return event?.data?.reason?.kind
  }
  return undefined
}

function lastAssistantText(ctx, sessionId) {
  const events = sessionEventsOf(ctx, sessionId)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event?.type !== 'assistant/message') continue
    const blocks = event?.data?.message?.content
    if (!Array.isArray(blocks)) continue
    const text = blocks
      .filter(block => block?.type === 'text' && typeof block.text === 'string')
      .map(block => block.text)
      .join('\n')
      .trim()
    if (text) return text.slice(0, 1200)
  }
  return ''
}

function finaliseRun(ctx, run) {
  const events = sessionEventsOf(ctx, run.sessionId)
  const kind = lastTurnEndKind(events)
  run.status = kind === 'error' ? 'error' : (kind === 'aborted' || kind === 'interrupted') ? 'cancelled' : 'done'
  run.reply = lastAssistantText(ctx, run.sessionId)
  // A finished run is no longer parked on a question, even if it last was.
  run.waiting = false
  run.updatedAt = Date.now()
  // Close the audit chain: dispatch.start must be answerable with a terminal
  // entry, otherwise a finished run is indistinguishable from a lost one.
  appendAudit({
    action: run.status === 'error' ? 'dispatch.error' : run.status === 'cancelled' ? 'dispatch.cancel' : 'dispatch.done',
    requestId: run.runId,
    summary: `session ${run.sessionId} · ${run.status} · reply ${run.reply.length} chars`,
  })
}

// Live progress for a dispatched run, taken from the session's own events.
// Only available while the session is loaded in this Host process; a cold
// session leaves the previously stored values untouched.
function runProgress(events) {
  if (!Array.isArray(events) || !events.length) return null
  let steps = 0
  let toolCalls = 0
  let assetCount = 0
  let activityAt = 0
  for (const event of events) {
    const time = Number(event?.time)
    if (Number.isFinite(time) && time > activityAt) activityAt = time
    if (event?.type === 'step/start') steps++
    else if (event?.type === 'tool/call') toolCalls++
    else if (event?.type === 'assistant/message') assetCount++
  }
  const last = events[events.length - 1]
  // The session is parked on a question: no answer can arrive until the user
  // opens that session, so the run stays 'running' by design.
  const waiting = last?.type === 'tool/call' && last?.data?.name === 'ask_user_question'
  return { steps, toolCalls, messages: assetCount, activityAt, waiting }
}

function applyProgress(run, events) {
  const progress = runProgress(events)
  if (!progress) return false
  let changed = false
  const assign = (key, value) => {
    if (value === undefined) return
    if (run[key] !== value) { run[key] = value; changed = true }
  }
  assign('steps', progress.steps)
  assign('toolCalls', progress.toolCalls)
  assign('messages', progress.messages)
  assign('activityAt', progress.activityAt || undefined)
  // Only a still-running dispatch can be "waiting". A finished or cancelled run
  // must never render the waiting chip next to its terminal status.
  assign('waiting', run.status === 'running' ? progress.waiting : false)
  return changed
}

async function refreshRuns(ctx, items) {
  const controller = serviceGet(ctx, 'sessionController')
  let changed = false
  for (const run of items) {
    if (!run || typeof run !== 'object' || typeof run.sessionId !== 'string') continue
    if (applyProgress(run, sessionEventsOf(ctx, run.sessionId))) changed = true
  }
  if (!controller || typeof controller.list !== 'function') {
    if (changed) writeRuns(items)
    return items
  }
  let listed
  try {
    listed = await controller.list()
  } catch {
    if (changed) writeRuns(items)
    return items
  }
  if (listed && !Array.isArray(listed)) listed = listed.value?.items ?? listed.items
  if (!Array.isArray(listed)) listed = []
  const byId = new Map(listed.filter(item => item && typeof item.sessionId === 'string').map(item => [item.sessionId, item]))
  for (const run of items) {
    if (!run || typeof run !== 'object' || typeof run.sessionId !== 'string') continue
    const item = byId.get(run.sessionId)
    if (!item) continue
    if (item.running) {
      if (run.status !== 'running') { run.status = 'running'; run.updatedAt = Date.now(); changed = true }
    } else if (run.status === 'running') {
      finaliseRun(ctx, run)
      changed = true
    }
  }
  // A run still marked running whose session this Host no longer lists cannot
  // be progressing — after a restart it is a lie, not a status. Mark it so the
  // panel can offer archiving instead of showing "running" forever. A short
  // grace period keeps a just-dispatched run from flapping.
  const now = Date.now()
  for (const run of items) {
    if (!run || typeof run !== 'object' || typeof run.sessionId !== 'string') continue
    const tracked = byId.has(run.sessionId)
    const settled = now - (Number(run.updatedAt) || Number(run.createdAt) || now) > 30000
    const orphaned = run.status === 'running' && !tracked && settled
    if (Boolean(run.orphaned) !== orphaned) { run.orphaned = orphaned; changed = true }
  }
  if (changed) writeRuns(items)
  return items
}

function parseCsvLine(line) {
  const fields = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && quoted && line[i + 1] === '"') { value += '"'; i++ }
    else if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { fields.push(value); value = '' }
    else value += ch
  }
  fields.push(value)
  return fields
}

function readRelayLedger() {
  const lines = readSafe(RELAY_LEDGER).split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return { rows: [], totalTokens: 0, calls: 0, completed: 0 }
  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1, 501).map(line => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(headers.map((key, index) => [key, cells[index] ?? '']))
  })
  const totalTokens = rows.reduce((sum, row) => sum + (Number(row.total_tokens) || 0), 0)
  const completed = rows.filter(row => /已回|绿|done|complete/i.test(row.status || '')).length
  return { rows, totalTokens, calls: rows.length, completed }
}

function readTaskCards() {
  try {
    return readdirSync(RELAY_CARDS, { withFileTypes: true })
      .filter(entry => entry.isFile() && /^T-\d+\.md$/i.test(entry.name))
      .slice(0, 100)
      .map(entry => {
        const text = readSafe(join(RELAY_CARDS, entry.name))
        const field = name => text.match(new RegExp('^' + name + ':\\s*(.+)$', 'm'))?.[1]?.trim() || ''
        return { id: field('id') || entry.name.replace(/\.md$/i, ''), status: field('status'), goal: field('goal'), tier: field('tier'), deliverable: field('deliverable') }
      })
  } catch { return [] }
}

function appendBounded(path, text, maxChars = 20000) {
  writeFileSync(path, boundedTail(readSafe(path) + text, maxChars), 'utf-8')
}

// ---------------------------------------------------------------------------
// Phase 2: editable continuity + append-only audit.
//
// The panel can now change its own control surface (state.json fields and new
// decision entries). Every write is recorded in `audit.jsonl` with the actor,
// timestamp and a compact before/after summary, so the panel can show what it
// changed without a separate logging service. Audit text is bounded and the
// file is trimmed to the most recent entries.
// ---------------------------------------------------------------------------
const INVALID = Symbol('invalid')

function normaliseText(value, max) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') return INVALID
  const text = value.replace(/\r\n/g, '\n').trim()
  if (!text) return ''
  if (text.length > max) return INVALID
  return text
}

function normaliseList(value, maxItems, maxChars) {
  if (value === undefined || value === null) return undefined
  const raw = Array.isArray(value) ? value : String(value).split('\n')
  const items = []
  for (const item of raw) {
    const text = normaliseText(item, maxChars)
    if (text === INVALID) return INVALID
    if (text) items.push(text)
    if (items.length >= maxItems) break
  }
  return items
}

async function readJsonBody(req, limit = 64 * 1024) {
  if (typeof req?.[Symbol.asyncIterator] !== 'function') return { error: 'no-body' }
  let size = 0
  const chunks = []
  try {
    for await (const chunk of req) {
      size += chunk.length
      if (size > limit) return { tooLarge: true }
      chunks.push(chunk)
    }
  } catch {
    return { error: 'read-failed' }
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text.trim()) return { json: {} }
  try {
    const json = JSON.parse(text)
    if (!json || typeof json !== 'object' || Array.isArray(json)) return { error: 'invalid-body' }
    return { json }
  } catch {
    return { error: 'invalid-json' }
  }
}

function requestId(value) {
  const text = normaliseText(value, 120)
  return text === INVALID || text === undefined ? '' : text
}

function appendAudit(entry) {
  ensureDir()
  const line = JSON.stringify({ ts: new Date().toISOString(), actor: 'panel', version: 1, ...entry }) + '\n'
  let text = readSafe(AUDIT) + line
  if (text.length > MAX_AUDIT_CHARS) {
    const lines = text.split('\n').filter(Boolean)
    text = lines.slice(-MAX_AUDIT_ENTRIES).join('\n') + '\n'
  }
  writeFileSync(AUDIT, text, 'utf-8')
}

function auditEntries(limit = 50) {
  const lines = readSafe(AUDIT).split('\n').filter(Boolean)
  const count = Math.min(Math.max(Number(limit) || 50, 1), MAX_AUDIT_ENTRIES)
  return lines.slice(-count).map(line => {
    try { return JSON.parse(line) } catch { return null }
  }).filter(Boolean).reverse()
}

function currentState() {
  const project = activeProject()
  if (!project.ok) return { mainline: '', stopped_at: '', next: [], red_lines: [] }
  const memory = project.memory
  return {
    mainline: memory.mainline,
    stopped_at: memory.stopped_at,
    next: memory.next,
    red_lines: memory.red_lines,
  }
}

function sendJson(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(value))
}

function isLoopbackReq(req) {
  const host = String(req.headers?.host ?? '').toLowerCase()
  const hostname = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0]
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
}

// The v1.0 channel rule, hard-coded on purpose: a rule a user cannot see is a
// rule they cannot trust, and a rule with no numbers is a rule nobody can check.
// Sync = short work stays in the session already open, so history, approvals and
// context remain in one place. Async = dispatch to a child session.
const SYNC_MAX_MINUTES = 2
const ASYNC_TEXT_SIGNALS = [
  [/(生成|生|画|出|做)[^，。！？\n]{0,6}(图|封面|插画|海报|视频|片子|动画)/, '要外部生成（图/视频）'],
  [/(批量|全库|全量|扫描全部|遍历所有)/, '批量作业，可能超过几分钟'],
  [/(重构|迁移|移植|重写)/, '大改，需要独立会话慢慢做'],
  [/(跑测试|全量测试|构建|打包|部署|build|deploy)/, '要跑外部命令/流程'],
  [/(等回复|等审批|等对方|定时|明天再看)/, '要等外部资源'],
]

function channelFor(input = {}) {
  const text = String(input.text || '')
  const minutes = Number(input.minutes)
  const reasons = []
  let channel = 'sync'
  const toAsync = reason => {
    if (channel !== 'async') { channel = 'async'; reasons.length = 0 }
    reasons.push(reason)
  }
  if (Number.isFinite(minutes) && minutes > SYNC_MAX_MINUTES) toAsync(`预计 ${minutes} 分钟，超过 ${SYNC_MAX_MINUTES} 分钟上限`)
  if (input.needsGeneration === true) toAsync('需要外部生成（图/视频）')
  if (input.external === true) toAsync('要等外部资源')
  if (input.leaving === true) toAsync('你要离开，需要独立会话继续')
  for (const [pattern, reason] of ASYNC_TEXT_SIGNALS) {
    const hit = pattern.exec(text)
    if (hit) toAsync(`文字里有长活信号「${hit[0]}」：${reason}`)
  }
  if (channel === 'sync') {
    reasons.push(minutes ? `预计 ${minutes} 分钟，不超过 ${SYNC_MAX_MINUTES} 分钟` : `不超过 ${SYNC_MAX_MINUTES} 分钟的短活`)
    reasons.push('留在当前会话里接着做：同一个会话、同一段历史')
  } else {
    reasons.push(`改为派一条长活（独立会话），当前会话不被长时间占用`)
  }
  return { channel, reasons, maxMinutes: SYNC_MAX_MINUTES, decidedAt: new Date().toISOString() }
}

function statePayload(ctx) {
  // state.json used to be a third source of truth next to state.md and the
  // panel. It is now derived: the JSON memory record is the only writer.
  const project = activeProject()
  const memory = project.ok ? project.memory : null
  const gap = memory ? memoryGap(memory) : { open: false, finishedAfterClose: 0 }
  const state = memory
    ? { mainline: memory.mainline, stopped_at: memory.stopped_at, next: memory.next, red_lines: memory.red_lines }
    : { mainline: '', stopped_at: '', next: [], red_lines: [] }
  const stateText = memory ? memoryText(memory, { project, gap }) : ''
  const decisionsText = memory ? readSafe(memoryDecisionsPath(memory.key)) : ''
  const savedLedger = readJsonSafe(LEDGER, null)
  const relayLedger = readRelayLedger()
  const tasks = readTaskCards()
  const ledger = { ...relayLedger, ...(savedLedger && typeof savedLedger === 'object' ? savedLedger : {}) }
  if (ledger.greenCards === undefined && ledger.green_cards === undefined) {
    ledger.greenCards = tasks.filter(task => /绿|green|passed/i.test(String(task?.status || ''))).length
  }
  const execution = executionConfig()
  const controller = serviceGet(ctx, 'sessionController')
  return {
    ok: true,
    state,
    stateText,
    decisions: decisionsText.slice(-8000),
    ledger,
    tasks,
    memory: memoryPayload(project),
    execution: {
      enabled: execution.enabled,
      cwd: execution.cwd,
      controller: Boolean(controller && typeof controller.create === 'function' && typeof controller.prompt === 'function'),
    },
    fetchedAt: new Date().toISOString(),
  }
}

// ---- v1.0 Phase D: the flywheel ---------------------------------------------
//
// A colour is a claim, so it has to be cheap to record and impossible to fake:
// green means a script passed AND the artifact exists, and yellow is "a human
// looked". Red must carry a reason, and one red demotes a card — it has to earn
// two fresh greens before it is recommended again. Everything else here is
// arithmetic over the records: promotion, per-green cost, ranking, decay.

const OUTCOMES = join(WB_DIR, 'outcomes.json')
const MAX_OUTCOMES = 400
const OUTCOME_COLOURS = ['green', 'yellow', 'red']
const DECAY_DAYS = 30

function readOutcomes() {
  const raw = readJsonSafe(OUTCOMES, null)
  return { version: 1, items: Array.isArray(raw?.items) ? raw.items.filter(item => item && typeof item === 'object') : [] }
}

function writeOutcomes(value) {
  ensureDir()
  const items = value.items.slice(0, MAX_OUTCOMES)
  writeFileSync(OUTCOMES, JSON.stringify({ version: 1, items }, null, 2) + '\n', 'utf-8')
}

function normaliseTokens(raw) {
  if (!raw || typeof raw !== 'object') return null
  const pick = key => {
    const value = Number(raw[key])
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
  }
  const tokens = { input: pick('input'), output: pick('output'), cacheRead: pick('cacheRead'), cacheWrite: pick('cacheWrite') }
  if (!tokens.input && !tokens.output && !tokens.cacheRead && !tokens.cacheWrite) return null
  return tokens
}

// One outcome per run: recording again replaces the previous colour instead of
// double counting the same work.
function recordOutcome(entry) {
  const store = readOutcomes()
  const ratio = {
    runId: entry.runId,
    templateId: entry.templateId || '',
    templateTitle: entry.templateTitle || '',
    colour: entry.colour,
    reason: entry.reason || '',
    tokens: normaliseTokens(entry.tokens),
    at: entry.at || Date.now(),
  }
  const items = [ratio, ...store.items.filter(item => item.runId !== ratio.runId)]
  writeOutcomes({ items })
  return ratio
}

function templateOutcomeCards() {
  const templates = readTemplates()
  const runs = readRuns()
  const outcomes = readOutcomes().items
  const now = Date.now()
  const cards = templates.map(template => {
    const records = outcomes
      .filter(item => item.templateId === template.id)
      .sort((left, right) => left.at - right.at)
    let greens = 0
    let reds = 0
    let greenStreak = 0
    let promotedAt = 0
    let tokens = null
    for (const record of records) {
      if (record.colour === 'green') {
        greens += 1
        greenStreak += 1
        if (greenStreak >= 2 && !promotedAt) promotedAt = record.at
      } else if (record.colour === 'red') {
        reds += 1
        greenStreak = 0
        promotedAt = 0
      }
      if (record.tokens) {
        tokens = tokens || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
        for (const key of ['input', 'output', 'cacheRead', 'cacheWrite']) tokens[key] += Number(record.tokens[key]) || 0
      }
    }
    const promoted = greens >= 2 && greenStreak >= 2
    const demoted = reds > 0 && greenStreak < 2
    const lastUsedAt = Number(template.lastUsedAt) || 0
    const archived = lastUsedAt > 0 && now - lastUsedAt > DECAY_DAYS * 86400000
    const reuse = promotedAt
      ? runs.filter(run => run.templateId === template.id && Number(run.createdAt) > promotedAt).length
      : 0
    const total = greens + reds
    return {
      id: template.id,
      title: template.title,
      green: greens,
      yellow: records.filter(item => item.colour === 'yellow').length,
      red: reds,
      greenRate: total ? Math.round((greens / total) * 100) / 100 : 0,
      promoted,
      demoted,
      archived,
      promotedAt: promotedAt ? new Date(promotedAt).toISOString() : '',
      reuseAfterPromotion: reuse,
      useCount: Number(template.uses) || 0,
      lastUsedAt: lastUsedAt ? new Date(lastUsedAt).toISOString() : '',
      // Cost is per GREEN card, not per card: dividing by all runs would hide
      // exactly the failures that make a card expensive.
      costPerGreen: tokens && greens ? {
        input: Math.round(tokens.input / greens),
        output: Math.round(tokens.output / greens),
        cacheRead: Math.round(tokens.cacheRead / greens),
        cacheWrite: Math.round(tokens.cacheWrite / greens),
      } : null,
      costKnown: Boolean(tokens && greens),
    }
  })
  const candidates = cards
    .filter(card => card.promoted && !card.archived)
    .sort((left, right) => (right.greenRate - left.greenRate) || (String(right.lastUsedAt).localeCompare(String(left.lastUsedAt))))
    .slice(0, 3)
    .map(card => ({
      id: card.id,
      title: card.title,
      green: card.green,
      red: card.red,
      greenRate: card.greenRate,
      costPerGreen: card.costPerGreen,
      reuseAfterPromotion: card.reuseAfterPromotion,
      because: card.green + ' 绿 / ' + card.red + ' 红 · 绿率 ' + Math.round(card.greenRate * 100) + '%',
    }))
  return {
    ok: true,
    cards,
    candidates,
    rules: {
      promote: 'green ≥ 2 且最近没有红',
      demote: '红一次即降级，需要再攒 2 个绿才复出',
      decay: '超过 ' + DECAY_DAYS + ' 天没用 → 归档（不删）',
      cost: '每绿卡成本 = token 合计 / 绿卡数；没有 token 数据时未知',
    },
    totals: {
      templates: templates.length,
      recorded: readOutcomes().items.length,
      promoted: cards.filter(card => card.promoted).length,
      demoted: cards.filter(card => card.demoted).length,
      archived: cards.filter(card => card.archived).length,
    },
    fetchedAt: new Date().toISOString(),
  }
}

// ---- v1.0: the node graph ---------------------------------------------------
//
// A node is a quintuple — kind, typed inputs, typed outputs, executor, verifier.
// The registry is the only thing that decides whether a node may run: a kind
// that is not registered has no executor, so the node is gray and refuses to
// run. That rule exists because a green node that never executed is fake green,
// and the whole point of the canvas is that its colours can be trusted.
//
// v1.0 ships one real executor (local template assembly). Model bridges — text
// via LLM, image, video — are declared but unregistered on purpose: the panel
// then shows exactly which nodes need the v1.1 bridge instead of pretending.

const FLOW = join(WB_DIR, 'flow.json')
const FLOW_OUT = join(WB_DIR, 'flow-out')
const MAX_FLOW_NODES = 40
const MAX_FLOW_EDGES = 80
const PORT_TYPES = new Set(['text', 'file', 'image', 'json', 'any'])
const VERIFIER_KINDS = new Set(['file-exists', 'file-contains'])

const EXECUTOR_KINDS = {
  text: { label: '模板拼装（本地，真跑）', available: true },
  llm: { label: '模型生文（v1.1 桥，未接）', available: false },
  image: { label: '模型生图（v1.1 桥，未接）', available: false },
  video: { label: '模型生视频（v1.1 桥，未接）', available: false },
}

function cleanFlowText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
}

function readFlow() {
  const raw = readJsonSafe(FLOW, null)
  return {
    version: 1,
    nodes: Array.isArray(raw?.nodes) ? raw.nodes.filter(node => node && typeof node === 'object').map(node => ({ ...node })) : [],
    edges: Array.isArray(raw?.edges) ? raw.edges.filter(edge => edge && typeof edge === 'object').map(edge => ({ ...edge })) : [],
    state: raw && typeof raw.state === 'object' && raw.state ? { ...raw.state } : {},
  }
}

function writeFlow(flow) {
  ensureDir()
  const body = { version: 1, nodes: flow.nodes, edges: flow.edges, state: flow.state || {} }
  writeFileSync(FLOW, JSON.stringify(body, null, 2) + '\n', 'utf-8')
}

function normaliseFlowPorts(raw, side) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 8).map((port, index) => {
    const name = cleanFlowText(port?.name, 40) || side + (index + 1)
    const type = cleanFlowText(port?.type, 20)
    return { name, type: PORT_TYPES.has(type) ? type : 'text' }
  })
}

function normaliseExecutorParams(kind, params) {
  if (!params || typeof params !== 'object') return {}
  if (kind === 'text') {
    return {
      content: String(params.content ?? '').slice(0, 8000),
      template: String(params.template ?? '').slice(0, 4000),
    }
  }
  return {}
}

function normaliseVerifier(raw) {
  const kind = cleanFlowText(raw?.kind, 40)
  if (!VERIFIER_KINDS.has(kind)) return { kind: 'file-exists', path: '' }
  const verifier = { kind, path: cleanFlowText(raw?.path, 200) }
  if (kind === 'file-contains') verifier.contains = String(raw?.contains ?? '').slice(0, 200)
  return verifier
}

function normaliseFlowNode(raw, existing = null) {
  const title = cleanFlowText(raw?.title ?? existing?.title, 120) || '未命名节点'
  const kind = cleanFlowText(raw?.kind ?? existing?.kind, 40) || 'step'
  const executorKind = cleanFlowText(raw?.executor?.kind ?? existing?.executor?.kind, 40)
  const params = normaliseExecutorParams(executorKind, raw?.executor?.params !== undefined ? raw.executor.params : existing?.executor?.params)
  const inputs = normaliseFlowPorts(raw?.inputs !== undefined ? raw.inputs : existing?.inputs, 'in')
  const outputs = normaliseFlowPorts(raw?.outputs !== undefined ? raw.outputs : existing?.outputs, 'out')
  const verifier = normaliseVerifier(raw?.verifier !== undefined ? raw.verifier : existing?.verifier)
  return {
    id: existing ? existing.id : ('n_' + createHash('sha256').update(title + '|' + kind + '|' + Date.now() + '|' + Math.random()).digest('hex').slice(0, 8)),
    kind,
    title,
    inputs,
    outputs,
    executor: { kind: executorKind, params },
    verifier,
    updatedAt: new Date().toISOString(),
  }
}

function topoOrder(flow) {
  const ids = flow.nodes.map(node => node.id)
  const indegree = new Map(ids.map(id => [id, 0]))
  const outgoing = new Map(ids.map(id => [id, []]))
  for (const edge of flow.edges) {
    const from = edge?.from?.node
    const to = edge?.to?.node
    if (!indegree.has(from) || !indegree.has(to)) continue
    indegree.set(to, indegree.get(to) + 1)
    outgoing.get(from).push(to)
  }
  const queue = ids.filter(id => indegree.get(id) === 0)
  const order = []
  while (queue.length) {
    const id = queue.shift()
    order.push(id)
    for (const next of outgoing.get(id)) {
      indegree.set(next, indegree.get(next) - 1)
      if (indegree.get(next) === 0) queue.push(next)
    }
  }
  return order.length === ids.length ? order : null
}

function validateFlow(flow) {
  const issues = []
  const byId = new Map()
  for (const node of flow.nodes) {
    if (byId.has(node.id)) issues.push({ code: 'duplicate-node', nodeId: node.id, message: '节点 id 重复：' + node.id })
    byId.set(node.id, node)
    if (!EXECUTOR_KINDS[node.executor?.kind]) {
      issues.push({ code: 'unknown-executor', nodeId: node.id, message: '未注册的 executor：' + String(node.executor?.kind || '（空）') })
    }
    if (!VERIFIER_KINDS.has(node.verifier?.kind)) {
      issues.push({ code: 'unknown-verifier', nodeId: node.id, message: '未注册的 verifier：' + String(node.verifier?.kind || '（空）') })
    }
    for (const port of node.inputs || []) {
      if (!PORT_TYPES.has(port.type)) issues.push({ code: 'unknown-port-type', nodeId: node.id, message: '端口类型未知：' + port.type })
    }
    for (const port of node.outputs || []) {
      if (!PORT_TYPES.has(port.type)) issues.push({ code: 'unknown-port-type', nodeId: node.id, message: '端口类型未知：' + port.type })
    }
  }
  const boundInputs = new Map()
  for (const edge of flow.edges) {
    const from = byId.get(edge?.from?.node)
    const to = byId.get(edge?.to?.node)
    if (!from || !to) {
      issues.push({ code: 'unknown-endpoint', edgeId: edge.id || '', message: '边的端点不在画布上' })
      continue
    }
    const outPort = (from.outputs || []).find(port => port.name === edge.from.port)
    const inPort = (to.inputs || []).find(port => port.name === edge.to.port)
    if (!outPort || !inPort) {
      issues.push({ code: 'unknown-port', edgeId: edge.id || '', message: '边的端口不存在：' + String(edge.from.port || '?') + ' → ' + String(edge.to.port || '?') })
      continue
    }
    const compatible = outPort.type === inPort.type || outPort.type === 'any' || inPort.type === 'any'
    if (!compatible) {
      issues.push({
        code: 'type-mismatch', edgeId: edge.id || '',
        message: (from.title || from.id) + '.' + outPort.name + ' 产出 ' + outPort.type + '，而 ' + (to.title || to.id) + '.' + inPort.name + ' 需要 ' + inPort.type,
      })
    }
    const key = to.id + ':' + inPort.name
    if (boundInputs.has(key)) {
      issues.push({ code: 'input-bound-twice', edgeId: edge.id || '', message: (to.title || to.id) + '.' + inPort.name + ' 被两条边同时接上' })
    }
    boundInputs.set(key, edge)
    if (from.id === to.id) issues.push({ code: 'self-loop', edgeId: edge.id || '', message: '节点不能接回自己' })
  }
  const order = topoOrder(flow)
  if (!order) issues.push({ code: 'cycle', message: '这些边形成了环，画布无法排序执行' })
  return { ok: issues.length === 0, issues, order: order || [] }
}

function flowNodeRuntime(node, flow) {
  const registered = EXECUTOR_KINDS[node.executor?.kind]
  const available = Boolean(registered && registered.available)
  const record = flow.state?.[node.id] || null
  return {
    executor: node.executor?.kind || '',
    executorLabel: registered?.label || '未知 executor',
    available,
    status: available ? String(record?.status || 'idle') : 'gray',
    artifact: String(record?.artifact || ''),
    note: available ? String(record?.note || '') : '没有 executor：这个节点在 v1.0 里跑不了。',
    checkedAt: String(record?.checkedAt || ''),
  }
}

// A first-run graph has to be one that can actually go green, or the canvas
// teaches the wrong lesson. Two nodes, one typed edge, one artifact each: the
// source writes its literal text, the sink pastes it into a template, and both
// verifiers check a file that exists. Nothing here needs a model.
function flowDemoSpec() {
  const source = normaliseFlowNode({
    title: '资料（原文）',
    kind: 'source',
    inputs: [],
    outputs: [{ name: 'out', type: 'text' }],
    executor: {
      kind: 'text',
      params: {
        content: '本周完成三件事：\n1. 把记忆收成一份 JSON 真源；\n2. 右栏三时刻接上真实会话；\n3. 画布上每个绿点都有盘上的产物。',
      },
    },
    verifier: { kind: 'file-exists', path: '' },
  })
  source.id = 'n_demo_source'
  const sink = normaliseFlowNode({
    title: '周报（模板）',
    kind: 'sink',
    inputs: [{ name: 'in', type: 'text' }],
    outputs: [{ name: 'out', type: 'text' }],
    executor: { kind: 'text', params: { template: '## 本周周报\n\n{{input}}\n\n— 由画布示例生成' } },
    verifier: { kind: 'file-contains', path: '', contains: '本周完成' },
  })
  sink.id = 'n_demo_report'
  return {
    version: 1,
    nodes: [source, sink],
    edges: [{ id: 'e_demo_out', from: { node: 'n_demo_source', port: 'out' }, to: { node: 'n_demo_report', port: 'in' } }],
    state: {},
  }
}

function flowPayload(flow) {
  const validation = validateFlow(flow)
  const badEdges = new Set(validation.issues.map(issue => issue.edgeId).filter(Boolean))
  const badNodes = new Set(validation.issues.map(issue => issue.nodeId).filter(Boolean))
  return {
    ok: true,
    version: 1,
    nodes: flow.nodes.map(node => ({
      ...node,
      runtime: flowNodeRuntime(node, flow),
      issues: validation.issues.filter(issue => issue.nodeId === node.id).map(issue => issue.message),
      blocked: badNodes.has(node.id),
    })),
    edges: flow.edges.map(edge => ({ ...edge, valid: !badEdges.has(edge.id) })),
    validation,
    order: validation.order,
    executors: Object.entries(EXECUTOR_KINDS).map(([kind, value]) => ({ kind, label: value.label, available: value.available })),
    verifiers: [...VERIFIER_KINDS],
    fetchedAt: new Date().toISOString(),
  }
}

function flowArtifactPath(candidate) {
  const target = resolve(FLOW_OUT, candidate || '')
  const rel = relative(FLOW_OUT, target)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return ''
  return target
}

function verifyFlowArtifact(node, artifact) {
  const verifier = node.verifier || { kind: 'file-exists' }
  const path = flowArtifactPath(verifier.path) || artifact
  if (!path) return { status: 'red', note: '没有可验证的产物路径' }
  let exists = false
  let bytes = 0
  try {
    const info = statSync(path)
    exists = info.isFile()
    bytes = info.size
  } catch { exists = false }
  if (!exists || bytes === 0) return { status: 'red', note: '产物不存在：' + relative(FLOW_OUT, path) }
  if (verifier.kind === 'file-contains') {
    const text = readSafe(path)
    if (!verifier.contains) return { status: 'red', note: 'file-contains 没有给出要匹配的文字' }
    if (!text.includes(verifier.contains)) return { status: 'red', note: '产物里找不到「' + verifier.contains + '」' }
  }
  return { status: 'green', note: relative(FLOW_OUT, path) }
}

function resolveUpstreamText(flow, node) {
  const chunks = []
  for (const edge of flow.edges) {
    if (edge?.to?.node !== node.id) continue
    const source = flow.nodes.find(item => item.id === edge.from.node)
    const record = source ? flow.state?.[source.id] : null
    const artifact = record?.artifact ? readSafe(record.artifact) : ''
    if (artifact.trim()) chunks.push(artifact.trim())
  }
  return chunks.join('\n\n')
}

function executeFlowNode(flow, node) {
  // Only registered executors reach this function; the caller already refused
  // gray nodes, so an unknown kind here is a bug, not a user input.
  if (node.executor.kind === 'text') {
    const params = node.executor.params || {}
    const upstream = resolveUpstreamText(flow, node)
    // A literal node has content and no template; a sink has a template and no
    // literal. Defaulting to the wrong placeholder would write an empty file and
    // the verifier would call it red for the wrong reason.
    const fallback = String(params.content || '') ? '{{content}}' : '{{input}}'
    const body = String(params.template || fallback)
      .replace(/\{\{input\}\}/g, upstream)
      .replace(/\{\{content\}\}/g, String(params.content || ''))
    mkdirSync(FLOW_OUT, { recursive: true })
    const artifact = join(FLOW_OUT, node.id + '.md')
    writeFileSync(artifact, body, 'utf-8')
    return artifact
  }
  return ''
}

function runFlow(flow) {
  const validation = validateFlow(flow)
  if (!validation.ok) return { ok: false, code: 'flow-invalid', validation }
  const results = []
  for (const nodeId of validation.order) {
    const node = flow.nodes.find(item => item.id === nodeId)
    const runtime = flowNodeRuntime(node, flow)
    if (!runtime.available) {
      // Gray stays gray. It is recorded so the canvas can say why, never as a
      // green that no script and no artifact backed.
      flow.state[nodeId] = { status: 'gray', artifact: '', note: runtime.note, checkedAt: new Date().toISOString() }
      results.push({ nodeId, status: 'gray', artifact: '', note: runtime.note })
      continue
    }
    const artifact = executeFlowNode(flow, node)
    const verified = verifyFlowArtifact(node, artifact)
    flow.state[nodeId] = { status: verified.status, artifact, note: verified.note, checkedAt: new Date().toISOString() }
    results.push({ nodeId, status: verified.status, artifact, note: verified.note })
  }
  writeFlow(flow)
  return { ok: true, results }
}

function verifyFlow(flow) {
  const results = []
  for (const node of flow.nodes) {
    const runtime = flowNodeRuntime(node, flow)
    if (!runtime.available) {
      results.push({ nodeId: node.id, status: 'gray', note: runtime.note })
      continue
    }
    const record = flow.state?.[node.id] || {}
    const verified = verifyFlowArtifact(node, record.artifact || '')
    flow.state[node.id] = { status: verified.status, artifact: record.artifact || '', note: verified.note, checkedAt: new Date().toISOString() }
    results.push({ nodeId: node.id, status: verified.status, note: verified.note })
  }
  writeFlow(flow)
  return { ok: true, results }
}

// ---- v0.6: reusable modules, session targeting, derived reports -------------
//
// The panel must not hand raw event streams to a human. These helpers turn the
// stored records into the three things a person actually needs: what was
// decided/concluded, which artifacts came out, and what still needs an answer.

const MODULE_KINDS = new Set(['goal', 'plan', 'instruction'])

function readModules() {
  const raw = readJsonSafe(MODULES, null)
  if (!raw || !Array.isArray(raw.items)) return []
  return raw.items.filter(item => item && typeof item === 'object' && typeof item.id === 'string')
}

function writeModules(items) {
  ensureDir()
  writeFileSync(MODULES, JSON.stringify({ version: 1, items: items.slice(0, MAX_MODULES) }, null, 2), 'utf-8')
}

function newModuleId() {
  return 'mod_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ---- v0.7: templates (a module combination + a default session target) -----
//
// A module is raw material; a template is the recipe. Picking one fills every
// slot at once, which is the difference between "reusable pieces exist" and
// "reuse is cheaper than retyping".

const TEMPLATE_SESSION_MODES = new Set(['new', 'existing', 'any'])

function readTemplates() {
  const raw = readJsonSafe(TEMPLATES, null)
  if (!raw || !Array.isArray(raw.items)) return []
  return raw.items.filter(item => item && typeof item === 'object' && typeof item.id === 'string')
}

function writeTemplates(items) {
  ensureDir()
  writeFileSync(TEMPLATES, JSON.stringify({ version: 1, items: items.slice(0, MAX_TEMPLATES) }, null, 2), 'utf-8')
}

function newTemplateId() {
  return 'tpl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function templatePayload(template) {
  return {
    id: template.id,
    title: template.title,
    goal: template.goal || '',
    plan: template.plan || '',
    instruction: template.instruction || '',
    moduleIds: Array.isArray(template.moduleIds) ? template.moduleIds : [],
    model: template.model || '',
    sessionMode: template.sessionMode || 'any',
    uses: Number(template.uses) || 0,
    lastUsedAt: Number(template.lastUsedAt) || 0,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

// Bump the templates a dispatch actually used. Kept separate from the module
// counter so a template's popularity can be told apart from its parts'.
function noteTemplateUse(templateId) {
  if (!templateId) return null
  const templates = readTemplates()
  const template = templates.find(item => item.id === templateId)
  if (!template) return null
  template.uses = (Number(template.uses) || 0) + 1
  template.lastUsedAt = Date.now()
  writeTemplates(templates)
  return template
}

function sessionCwd(ctx, sessionId) {
  const id = String(sessionId || '').trim()
  if (!id) return ''
  try {
    const session = serviceGet(ctx, 'sessions')?.get?.(id)
    const cwd = firstValue(session?.meta?.cwd, session?.cwd)
    return typeof cwd === 'string' ? cwd : ''
  } catch {
    return ''
  }
}

function sessionTitle(ctx, sessionId) {
  const events = sessionEventsOf(ctx, sessionId)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event?.type !== 'session/title') continue
    const title = firstValue(event?.data?.title, event?.data?.text, event?.data?.name)
    if (typeof title === 'string' && title.trim()) return title.trim().slice(0, 120)
  }
  return ''
}

async function sessionsPayload(ctx) {
  const controller = serviceGet(ctx, 'sessionController')
  const capable = Boolean(controller && typeof controller.list === 'function')
  if (!capable) return { ok: true, available: false, items: [], fetchedAt: new Date().toISOString() }
  let listed = []
  try { listed = await controller.list() } catch { listed = [] }
  const items = (Array.isArray(listed) ? listed : [])
    .filter(item => item && typeof item.sessionId === 'string')
    .map(item => ({
      sessionId: item.sessionId,
      title: sessionTitle(ctx, item.sessionId) || '',
      running: item.running === true,
      blank: item.blank === true,
      updatedAt: Number(item.updatedAt) || 0,
    }))
    .slice(0, 60)
  return { ok: true, available: true, items, fetchedAt: new Date().toISOString() }
}

// The digest is deliberately dumb and predictable: the panel shows it as a
// summary and always keeps the raw reply one click away. It never claims more
// than the text supports.
function firstParagraph(text) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!clean) return ''
  const first = clean.split(/\n\s*\n/)[0].trim()
  return first.slice(0, 600)
}

function bulletPoints(text, max = 5) {
  const out = []
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const match = /^\s*(?:[-*+·]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+)$/.exec(line)
    if (!match) continue
    const value = match[1].replace(/\*\*/g, '').replace(/`/g, '').trim()
    if (value && !out.includes(value)) out.push(value.slice(0, 180))
    if (out.length >= max) break
  }
  return out
}

const PATH_TOKEN = /(?:[A-Za-z]:[\\/][^\s"'`，。；：、）)】\]}>|]+|(?:\.{0,2}\/)?[\w@.\-]+(?:[\\/][\w@.\-]+)*\.[A-Za-z0-9]{1,8})/g

function collectPathTokens(value, sink, depth = 0) {
  if (value == null || depth > 4 || sink.length >= 40) return
  if (typeof value === 'string') {
    for (const match of value.match(PATH_TOKEN) || []) {
      const token = match.trim()
      if (token.length < 3 || token.length > 240) continue
      sink.push(token)
      if (sink.length >= 40) return
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 16)) collectPathTokens(item, sink, depth + 1)
    return
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value).slice(0, 24)) collectPathTokens(item, sink, depth + 1)
  }
}

function artifactList(events, limit = 12) {
  const seen = new Set()
  const out = []
  for (const event of events) {
    if (event?.type !== 'tool/call') continue
    const tool = String(event?.data?.name || 'tool').slice(0, 40)
    const tokens = []
    collectPathTokens(event?.data?.arguments ?? event?.data?.input ?? event?.data, tokens)
    for (const token of tokens) {
      const key = token.replace(/\\/g, '/').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ path: token, tool })
      if (out.length >= limit) return out
    }
  }
  return out
}

function pendingItems(text, max = 5) {
  const out = []
  const cleaned = String(text || '').replace(/\r\n/g, '\n')
  for (const sentence of cleaned.split(/(?<=[。！？!?])\s*|\n+/)) {
    const value = sentence.replace(/\*\*/g, '').replace(/`/g, '').trim()
    if (!value || value.length < 4) continue
    if (!/[？?]|需要确认|请确认|待确认|待你决定|需要你决定|请你决定|要不要|选择哪/.test(value)) continue
    if (!out.includes(value)) out.push(value.slice(0, 200))
    if (out.length >= max) break
  }
  return out
}

function reportPayload(ctx, run) {
  const events = sessionEventsOf(ctx, run.sessionId)
  const storedReply = typeof run.reply === 'string' ? run.reply : ''
  const reply = storedReply || (run.status === 'running' ? '' : lastAssistantText(ctx, run.sessionId))
  const progress = runProgress(events) || {}
  const started = Number(run.createdAt) || 0
  const ended = Number(run.updatedAt) || started
  const pending = pendingItems(reply)
  if (run.waiting === true) pending.unshift('会话停在提问上：打开该会话回答后，运行才会继续。')
  const conclusion = firstParagraph(reply)
    || (run.status === 'running' ? '这一轮还没有产出结论（运行中）。' : '这一轮没有产出结论。')
  return {
    ok: true,
    derived: true,
    note: '机器摘要：与原文不一致时以原文为准。',
    run: {
      runId: run.runId,
      goal: run.goal || '',
      status: run.status || 'unknown',
      model: run.model || '',
      sessionId: run.sessionId,
      sessionMode: run.sessionMode || 'new',
      cwd: run.cwd || '',
      plan: run.plan || '',
      instruction: run.instruction || '',
      waiting: run.waiting === true,
    },
    conclusion,
    points: bulletPoints(reply),
    artifacts: artifactList(events),
    pending: pending.slice(0, 5),
    stats: {
      durationMs: Math.max(0, ended - started),
      // Live session events are the most accurate source while the session is
      // loaded; the stored counters are the cold-session fallback.
      steps: Number(progress ? progress.steps : run.steps) || 0,
      toolCalls: Number(progress ? progress.toolCalls : run.toolCalls) || 0,
      messages: Number(progress ? progress.messages : run.messages) || 0,
    },
    reply,
    fetchedAt: new Date().toISOString(),
  }
}

export const name = 'dsh-workbench'
export const inject = ['tools', 'webServer', 'connection']

export async function apply(ctx) {
  const disposers = []

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: API_PATH,
    handler: async (req, res) => {
      if (!isLoopbackReq(req)) {
        sendJson(res, 403, { ok: false, error: '只接受本机回环访问' })
        return
      }
      const rejection = ctx.connection.requestRejection(req)
      if (rejection) {
        sendJson(res, rejection, { ok: false, error: '未通过 Harness 浏览器信任校验' })
        return
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: '只支持 GET' })
        return
      }
      sendJson(res, 200, statePayload(ctx))
    },
  }))

// Memory: one authoritative record per project plus the generated AGENTS.md
  // block. GET reads the active project; POST pinpoints the project a session
  // works in (session cwd), which is how the panel stops guessing.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: MEMORY_API_PATH,
    handler: async (req, res) => {
      if (req.method === 'GET') {
        if (!guard(req, res, 'GET')) return
        sendJson(res, 200, memoryPayload())
        return
      }
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const requested = normaliseText(input.root, 500)
      const sessionId = normaliseText(input.sessionId, 120)
      if (requested === INVALID || sessionId === INVALID) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' })
        return
      }
      const root = (requested && requested) || sessionCwd(ctx, sessionId || '') || defaultMemoryRoot()
      const project = ensureProject(root, sessionId || '')
      if (!project.ok) { sendJson(res, 400, { ok: false, error: project.error }); return }
      const projects = readProjects()
      projects.active = project.key
      writeProjects(projects)
      appendAudit({ action: 'memory.activate', requestId: requestId(input.requestId), summary: project.key + ' ' + project.root })
      sendJson(res, 200, { ...memoryPayload(), activated: project.key })
    },
  }))

// v1.0 flow: one hard-coded rule about where work runs, the route that acts on
  // its sync side, one live view of the current session, and one close-out write.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: CHANNEL_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const text = normaliseText(input.text, 4000)
      if (text === INVALID) { sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return }
      sendJson(res, 200, { ok: true, ...channelFor({ ...input, text: text || '' }) })
    },
  }))

  // Sync work happens in the session the user is already looking at: the prompt
  // is queued into it, so history, approvals and context stay in one place. The
  // channel rule is enforced here, not only in the panel.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: SYNC_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const sessionId = normaliseText(input.sessionId, 120)
      const text = normaliseText(input.text, 4000)
      if (sessionId === INVALID || text === INVALID) { sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return }
      if (!sessionId) { sendJson(res, 400, { ok: false, error: '缺少 sessionId：同步执行只发生在某个具体会话里' }); return }
      if (!text) { sendJson(res, 400, { ok: false, error: 'text 不能为空' }); return }
      const decision = channelFor({ ...input, text })
      if (decision.channel !== 'sync') {
        sendJson(res, 409, { ok: false, code: 'channel-async', ...decision })
        return
      }
      const controller = serviceGet(ctx, 'sessionController')
      if (!controller || typeof controller.prompt !== 'function') {
        sendJson(res, 501, { ok: false, code: 'unsupported', error: '当前 profile 未提供 sessionController' })
        return
      }
      const sessions = serviceGet(ctx, 'sessions')
      if (sessions && typeof sessions.get === 'function' && !sessions.get(sessionId)) {
        sendJson(res, 404, { ok: false, code: 'unknown-session', error: '找不到该会话，可能已被关闭' })
        return
      }
      const requestId = newRunId()
      const admission = new AbortController()
      try {
        const ack = await controller.prompt({
          sessionId,
          requestId,
          mode: 'queue',
          content: [{ type: 'text', text }],
        }, admission.signal)
        const accepted = ack?.accepted === true || ack?.value?.accepted === true
        if (!accepted) throw new Error('sessionController.prompt 未被接受')
      } catch (error) {
        appendAudit({ action: 'sync.failed', requestId, summary: String(error?.message || error).slice(0, 160) })
        sendJson(res, 502, { ok: false, code: 'prompt-failed', error: String(error?.message || error) })
        return
      }
      appendAudit({ action: 'sync.prompt', requestId, summary: text.slice(0, 120) })
      sendJson(res, 200, {
        ok: true,
        sessionId,
        requestId,
        channel: 'sync',
        reasons: decision.reasons,
        acceptedAt: new Date().toISOString(),
      })
    },
  }))

  // The current session's own progress, so the "working" moment can show sync
  // work without pretending it is a dispatch.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: LIVE_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      const url = new URL(String(req.url || ''), 'http://127.0.0.1')
      const sessionId = String(url.searchParams.get('sessionId') || '').slice(0, 120)
      if (!sessionId) { sendJson(res, 400, { ok: false, error: '缺少 sessionId' }); return }
      const events = sessionEventsOf(ctx, sessionId)
      const progress = runProgress(events) || {}
      let running = false
      try {
        const controller = serviceGet(ctx, 'sessionController')
        const listed = controller && typeof controller.list === 'function' ? await controller.list() : null
        const items = Array.isArray(listed) ? listed : (listed?.value?.items ?? listed?.items ?? [])
        running = Boolean(items.find(item => item && item.sessionId === sessionId)?.running)
      } catch { running = false }
      const reply = lastAssistantText(ctx, sessionId)
      sendJson(res, 200, {
        ok: true,
        sessionId,
        running,
        steps: Number(progress.steps) || 0,
        toolCalls: Number(progress.toolCalls) || 0,
        messages: Number(progress.messages) || 0,
        waiting: running ? Boolean(progress.waiting) : false,
        activityAt: Number(progress.activityAt) || 0,
        lastText: String(reply || '').slice(0, 2000),
        turnEnd: lastTurnEndKind(events) || '',
        fetchedAt: new Date().toISOString(),
      })
    },
  }))

  // One close-out write: next step + outcome colour + decision. It is the same
  // record wb_close writes, so the panel and the agent never disagree.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: CLOSE_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const next = normaliseList(input.next, 3, 500)
      const outcome = normaliseText(input.outcome, 20)
      const decision = normaliseText(input.decision, 4000)
      const title = normaliseText(input.title, 90)
      const runId = normaliseText(input.runId, 80)
      if (next === INVALID || outcome === INVALID || decision === INVALID || title === INVALID || runId === INVALID) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' })
        return
      }
      if (!Array.isArray(next) || !next.length) {
        sendJson(res, 400, { ok: false, error: 'next 不能为空：收工必须说清下次的第一步' })
        return
      }
      if (outcome && !['green', 'yellow', 'red'].includes(outcome)) {
        sendJson(res, 400, { ok: false, error: 'outcome 只能是 green / yellow / red' })
        return
      }
      if (outcome === 'red' && !decision) {
        sendJson(res, 400, { ok: false, error: '红必须写原因：收工时 decision 就是原因' })
        return
      }
      const project = activeProject()
      if (!project.ok) { sendJson(res, 503, { ok: false, error: project.error || '项目不可用' }); return }
      const stamp = new Date().toISOString()
      const memory = { ...project.memory }
      memory.next = next.slice(0, 3)
      memory.closedAt = stamp
      if (outcome) memory.outcome = outcome
      if (runId) memory.basis = { ...memory.basis, runId }
      if (decision) appendDecision(memory, { text: decision, title: title || '' })
      const saved = saveMemory(memory, { updatedAt: stamp })
      // The close-out colour is the same fact the flywheel ranks on, so it is
      // written to both stores in the same call instead of asking twice.
      let outcomeRecord = null
      if (runId && outcome) {
        const runs = readRuns()
        const run = runs.find(item => item.runId === runId)
        if (run) {
          outcomeRecord = recordOutcome({
            runId,
            templateId: run.templateId || '',
            templateTitle: run.templateTitle || '',
            colour: outcome,
            reason: decision || '',
            tokens: input.tokens,
          })
          run.outcome = outcome
          run.outcomeAt = outcomeRecord.at
          run.updatedAt = Date.now()
          writeRuns(runs)
          appendAudit({ action: 'outcome.record', requestId: requestId(input.requestId), summary: outcome + (run.templateTitle ? ' · ' + run.templateTitle : '') + ' · close' })
        }
      }
      appendAudit({
        action: 'memory.close',
        requestId: requestId(input.requestId),
        summary: (outcome || 'no-outcome') + ' ' + String(next[0] || '').slice(0, 80),
      })
      sendJson(res, 200, {
        ok: true,
        closedAt: stamp,
        outcome: memory.outcome || '',
        next: memory.next,
        decisionAppended: Boolean(decision),
        project: { key: project.key, root: project.root, name: saved.memory.name },
        agents: saved.agents,
        gap: memoryGap(saved.memory),
        outcomeRecord,
      })
    },
  }))

// ---- v1.0 node graph routes ----------------------------------------------
  // Read the whole graph: nodes with their runtime colour, edges with their
  // validity, the executor registry, and the validation issues. This is what the
  // canvas paints, so it must never invent a node or an edge.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLOW_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      sendJson(res, 200, flowPayload(readFlow()))
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLOW_NODE_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const flow = readFlow()
      const id = cleanFlowText(input.id, 40)
      const existing = id ? flow.nodes.find(node => node.id === id) : null
      if (id && !existing) { sendJson(res, 404, { ok: false, error: '没有这个节点' }); return }
      if (!existing && flow.nodes.length >= MAX_FLOW_NODES) {
        sendJson(res, 409, { ok: false, error: '节点数已达上限 ' + MAX_FLOW_NODES })
        return
      }
      if (!cleanFlowText(input.title, 120) && !existing) {
        sendJson(res, 400, { ok: false, error: '节点需要标题' })
        return
      }
      const node = normaliseFlowNode(input, existing)
      if (existing) {
        flow.nodes = flow.nodes.map(item => (item.id === node.id ? node : item))
      } else {
        flow.nodes.push(node)
      }
      const validation = validateFlow(flow)
      if (!validation.ok && !existing) {
        // A new node that already breaks the graph is refused rather than saved
        // in a state the user has to debug later.
        const fatal = validation.issues.filter(issue => issue.nodeId === node.id)
        if (fatal.length) { sendJson(res, 409, { ok: false, code: 'node-rejected', issues: fatal }); return }
      }
      writeFlow(flow)
      appendAudit({
        action: existing ? 'flow.node.update' : 'flow.node',
        requestId: requestId(input.requestId),
        summary: node.title + ' · ' + (node.executor.kind || '无 executor') + ' · ' + (node.verifier.kind || '无 verifier'),
      })
      sendJson(res, 200, flowPayload(flow))
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLOW_NODE_DELETE_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const id = cleanFlowText(body.json.id, 40)
      const flow = readFlow()
      const node = flow.nodes.find(item => item.id === id)
      if (!node) { sendJson(res, 404, { ok: false, error: '没有这个节点' }); return }
      flow.nodes = flow.nodes.filter(item => item.id !== id)
      flow.edges = flow.edges.filter(edge => edge.from?.node !== id && edge.to?.node !== id)
      delete flow.state[id]
      writeFlow(flow)
      appendAudit({ action: 'flow.node.delete', requestId: requestId(body.json.requestId), summary: node.title })
      sendJson(res, 200, flowPayload(flow))
    },
  }))

  // The one place an illegal edge can be refused. Type compatibility is checked
  // against the declared ports; a cycle, a double-bound input and a self-loop are
  // refused for the same reason: execution would have no honest order.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLOW_EDGE_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const fromNode = cleanFlowText(input.fromNode, 40)
      const fromPort = cleanFlowText(input.fromPort, 40)
      const toNode = cleanFlowText(input.toNode, 40)
      const toPort = cleanFlowText(input.toPort, 40)
      if (!fromNode || !fromPort || !toNode || !toPort) {
        sendJson(res, 400, { ok: false, error: '一条边需要 fromNode/fromPort/toNode/toPort' })
        return
      }
      const flow = readFlow()
      if (flow.edges.length >= MAX_FLOW_EDGES) { sendJson(res, 409, { ok: false, error: '边数已达上限 ' + MAX_FLOW_EDGES }); return }
      const edge = { id: 'e_' + createHash('sha256').update(fromNode + '>'.repeat(1) + fromPort + '|' + toNode + '|' + toPort).digest('hex').slice(0, 8), from: { node: fromNode, port: fromPort }, to: { node: toNode, port: toPort } }
      const candidate = { ...flow, edges: flow.edges.concat([edge]) }
      const before = validateFlow(flow)
      const validation = validateFlow(candidate)
      // Reject anything this edge newly broke. A cycle names no single edge, so
      // comparing against the previous validation is the only honest test.
      const keyOf = issue => [issue.code, issue.edgeId || '', issue.nodeId || '', issue.message || ''].join('|')
      const known = new Set(before.issues.map(keyOf))
      const introduced = validation.issues.filter(issue => !known.has(keyOf(issue)))
      if (introduced.length) {
        sendJson(res, 409, { ok: false, code: 'edge-rejected', issues: introduced, edge })
        return
      }
      writeFlow(candidate)
      appendAudit({ action: 'flow.edge', requestId: requestId(input.requestId), summary: fromNode + '.' + fromPort + ' → ' + toNode + '.' + toPort })
      sendJson(res, 200, flowPayload(candidate))
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLOW_EDGE_DELETE_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const id = cleanFlowText(body.json.id, 60)
      const flow = readFlow()
      if (!flow.edges.some(edge => edge.id === id)) { sendJson(res, 404, { ok: false, error: '没有这条边' }); return }
      flow.edges = flow.edges.filter(edge => edge.id !== id)
      writeFlow(flow)
      appendAudit({ action: 'flow.edge.delete', requestId: requestId(body.json.requestId), summary: id })
      sendJson(res, 200, flowPayload(flow))
    },
  }))

  // Execution is explicit (confirm:true) and refuses an invalid graph. Gray nodes
  // are recorded as gray; green requires a verifier pass on an artifact that is
  // really on disk.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLOW_RUN_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      if (input.confirm !== true) {
        sendJson(res, 400, { ok: false, error: '需要确认：带 confirm:true 才会真跑画布' })
        return
      }
      const flow = readFlow()
      const result = runFlow(flow)
      if (!result.ok) { sendJson(res, 409, { ok: false, code: result.code, validation: result.validation }); return }
      const green = result.results.filter(item => item.status === 'green').length
      const gray = result.results.filter(item => item.status === 'gray').length
      appendAudit({
        action: 'flow.run',
        requestId: requestId(input.requestId),
        summary: result.results.length + ' 个节点 · 绿 ' + green + ' · 灰 ' + gray,
      })
      sendJson(res, 200, { ok: true, results: result.results, flow: flowPayload(readFlow()) })
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLOW_DEMO_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const existing = readFlow()
      if (existing.nodes.length) {
        sendJson(res, 409, { ok: false, code: 'canvas-not-empty', error: '画布上已经有节点了：示例只放进空画布，免得覆盖你的东西' })
        return
      }
      const flow = flowDemoSpec()
      const validation = validateFlow(flow)
      if (!validation.ok) {
        // The seed is code, not user input: if it does not validate the build is
        // wrong, and shipping a broken example would poison the first run.
        sendJson(res, 500, { ok: false, code: 'demo-invalid', error: '示例图自身校验失败', issues: validation.issues })
        return
      }
      writeFlow(flow)
      appendAudit({ action: 'flow.demo', requestId: requestId(body.json.requestId), summary: '示例图：资料 → 周报' })
      sendJson(res, 200, { ok: true, seeded: true, flow: flowPayload(readFlow()) })
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLOW_VERIFY_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const flow = readFlow()
      const result = verifyFlow(flow)
      appendAudit({ action: 'flow.verify', requestId: requestId(body.json.requestId), summary: result.results.map(item => item.nodeId + ':' + item.status).join(' ') })
      sendJson(res, 200, { ok: true, results: result.results, flow: flowPayload(readFlow()) })
    },
  }))

// ---- v1.0 flywheel routes --------------------------------------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: FLYWHEEL_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      sendJson(res, 200, templateOutcomeCards())
    },
  }))

  // Recording a colour is one small write. Red must say why, because a red with
  // no reason teaches the flywheel nothing.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: OUTCOME_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const runId = normaliseText(input.runId, 80)
      const colour = normaliseText(input.colour, 20)
      const reason = normaliseText(input.reason, 500)
      if (runId === INVALID || colour === INVALID || reason === INVALID) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' })
        return
      }
      if (!runId) { sendJson(res, 400, { ok: false, error: '记录结论需要 runId' }); return }
      if (!OUTCOME_COLOURS.includes(colour)) {
        sendJson(res, 400, { ok: false, error: 'colour 只能是 green / yellow / red' })
        return
      }
      if (colour === 'red' && !reason) {
        sendJson(res, 400, { ok: false, error: '红必须写原因：没有原因的失败教不会飞轮' })
        return
      }
      const runs = readRuns()
      const run = runs.find(item => item.runId === runId)
      if (!run) { sendJson(res, 404, { ok: false, error: '没有这个运行记录' }); return }
      const record = recordOutcome({
        runId,
        templateId: run.templateId || '',
        templateTitle: run.templateTitle || '',
        colour,
        reason: reason || '',
        tokens: input.tokens,
      })
      run.outcome = colour
      run.outcomeAt = record.at
      run.updatedAt = Date.now()
      writeRuns(runs)
      appendAudit({
        action: 'outcome.record',
        requestId: requestId(input.requestId),
        summary: colour + (run.templateTitle ? ' · ' + run.templateTitle : '') + (reason ? ' · ' + reason.slice(0, 60) : ''),
      })
      sendJson(res, 200, { ok: true, outcome: record, flywheel: templateOutcomeCards() })
    },
  }))

  // Model catalog is read-only: it exposes whatever the profile's llm service

  // Model catalog is read-only: it exposes whatever the profile's llm service
  // reports so the selector can list the user's real routes, and it never
  // selects or calls a model.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: MODELS_API_PATH,
    handler: async (req, res) => {
      if (!isLoopbackReq(req)) {
        sendJson(res, 403, { ok: false, error: '只接受本机回环访问' })
        return
      }
      const rejection = ctx.connection.requestRejection(req)
      if (rejection) {
        sendJson(res, rejection, { ok: false, error: '未通过 Harness 浏览器信任校验' })
        return
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: '只支持 GET' })
        return
      }
      sendJson(res, 200, await modelCatalogPayload(ctx))
    },
  }))

  // Editable continuity and append-only audit. These are the write endpoints
  // of the control surface: loopback + browser-trust guarded, bounded bodies,
  // and every accepted write is recorded in audit.jsonl.
  const guard = (req, res, method) => {
    if (!isLoopbackReq(req)) {
      sendJson(res, 403, { ok: false, error: '只接受本机回环访问' })
      return false
    }
    const rejection = ctx.connection.requestRejection(req)
    if (rejection) {
      sendJson(res, rejection, { ok: false, error: '未通过 Harness 浏览器信任校验' })
      return false
    }
    if (req.method !== method) {
      sendJson(res, 405, { ok: false, error: `只支持 ${method}` })
      return false
    }
    return true
  }

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: STATE_EDIT_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const before = currentState()
      const mainline = normaliseText(input.mainline, 500)
      const stopped = normaliseText(input.stopped_at, 500)
      const next = normaliseList(input.next, 10, 500)
      const redLines = normaliseList(input.red_lines, 20, 300)
      if (mainline === INVALID || stopped === INVALID || next === INVALID || redLines === INVALID) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' })
        return
      }
      const after = {
        mainline: mainline === undefined ? before.mainline : mainline,
        stopped_at: stopped === undefined ? before.stopped_at : stopped,
        next: next === undefined ? before.next : next,
        red_lines: redLines === undefined ? before.red_lines : redLines,
      }
      const changes = {}
      for (const field of ['mainline', 'stopped_at', 'next', 'red_lines']) {
        if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) changes[field] = { from: before[field], to: after[field] }
      }
      if (Object.keys(changes).length === 0) {
        sendJson(res, 200, { ok: true, changed: false, state: after })
        return
      }
      ensureDir()
      const stamp = new Date().toISOString()
      const project = activeProject()
      if (!project.ok) {
        sendJson(res, 503, { ok: false, error: project.error || '项目不可用' })
        return
      }
      const memory = {
        ...project.memory,
        mainline: after.mainline,
        stopped_at: after.stopped_at,
        next: after.next,
        red_lines: after.red_lines,
        openedAt: stamp,
      }
      const savedMemory = saveMemory(memory, { updatedAt: stamp })
      appendAudit({
        action: 'state.edit',
        requestId: requestId(input.requestId),
        summary: Object.keys(changes).join(', '),
        changes,
      })
      sendJson(res, 200, {
        ok: true,
        changed: true,
        state: after,
        updated: stamp,
        project: { key: project.key, root: project.root, name: savedMemory.memory.name },
        agents: savedMemory.agents,
        audit: { action: 'state.edit', fields: Object.keys(changes) },
      })
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: DECISION_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const text = normaliseText(input.text, 4000)
      if (text === INVALID || text === undefined || text === '') {
        sendJson(res, 400, { ok: false, error: '决策内容不能为空且不超过 4000 字符' })
        return
      }
      ensureDir()
      const stamp = new Date().toISOString()
      const project = activeProject()
      if (!project.ok) {
        sendJson(res, 503, { ok: false, error: project.error || '项目不可用' })
        return
      }
      const memory = { ...project.memory }
      appendDecision(memory, { text, title: normaliseText(input.title, 90) || '' })
      const savedMemory = saveMemory(memory, { updatedAt: stamp })
      appendAudit({
        action: 'decision.append',
        requestId: requestId(input.requestId),
        summary: text.slice(0, 120),
      })
      sendJson(res, 200, {
        ok: true,
        appended: true,
        ts: stamp,
        project: { key: project.key, root: project.root, name: savedMemory.memory.name },
        agents: savedMemory.agents,
      })
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: AUDIT_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      const limit = Number(new URL(req.url || '/', 'http://127.0.0.1').searchParams.get('limit')) || 50
      sendJson(res, 200, { ok: true, entries: auditEntries(limit), fetchedAt: new Date().toISOString() })
    },
  }))

  // Session targeting: the panel can dispatch into an existing session instead
  // of always creating one. Read-only: it never creates, prompts or cancels.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: SESSIONS_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      sendJson(res, 200, await sessionsPayload(ctx))
    },
  }))

  // Reusable modules: the typed building blocks a dispatch is assembled from,
  // so an instruction written once can be assembled again instead of retyped.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: MODULES_API_PATH,
    handler: async (req, res) => {
      if (req.method === 'GET') {
        if (!guard(req, res, 'GET')) return
        sendJson(res, 200, { ok: true, items: readModules(), fetchedAt: new Date().toISOString() })
        return
      }
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const items = readModules()
      const removeId = normaliseText(input.id, 80)
      if (removeId === INVALID) { sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return }
      if (removeId && input.remove === true) {
        const next = items.filter(item => item.id !== removeId)
        if (next.length === items.length) { sendJson(res, 404, { ok: false, error: '模块不存在' }); return }
        writeModules(next)
        appendAudit({ action: 'module.remove', requestId: removeId, summary: removeId })
        sendJson(res, 200, { ok: true, items: next })
        return
      }
      const title = normaliseText(input.title, 120)
      const kind = normaliseText(input.kind, 20)
      const text = normaliseText(input.text, 8000)
      if (title === INVALID || kind === INVALID || text === INVALID) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' })
        return
      }
      if (!title || !text) { sendJson(res, 400, { ok: false, error: 'title 与 text 不能为空' }); return }
      if (!MODULE_KINDS.has(String(kind || ''))) {
        sendJson(res, 400, { ok: false, error: 'kind 必须是 goal / plan / instruction' })
        return
      }
      const now = Date.now()
      const existing = items.find(item => item.kind === kind && item.title === title)
      let saved
      if (existing) {
        existing.text = text
        existing.updatedAt = now
        saved = existing
      } else {
        saved = { id: newModuleId(), kind, title, text, uses: 0, createdAt: now, updatedAt: now }
        items.unshift(saved)
      }
      writeModules(items)
      appendAudit({ action: 'module.save', requestId: saved.id, summary: `${kind} · ${title}` })
      sendJson(res, 200, { ok: true, module: saved, items })
    },
  }))

  // Report digest: one run, distilled into conclusion / artifacts / open
  // questions / stats. The raw reply rides along so the panel can hide it
  // behind a disclosure instead of painting it as the report.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: REPORT_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      const runId = url.searchParams.get('runId') || ''
      const runs = readRuns()
      const run = runId ? runs.find(item => item.runId === runId) : runs[0]
      if (!run) { sendJson(res, 404, { ok: false, error: '没有这次运行的记录' }); return }
      sendJson(res, 200, reportPayload(ctx, run))
    },
  }))

  // Templates: a saved combination of slots (+ module ids + default session
  // target). Saving one is the point where reuse becomes cheaper than retyping.
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: TEMPLATES_API_PATH,
    handler: async (req, res) => {
      if (req.method === 'GET') {
        if (!guard(req, res, 'GET')) return
        const items = readTemplates()
          .slice()
          .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))
          .map(templatePayload)
        sendJson(res, 200, { ok: true, items, fetchedAt: new Date().toISOString() })
        return
      }
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const items = readTemplates()
      const removeId = normaliseText(input.id, 80)
      if (removeId === INVALID) { sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return }
      if (removeId && input.remove === true) {
        const next = items.filter(item => item.id !== removeId)
        if (next.length === items.length) { sendJson(res, 404, { ok: false, error: '模板不存在' }); return }
        writeTemplates(next)
        appendAudit({ action: 'template.remove', requestId: removeId, summary: removeId })
        sendJson(res, 200, { ok: true, items: next.map(templatePayload) })
        return
      }
      const title = normaliseText(input.title, 120)
      const goal = normaliseText(input.goal, 2000)
      const plan = normaliseText(input.plan, 2000)
      const instruction = normaliseText(input.instruction, 2000)
      const model = normaliseText(input.model, 200)
      const sessionMode = normaliseText(input.sessionMode, 20)
      if ([title, goal, plan, instruction, model, sessionMode].includes(INVALID)) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' })
        return
      }
      if (!title) { sendJson(res, 400, { ok: false, error: '模板标题不能为空' }); return }
      if (!goal) { sendJson(res, 400, { ok: false, error: '模板至少要有目标' }); return }
      if (sessionMode !== undefined && sessionMode !== '' && !TEMPLATE_SESSION_MODES.has(String(sessionMode))) {
        sendJson(res, 400, { ok: false, error: 'sessionMode 必须是 new / existing / any' })
        return
      }
      if (input.moduleIds !== undefined && !Array.isArray(input.moduleIds)) {
        sendJson(res, 400, { ok: false, error: 'moduleIds 必须是数组' })
        return
      }
      const moduleIds = Array.isArray(input.moduleIds)
        ? input.moduleIds.filter(id => typeof id === 'string' && id.length <= 80).slice(0, 20)
        : []
      const now = Date.now()
      const existing = removeId && items.find(item => item.id === removeId)
        || items.find(item => item.title === title)
      let saved
      if (existing) {
        Object.assign(existing, {
          title,
          goal,
          plan: plan || '',
          instruction: instruction || '',
          moduleIds,
          model: model || '',
          sessionMode: sessionMode || 'any',
          updatedAt: now,
        })
        saved = existing
      } else {
        saved = {
          id: newTemplateId(), title, goal, plan: plan || '', instruction: instruction || '',
          moduleIds, model: model || '', sessionMode: sessionMode || 'any',
          uses: 0, createdAt: now, updatedAt: now,
        }
        items.unshift(saved)
      }
      writeTemplates(items)
      appendAudit({ action: 'template.save', requestId: saved.id, summary: `${saved.title} · ${moduleIds.length} modules` })
      sendJson(res, 200, { ok: true, template: templatePayload(saved), items: items.map(templatePayload) })
    },
  }))

  // Dispatch composes a prompt for a real DSH Session through the official
  // Host sessionController. It never calls a provider directly and only runs
  // when the workspace config opts in (`execution.enabled`).
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: DISPATCH_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const input = body.json
      const goal = normaliseText(input.goal, 2000)
      const plan = normaliseText(input.plan, 4000)
      const instruction = normaliseText(input.instruction, 4000)
      const model = normaliseText(input.model, 200)
      // Optional session target: an existing session id reuses that conversation
      // (its history and approvals stay put) instead of creating a new one.
      const targetSessionId = normaliseText(input.sessionId, 200)
      const moduleIds = Array.isArray(input.moduleIds) ? input.moduleIds.filter(id => typeof id === 'string').slice(0, 20) : []
      // Optional template: a saved recipe. It supplies the module list when the
      // caller did not, and its use counter tells us which recipes actually get
      // reused (the raw data for the canvas phase).
      const templateId = normaliseText(input.templateId, 80)
      if (goal === INVALID || plan === INVALID || instruction === INVALID || model === INVALID || targetSessionId === INVALID || templateId === INVALID) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' })
        return
      }
      if (!goal) { sendJson(res, 400, { ok: false, error: 'goal 不能为空' }); return }
      const template = templateId ? readTemplates().find(item => item.id === templateId) : null
      const templateMissing = Boolean(templateId) && !template
      const effectiveModuleIds = moduleIds.length
        ? moduleIds
        : (template && Array.isArray(template.moduleIds) ? template.moduleIds.slice(0, 20) : [])
      const exec = executionConfig()
      const controller = serviceGet(ctx, 'sessionController')
      const sessionMode = targetSessionId ? 'existing' : 'new'
      const capable = Boolean(controller && typeof controller.prompt === 'function' && (targetSessionId || typeof controller.create === 'function'))
      const promptText = composeDispatchPrompt({ goal, plan: plan || '', instruction: instruction || '' })
      if (input.dryRun === true) {
        sendJson(res, 200, {
          ok: true,
          dryRun: true,
          available: capable,
          executionEnabled: exec.enabled,
          prompt: promptText,
          cwd: exec.cwd,
          model: model || '',
          sessionMode,
          sessionId: targetSessionId || '',
          templateId: templateId || '',
          templateTitle: template?.title || '',
          templateMissing,
          templateModuleIds: effectiveModuleIds,
          memoryKey: activeProject().key || '',
        })
        return
      }
      if (!capable) {
        sendJson(res, 501, { ok: false, code: 'unsupported', error: '当前 profile 未提供 sessionController，无法派发' })
        return
      }
      if (!exec.enabled) {
        sendJson(res, 409, { ok: false, code: 'execution-disabled', error: '执行未启用：在工作区 workbench.config.json 中设置 execution.enabled=true' })
        return
      }
      const runId = newRunId()
      let sessionId = targetSessionId || ''
      if (!sessionId) {
        try {
          const created = await controller.create({ cwd: exec.cwd })
          sessionId = String(created?.sessionId ?? created?.value?.sessionId ?? '')
          if (!sessionId) throw new Error('sessionController.create 未返回 sessionId')
        } catch (error) {
          appendAudit({ action: 'dispatch.failed', requestId: runId, summary: 'create: ' + String(error?.message || error).slice(0, 160) })
          sendJson(res, 502, { ok: false, code: 'create-failed', error: String(error?.message || error) })
          return
        }
      }
      let modelWarning = ''
      if (model && typeof controller.selectModel === 'function') {
        const slash = model.indexOf('/')
        if (slash > 0) {
          try {
            await controller.selectModel({ sessionId, provider: model.slice(0, slash), model: model.slice(slash + 1) })
          } catch (error) {
            modelWarning = '模型选择失败，已使用默认模型：' + String(error?.message || error)
          }
        } else {
          modelWarning = '模型格式应为 provider/model，已使用默认模型'
        }
      }
      // Host `sessionController.prompt(request, signal)` requires a caller
      // lifetime AbortSignal: its guard calls `signal.throwIfAborted()`
      // unconditionally, so an omitted signal throws
      // `Cannot read properties of undefined (reading 'throwIfAborted')`.
      // Cancellation itself still goes through `controller.cancel`; this
      // signal only bounds prompt admission.
      const admission = new AbortController()
      try {
        const ack = await controller.prompt({
          sessionId,
          requestId: runId,
          mode: 'queue',
          content: [{ type: 'text', text: promptText }],
        }, admission.signal)
        const accepted = ack?.accepted === true || ack?.value?.accepted === true
        if (!accepted) throw new Error('sessionController.prompt 未被接受')
      } catch (error) {
        appendAudit({ action: 'dispatch.failed', requestId: runId, summary: 'prompt: ' + String(error?.message || error).slice(0, 160) })
        sendJson(res, 502, { ok: false, code: 'prompt-failed', error: String(error?.message || error), sessionId })
        return
      }
      const now = Date.now()
      const run = {
        runId,
        sessionId,
        sessionMode,
        goal: goal.slice(0, 200),
        plan: (plan || '').slice(0, 2000),
        instruction: (instruction || '').slice(0, 2000),
        model: model || '',
        status: 'running',
        createdAt: now,
        updatedAt: now,
        cwd: exec.cwd,
        ...(template ? { templateId: template.id, templateTitle: template.title } : {}),
        ...(modelWarning ? { warning: modelWarning } : {}),
      }
      const runs = readRuns()
      runs.unshift(run)
      writeRuns(runs)
      if (template) noteTemplateUse(template.id)
      if (effectiveModuleIds.length) {
        const modules = readModules()
        let touched = false
        for (const module of modules) {
          if (!effectiveModuleIds.includes(module.id)) continue
          module.uses = (Number(module.uses) || 0) + 1
          module.lastUsedAt = now
          touched = true
        }
        if (touched) writeModules(modules)
      }
      appendAudit({ action: 'dispatch.start', requestId: runId, summary: `session ${sessionId} (${sessionMode}) · ${model || '默认模型'}${template ? ' · 模板 ' + template.title : ''} · ${goal.slice(0, 80)}` })
      sendJson(res, 200, {
        ok: true,
        dryRun: false,
        run,
        ...(templateMissing ? { templateMissing: true, warning: '模板已不存在，按当前内容派发' } : {}),
        ...(modelWarning ? { warning: modelWarning } : {}),
      })
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: RUNS_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      const items = await refreshRuns(ctx, readRuns())
      sendJson(res, 200, { ok: true, items: items.slice(0, 20), fetchedAt: new Date().toISOString() })
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: RUNS_CANCEL_API_PATH,
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const body = await readJsonBody(req)
      if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return }
      if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return }
      const runId = normaliseText(body.json.runId, 120)
      if (!runId) { sendJson(res, 400, { ok: false, error: 'runId 不能为空' }); return }
      const runs = readRuns()
      const run = runs.find(item => item && item.runId === runId)
      if (!run) { sendJson(res, 404, { ok: false, error: '运行记录不存在' }); return }
      // Archiving is the honest repair for a run whose session is gone (e.g.
      // after a Harness restart): local bookkeeping only, no fake cancellation.
      if (body.json.archive === true) {
        run.status = 'cancelled'
        run.waiting = false
        run.orphaned = false
        run.updatedAt = Date.now()
        run.archivedAt = run.updatedAt
        writeRuns(runs)
        appendAudit({ action: 'dispatch.archive', requestId: runId, summary: `session ${run.sessionId} · 会话不在当前 Harness 中，本地归档` })
        sendJson(res, 200, { ok: true, run })
        return
      }
      const controller = serviceGet(ctx, 'sessionController')
      if (!controller || typeof controller.cancel !== 'function') {
        sendJson(res, 501, { ok: false, code: 'unsupported', error: '当前 profile 未提供 sessionController.cancel' })
        return
      }
      try {
        await controller.cancel({ sessionId: run.sessionId })
      } catch (error) {
        sendJson(res, 409, { ok: false, code: 'cancel-failed', error: String(error?.message || error) })
        return
      }
      run.status = 'cancelled'
      // A cancelled run is no longer parked on a question; without this the
      // panel would show "cancelled" and "waiting for your answer" together.
      run.waiting = false
      run.updatedAt = Date.now()
      writeRuns(runs)
      appendAudit({ action: 'dispatch.cancel', requestId: runId, summary: `session ${run.sessionId}` })
      sendJson(res, 200, { ok: true, run })
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'wb_models',
    description: '列出当前 profile 可用的模型路由（只读，不调用模型）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    output: textOutput,
    async execute() {
      const catalog = await modelCatalogPayload(ctx)
      if (!catalog.available) return { text: `模型目录不可用：${catalog.reason}` }
      const lines = catalog.groups.map(group => {
        const models = group.models.map(model => `${group.id}/${model.id}`).join(', ') || '(无模型)'
        return `${group.name || group.id}: ${models}`
      })
      return { text: lines.length ? lines.join('\n') : '当前没有可用模型路由。' }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'wb_runs',
    description: '列出由工作台派发的运行及其状态（只读）。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
    output: textOutput,
    async execute() {
      const items = await refreshRuns(ctx, readRuns())
      if (!items.length) return { text: '还没有工作台派发的运行。' }
      const lines = items.slice(0, 10).map(run => {
        const goal = String(run.goal || '').replace(/\s+/g, ' ').slice(0, 40)
        return `${run.runId} · ${run.status} · ${run.sessionId} · ${run.model || '默认模型'} · ${goal}`
      })
      return { text: lines.join('\n') }
    },
  }))

disposers.push(ctx.tools.register({
    name: 'wb_get',
    description: '读取工作台记忆：某项目的主线/停在哪/下一步/红线（默认当前激活项目），或判例全文、项目列表。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        section: { type: 'string', enum: ['state', 'decisions', 'projects'], description: '不填返回 state 摘要；decisions 返回判例全文；projects 返回项目列表。' },
        project: { type: 'string', description: '可选：项目名、项目 key 或根目录；默认当前激活项目。' },
      },
    },
    output: textOutput,
    async execute(args) {
      const a = args || {}
      const project = resolveProjectArg(a.project)
      if (!project || project.ok !== true) return { text: '读取失败：' + (project?.error || '项目不可用') }
      const section = a.section || 'state'
      if (section === 'projects') {
        const projects = readProjects()
        if (!projects.items.length) return { text: '还没有登记任何项目。' }
        const lines = projects.items.map(item => {
          const mark = item.key === projects.active ? '*' : ' '
          return `${mark} ${item.name} · ${item.root} · ${String(item.updatedAt || '').slice(0, 16)}`
        })
        return { text: lines.join('\n') + '\n* = 当前激活项目' }
      }
      if (section === 'decisions') {
        const text = readSafe(memoryDecisionsPath(project.key))
        return { text: text.trim() || '(这个项目还没有判例)' }
      }
      return { text: memoryText(project.memory, { project, gap: memoryGap(project.memory) }) }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'wb_set',
    description: '写回某个项目的主线/停在哪/下一步/红线。只改传进来的字段；记忆只有一份真源，写完同步该项目根目录的 AGENTS.md。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mainline: { type: 'string', description: '一句话主线。' },
        stopped_at: { type: 'string', description: '当前停在哪（最多一行）。' },
        next: { type: 'string', description: '下一步，用分号分隔，最多三条。' },
        red_lines: { type: 'string', description: '红线，用分号分隔。' },
        project: { type: 'string', description: '可选：项目名、key 或根目录；默认当前激活项目。' },
      },
    },
    output: textOutput,
    async execute(args) {
      const a = args || {}
      const resolved = resolveProjectArg(a.project)
      if (!resolved || resolved.ok !== true) return { text: '写入失败：' + (resolved?.error || '项目不可用') }
      const memory = { ...resolved.memory }
      const stamp = new Date().toISOString()
      const mainline = normaliseText(a.mainline, 500)
      const stopped = normaliseText(a.stopped_at, 500)
      const next = normaliseList(typeof a.next === 'string' ? a.next.split(';').join('\n') : a.next, 10, 500)
      const redLines = normaliseList(typeof a.red_lines === 'string' ? a.red_lines.split(';').join('\n') : a.red_lines, 20, 300)
      if (mainline === INVALID || stopped === INVALID || next === INVALID || redLines === INVALID) {
        return { text: '写入失败：字段类型或长度不合法。' }
      }
      const changed = []
      if (mainline !== undefined) { memory.mainline = mainline; changed.push('mainline') }
      if (stopped !== undefined) { memory.stopped_at = stopped; changed.push('stopped_at') }
      if (next !== undefined) { memory.next = next.slice(0, 3); changed.push('next') }
      if (redLines !== undefined) { memory.red_lines = redLines; changed.push('red_lines') }
      if (!changed.length) return { text: '没有可写的字段（mainline/stopped_at/next/red_lines 至少给一个）。' }
      memory.openedAt = stamp
      const saved = saveMemory(memory, { updatedAt: stamp })
      appendAudit({ action: 'memory.set', requestId: resolved.key, summary: changed.join(', ') })
      const agents = saved.agents
      const note = agents.ok
        ? `AGENTS.md 已同步（生成块 ${agents.bytes} 字节）`
        : `AGENTS.md 未写入：${agents.error}（记忆 JSON 已写入）`
      return {
        text: [
          `已写回 ${saved.memory.name} · ${saved.memory.root}`,
          `字段：${changed.join(', ')}`,
          note,
          '若本次工作在另一个目录，用 project 参数指定，别把记忆写到错的项目。',
        ].join('\n'),
      }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'wb_close',
    description: '收工：写入下次第一步、结论颜色与判断，判断追加进判例，并重新生成 AGENTS.md。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['next'],
      properties: {
        next: { type: 'string', description: '下次开工的第一步（必填）。' },
        decision: { type: 'string', description: '可选：背景/决定/代价，追加进判例。' },
        title: { type: 'string', description: '可选：这条判例的标题（默认取 decision 第一行）。' },
        outcome: { type: 'string', enum: ['green', 'yellow', 'red'], description: '可选：本轮结论颜色。green 必须脚本通过且产物存在；没验证就留空。' },
        runId: { type: 'string', description: '可选：本轮对应的派发 runId。' },
        sessionId: { type: 'string', description: '可选：本轮所在会话。' },
        project: { type: 'string', description: '可选：项目名、key 或根目录；默认当前激活项目。' },
      },
    },
    output: textOutput,
    async execute(args) {
      const a = args || {}
      const resolved = resolveProjectArg(a.project)
      if (!resolved || resolved.ok !== true) return { text: '收工失败：' + (resolved?.error || '项目不可用') }
      const stamp = new Date().toISOString()
      const memory = { ...resolved.memory }
      const next = normaliseList(typeof a.next === 'string' ? a.next.split(';').join('\n') : a.next, 3, 500)
      if (next === INVALID || !next || !next.length) return { text: '收工失败：next 不能为空。' }
      const outcome = normaliseText(a.outcome, 20)
      const runId = normaliseText(a.runId, 80)
      const sessionId = normaliseText(a.sessionId, 120)
      const decision = normaliseText(a.decision, 4000)
      const title = normaliseText(a.title, 90)
      if (outcome === INVALID || runId === INVALID || sessionId === INVALID || decision === INVALID || title === INVALID) {
        return { text: '收工失败：字段类型或长度不合法。' }
      }
      memory.next = next.slice(0, 3)
      memory.closedAt = stamp
      if (outcome) memory.outcome = outcome
      memory.basis = {
        runId: runId || memory.basis.runId,
        sessionId: sessionId || memory.basis.sessionId,
      }
      if (decision) appendDecision(memory, { text: decision, title: title || '' })
      const saved = saveMemory(memory, { updatedAt: stamp })
      appendAudit({ action: 'memory.close', requestId: saved.memory.key, summary: (outcome || 'no-outcome') + ' ' + next[0].slice(0, 80) })
      const gap = memoryGap(saved.memory)
      const official = outcome || '未记录（green 需要脚本通过且产物存在）'
      return {
        text: [
          `已收工：${saved.memory.name}`,
          `下一步：${next.join('；')}`,
          `结论：${official}${runId ? ' · ' + runId : ''}`,
          decision ? '判例：已追加一条。' : '判例：未追加。',
          saved.agents.ok ? `AGENTS.md：已同步（生成块 ${saved.agents.bytes} 字节）。` : `AGENTS.md：未写入（${saved.agents.error}）。`,
          gap.open ? '缺口仍在：收工标记没有覆盖最后一次写入，请检查。' : '',
        ].filter(Boolean).join('\n'),
      }
    },
  }))

  return () => { for (const dispose of disposers.reverse()) dispose?.() }
}
