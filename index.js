// dsh-workbench v0.2.0 —— 工作区指挥台 + 只读预览数据端点
//
// v0.2 的 UI 读取真实工作台文件并生成本地任务草稿；不写母站，不启动模型，不改变会话。
// 三个 Host 工具仍保留：wb_get / wb_set / wb_close。

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
import { dirname, join, relative, resolve, isAbsolute, sep } from 'node:path'
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
const STATE_MD = join(WB_DIR, 'state.md')
const DECISIONS = join(WB_DIR, 'decisions.md')
const LEDGER = join(WB_DIR, 'ledger.json')
const API_PATH = '/dsh-workbench/api/state-v2'
// Preview is intentionally a read-only endpoint. There is no POST/model route.
const PREVIEW_API_PATH = '/dsh-workbench/api/preview'
const PREVIEW_API_VERSION_PATH = '/dsh-workbench/api/preview-v1'
const MAX_SOURCE_BYTES = 256 * 1024
const MAX_SOURCE_CHARS = 12000
const MAX_SOURCES_PER_ROLE = 32
const DEFAULT_MEMORY_BUDGET_TOKENS = 12000

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

function normalizeSourceList(value) {
  if (!value) return []
  if (typeof value === 'string') return value.split(/[\r\n,;]+/).map(item => item.trim()).filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(normalizeSourceList)
  if (typeof value === 'object') {
    return Object.values(value).flatMap(normalizeSourceList)
  }
  return []
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

function relativeWithinRoot(path, root) {
  const value = relative(canonicalPath(root), canonicalPath(path))
  const parentPrefix = '..' + sep
  return value === '' || (value !== '..' && !value.toLowerCase().startsWith(parentPrefix.toLowerCase()) && !isAbsolute(value))
}

function insideRoot(candidate, root) {
  // Lexical check also rejects nonexistent traversal paths; canonical check
  // additionally catches existing symlinks that target outside the workspace.
  const lexical = relative(resolve(root), resolve(candidate))
  if (lexical !== '' && (lexical === '..' || lexical.startsWith('..' + sep) || isAbsolute(lexical))) return false
  return relativeWithinRoot(candidate, root)
}

function sourcePath(value, root) {
  const candidate = String(value || '').trim()
  if (!candidate || candidate.startsWith('~') || candidate.includes('\0')) return ''
  const path = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate)
  if (!insideRoot(path, root)) return ''
  // Resolve an existing symlink before reading so a source cannot escape the
  // workspace root through a link. Missing sources retain their lexical path.
  return existsSync(path) ? canonicalPath(path) : path
}

function relativeSourcePath(path) {
  if (!path || !relativeWithinRoot(path, WB_DIR)) return ''
  return relative(canonicalPath(WB_DIR), canonicalPath(path)).split(sep).join('/')
}

function displayConfiguredSource(value, path) {
  const text = String(value || '')
  if (!isAbsolute(text)) return text
  return relativeSourcePath(path) || '[outside-workspace]'
}

function parseMemorySources(config) {
  const memory = config?.memory && typeof config.memory === 'object' ? config.memory : {}
  const sourceConfig = firstValue(config?.memorySources, config?.memory_sources, memory.sources, memory.files)
  const primaryValue = firstValue(memory.primary, memory.main, memory.primarySource, config?.primaryMemory, config?.primary_memory)
  const secondaryValue = firstValue(memory.secondary, memory.auxiliary, memory.secondarySources, config?.secondaryMemory, config?.secondary_memory)
  const primary = normalizeSourceList(primaryValue || sourceConfig?.primary || sourceConfig?.main)
  const secondary = normalizeSourceList(secondaryValue || sourceConfig?.secondary || sourceConfig?.auxiliary)
  const fallback = normalizeSourceList(sourceConfig)
  return {
    primary: [...new Set(primary.length ? primary : fallback.slice(0, 1))].slice(0, MAX_SOURCES_PER_ROLE),
    secondary: [...new Set(secondary.length ? secondary : fallback.slice(primary.length ? 1 : 0))].slice(0, MAX_SOURCES_PER_ROLE),
  }
}

