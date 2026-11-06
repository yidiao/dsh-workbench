// dsh-workbench v0.4.1 —— 工作区指挥台：可编辑接续状态 + 审计 + 派发到真实 DSH 会话
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
const STATE_MD = join(WB_DIR, 'state.md')
const DECISIONS = join(WB_DIR, 'decisions.md')
const LEDGER = join(WB_DIR, 'ledger.json')
const AUDIT = join(WB_DIR, 'audit.jsonl')
const MAX_AUDIT_CHARS = 256 * 1024
const MAX_AUDIT_ENTRIES = 400
const API_PATH = '/dsh-workbench/api/state-v2'
// Preview is intentionally a read-only endpoint. There is no POST/model route.
const PREVIEW_API_PATH = '/dsh-workbench/api/preview'
const PREVIEW_API_VERSION_PATH = '/dsh-workbench/api/preview-v1'
const MODELS_API_PATH = '/dsh-workbench/api/models'
const STATE_EDIT_API_PATH = '/dsh-workbench/api/state-edit'
const DECISION_API_PATH = '/dsh-workbench/api/decision-add'
const AUDIT_API_PATH = '/dsh-workbench/api/audit'
const DISPATCH_API_PATH = '/dsh-workbench/api/dispatch'
const RUNS_API_PATH = '/dsh-workbench/api/runs'
const RUNS_CANCEL_API_PATH = '/dsh-workbench/api/runs/cancel'
const RUNS = join(WB_DIR, 'runs.json')
const MAX_RUNS = 50
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
  run.updatedAt = Date.now()
  // Close the audit chain: dispatch.start must be answerable with a terminal
  // entry, otherwise a finished run is indistinguishable from a lost one.
  appendAudit({
    action: run.status === 'error' ? 'dispatch.error' : run.status === 'cancelled' ? 'dispatch.cancel' : 'dispatch.done',
    requestId: run.runId,
    summary: `session ${run.sessionId} · ${run.status} · reply ${run.reply.length} chars`,
  })
}

async function refreshRuns(ctx, items) {
  const controller = serviceGet(ctx, 'sessionController')
  if (!controller || typeof controller.list !== 'function') return items
  let listed
  try {
    listed = await controller.list()
  } catch {
    return items
  }
  if (listed && !Array.isArray(listed)) listed = listed.value?.items ?? listed.items
  if (!Array.isArray(listed)) listed = []
  const byId = new Map(listed.filter(item => item && typeof item.sessionId === 'string').map(item => [item.sessionId, item]))
  let changed = false
  for (const run of items) {
    if (!run || typeof run !== 'object' || typeof run.sessionId !== 'string') continue
    const item = byId.get(run.sessionId)
    if (!item) continue
    if (item.running) {
      if (run.status !== 'running') { run.status = 'running'; changed = true }
    } else if (run.status === 'running') {
      finaliseRun(ctx, run)
      changed = true
    }
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
  const saved = readJsonSafe(STATE_JSON, {}) || {}
  return {
    mainline: typeof saved.mainline === 'string' ? saved.mainline : '',
    stopped_at: typeof saved.stopped_at === 'string' ? saved.stopped_at : '',
    next: Array.isArray(saved.next) ? saved.next.map(String) : [],
    red_lines: Array.isArray(saved.red_lines) ? saved.red_lines.map(String) : [],
  }
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

function statePayload(ctx) {
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
  const execution = executionConfig()
  const controller = serviceGet(ctx, 'sessionController')
  return {
    ok: true,
    state,
    stateText,
    decisions: decisionsText.slice(-8000),
    ledger,
    tasks,
    memoryPreview: memoryPreviewPayload(),
    execution: {
      enabled: execution.enabled,
      cwd: execution.cwd,
      controller: Boolean(controller && typeof controller.create === 'function' && typeof controller.prompt === 'function'),
    },
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
      const saved = { ...(readJsonSafe(STATE_JSON, {}) || {}), ...after, updated: stamp }
      writeFileSync(STATE_JSON, JSON.stringify(saved, null, 2), 'utf-8')
      appendAudit({
        action: 'state.edit',
        requestId: requestId(input.requestId),
        summary: Object.keys(changes).join(', '),
        changes,
      })
      sendJson(res, 200, { ok: true, changed: true, state: after, updated: stamp, audit: { action: 'state.edit', fields: Object.keys(changes) } })
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
      appendBounded(DECISIONS, `\n### ${stamp}\n${text}\n`, 60000)
      appendAudit({
        action: 'decision.append',
        requestId: requestId(input.requestId),
        summary: text.slice(0, 120),
      })
      sendJson(res, 200, { ok: true, appended: true, ts: stamp })
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
      if (goal === INVALID || plan === INVALID || instruction === INVALID || model === INVALID) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' })
        return
      }
      if (!goal) { sendJson(res, 400, { ok: false, error: 'goal 不能为空' }); return }
      const exec = executionConfig()
      const controller = serviceGet(ctx, 'sessionController')
      const capable = Boolean(controller && typeof controller.create === 'function' && typeof controller.prompt === 'function')
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
          memoryFingerprint: memoryPreviewPayload().memory.fingerprint,
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
      let sessionId = ''
      try {
        const created = await controller.create({ cwd: exec.cwd })
        sessionId = String(created?.sessionId ?? created?.value?.sessionId ?? '')
        if (!sessionId) throw new Error('sessionController.create 未返回 sessionId')
      } catch (error) {
        appendAudit({ action: 'dispatch.failed', requestId: runId, summary: 'create: ' + String(error?.message || error).slice(0, 160) })
        sendJson(res, 502, { ok: false, code: 'create-failed', error: String(error?.message || error) })
        return
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
        goal: goal.slice(0, 200),
        model: model || '',
        status: 'running',
        createdAt: now,
        updatedAt: now,
        cwd: exec.cwd,
        ...(modelWarning ? { warning: modelWarning } : {}),
      }
      const runs = readRuns()
      runs.unshift(run)
      writeRuns(runs)
      appendAudit({ action: 'dispatch.start', requestId: runId, summary: `session ${sessionId} · ${model || '默认模型'} · ${goal.slice(0, 80)}` })
      sendJson(res, 200, { ok: true, dryRun: false, run, ...(modelWarning ? { warning: modelWarning } : {}) })
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