function sourceEntries() {
  const loaded = readWorkspaceConfig()
  const sources = parseMemorySources(loaded.value)
  // Sensible defaults keep a plain workbench useful while allowing config/env
  // overrides. Every default remains inside WB_DIR and is read-only here.
  const defaults = {
    primary: ['state.md', 'state.json'],
    secondary: ['decisions.md', 'memory.md', 'context.md'],
  }
  const envPrimary = normalizeSourceList(process.env.DSH_MEMORY_PRIMARY)
  const envSecondary = normalizeSourceList(process.env.DSH_MEMORY_SECONDARY)
  const names = {
    primary: envPrimary.length ? envPrimary : (sources.primary.length ? sources.primary : defaults.primary),
    secondary: envSecondary.length ? envSecondary : (sources.secondary.length ? sources.secondary : defaults.secondary),
  }
  const output = []
  for (const role of ['primary', 'secondary']) {
    for (const value of names[role].slice(0, MAX_SOURCES_PER_ROLE)) {
      const path = sourcePath(value, WB_DIR)
      const configured = path ? displayConfiguredSource(value, path) : '[outside-workspace]'
      if (!path) {
        output.push({ role, configured, exists: false, readable: false, bytes: 0, chars: 0, fingerprint: '', truncated: false, error: 'outside-workspace' })
        continue
      }
      const read = safeReadBounded(path)
      output.push({ role, configured, exists: existsSync(path), readable: !read.error, bytes: read.bytes, chars: read.text.length, fingerprint: read.text ? createHash('sha256').update(read.text).digest('hex').slice(0, 16) : '', truncated: read.truncated, error: read.error, text: boundedTail(read.text, MAX_SOURCE_CHARS) })
    }
  }
  return { config: loaded, entries: output }
}

function memoryPreviewPayload() {
  const loaded = sourceEntries()
  const budget = asPositiveInt(firstValue(process.env.DSH_MEMORY_BUDGET_TOKENS, loaded.config.value?.memory?.budgetTokens, loaded.config.value?.memory?.budget_tokens), DEFAULT_MEMORY_BUDGET_TOKENS, 1000000)
  const entries = loaded.entries
  const primary = entries.filter(entry => entry.role === 'primary')
  const secondary = entries.filter(entry => entry.role === 'secondary')
  const readable = entries.filter(entry => entry.readable && entry.text)
  const chars = readable.reduce((sum, entry) => sum + entry.chars, 0)
  const bytes = readable.reduce((sum, entry) => sum + entry.bytes, 0)
  const estimatedTokens = Math.ceil(chars / 4)
  const fingerprint = createHash('sha256').update(entries.map(entry => `${entry.role}:${entry.configured}:${entry.fingerprint}`).join('|')).digest('hex').slice(0, 16)
  let remainingPreviewChars = Math.min(MAX_SOURCE_CHARS * 2, budget * 4)
  const snippets = []
  for (const entry of readable) {
    if (remainingPreviewChars <= 0) break
    const text = entry.text.slice(0, remainingPreviewChars)
    remainingPreviewChars -= text.length
    snippets.push({ role: entry.role, source: entry.configured, fingerprint: entry.fingerprint, text })
  }
  const publicEntry = ({ path, text, configured, ...entry }) => ({ ...entry, source: configured })
  return {
    ok: true,
    mode: 'preview',
    execution: { enabled: false, status: 'disabled', reason: 'model execution is not implemented in phase 1' },
    config: { loaded: Boolean(loaded.config.path), error: loaded.config.error, budgetTokens: budget },
    memory: {
      primary: primary.map(publicEntry),
      secondary: secondary.map(publicEntry),
      fingerprint,
      budgetTokens: budget,
      estimatedTokens,
      remainingTokens: Math.max(0, budget - estimatedTokens),
      sourceCount: entries.length,
      readableCount: readable.length,
      bytes,
      chars,
      snippets,
    },
    fetchedAt: new Date().toISOString(),
  }
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

function enforceLines(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n')
  if (lines.length > 10) {
    return { ok: false, lines: lines.slice(0, 10), note: `原内容 ${lines.length} 行，已截断到 10 行。状态文件不是日记。` }
  }
  return { ok: true, lines, note: '' }
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

function statePayload() {
  const state = readJsonSafe(STATE_JSON, {}) || {}
  const stateText = readSafe(STATE_MD).slice(-8000)
  const decisionsText = readSafe(DECISIONS)
  const savedLedger = readJsonSafe(LEDGER, null)
  const relayLedger = readRelayLedger()
  const savedTasks = Array.isArray(state.tasks) ? state.tasks : []
  const tasks = savedTasks.length ? savedTasks : readTaskCards()
  const ledger = { ...relayLedger, ...(savedLedger && typeof savedLedger === 'object' ? savedLedger : {}) }
  if (ledger.greenCards === undefined && ledger.green_cards === undefined) {
    ledger.greenCards = tasks.filter(task => /绿|green|passed/i.test(String(task?.status || ''))).length
  }
  return {
    ok: true,
    state,
    stateText,
    decisions: decisionsText.slice(-8000),
    ledger,
    tasks,
    memoryPreview: memoryPreviewPayload(),
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
      sendJson(res, 200, statePayload())
    },
  }))

  // Phase 1 preview is deliberately GET-only and never invokes a model or
  // writes workspace state. Keep the versioned alias for clients that pin API
  // contracts while the short path remains convenient for the panel.
  for (const path of [PREVIEW_API_PATH, PREVIEW_API_VERSION_PATH]) {
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path,
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
        sendJson(res, 200, memoryPreviewPayload())
      },
    }))
  }

  disposers.push(ctx.tools.register({
    name: 'wb_get',
    description: '读取工作台状态摘要（主线、停在哪、下一步、红线）。细节按需读取。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        section: { type: 'string', enum: ['state', 'decisions'], description: '可选：state 或 decisions。不填返回 state 摘要。' },
      },
    },
    output: textOutput,
    async execute(args) {
      ensureDir()
      const section = (args && args.section) || 'state'
      const text = section === 'decisions'
        ? (readSafe(DECISIONS) || '(decisions.md 为空)')
        : (readSafe(STATE_MD) || '(state.md 为空，先用 wb_set 写主线)')
      return { text }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'wb_set',
    description: '写回工作台状态。强制最多 10 行，超出会截断并提示。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mainline: { type: 'string', description: '一句话主线。' },
        stopped_at: { type: 'string', description: '当前停在哪（最多一行）。' },
        next: { type: 'string', description: '下一步，使用分号分隔，最多三条。' },
        red_lines: { type: 'string', description: '红线，使用分号分隔。' },
      },
    },
    output: textOutput,
    async execute(args) {
      ensureDir()
      const a = args || {}
      const stamp = new Date().toISOString()
      const checked = enforceLines([
        `mainline: ${a.mainline || '(未填)'}`,
        `stopped_at: ${a.stopped_at || '(未填)'}`,
        `next: ${a.next || '(未填)'}`,
        `red_lines: ${a.red_lines || '(未填)'}`,
        `updated: ${stamp}`,
      ].join('\n'))
      writeFileSync(STATE_MD, checked.lines.join('\n'), 'utf-8')
      writeFileSync(STATE_JSON, JSON.stringify({
        mainline: a.mainline || '',
        stopped_at: a.stopped_at || '',
        next: (a.next || '').split(';').map(s => s.trim()).filter(Boolean),
        red_lines: (a.red_lines || '').split(';').map(s => s.trim()).filter(Boolean),
        updated: stamp,
      }, null, 2), 'utf-8')
      return { text: checked.ok ? 'state 已写回。' : `state 已写回（截断）。${checked.note}` }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'wb_close',
    description: '收尾：写入下一步和时间戳，并将判断追加到 decisions.md。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['next'],
      properties: {
        next: { type: 'string', description: '下次开工的第一步（必填）。' },
        decision: { type: 'string', description: '可选：背景/决定/代价，追加到 decisions.md。' },
      },
    },
    output: textOutput,
    async execute(args) {
      ensureDir()
      const a = args || {}
      const stamp = new Date().toISOString()
      const json = readJsonSafe(STATE_JSON, {}) || {}
      json.next = (a.next || '').split(';').map(s => s.trim()).filter(Boolean)
      json.updated = stamp
      writeFileSync(STATE_JSON, JSON.stringify(json, null, 2), 'utf-8')
      appendBounded(STATE_MD, `\n## 收尾 ${stamp}\nnext: ${a.next || ''}\n`)
      if (a.decision) appendBounded(DECISIONS, `\n### ${stamp}\n${a.decision}\n`)
      return { text: `已收尾；decisions ${a.decision ? '已追加一条。' : '未追加。'}` }
    },
  }))

  return () => { for (const dispose of disposers.reverse()) dispose?.() }
}
