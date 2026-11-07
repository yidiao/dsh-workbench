// dsh-workbench v2.0.0 —— 工作台：DSH 上的项目层
//
// 一句话：用画布把「方法」连成循环，一档判断、二档嚼需求、三档干活；用户只看汇报。
// 术语只有 7 个：项目 / 方法 / 画布 / 循环 / 记忆 / 角色 / 汇报。
//
// v2 相对 v0.16 的三个结构变化（大纲 §7）：
//   A 存储：一个项目一个目录（projects/<key>/），旧 12 个文件一次性迁进
//           _archive/v0.15/（只读）。记忆只有一份真源 JSON，写完重生成
//           项目根 AGENTS.md 的受管区块。
//   B 引擎：方法库（methods.json）是唯一复用单位；节点 = 方法实例。只有
//           执行型方法带 executor 和校验器，只有它参与
//           「绿 = 校验器过 且 产物在盘」。最小循环（输入→执行与日志→任务输出）
//           是每个新项目的默认图，画布执行与循环记录走同一条 runLoop。
//   C 路由：29 → 8。GET snapshot 一请求画整页；project / memory / method /
//           canvas / run / outcome / models。agent 工具只留 wb_get / wb_set /
//           wb_close。
//
// 不变量（机器守）：判断不下放；没有 executor 的节点必须灰；绿不作假；
// 记忆只有一份真源；会话 id 不进方法/画布/记忆；界面文字一行；
// 旧路由/旧文件删除前必须有迁移脚本 + 回归通过。

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
  renameSync,
  rmSync,
  realpathSync,
} from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { dirname, join, relative, resolve, isAbsolute, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url))

function findAncestor(start, predicate) {
  let current = start
  while (true) {
    if (predicate(current)) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

function canonicalPath(path) {
  try { return realpathSync(path) } catch { return resolve(path) }
}

// The workbench directory carries projects.json (v2). A pre-migration tree
// still carries state.json; probing either keeps one upgrade path with no
// hardcoded machine path.
const DEFAULT_WB_DIR = findAncestor(PACKAGE_DIR, dir =>
  existsSync(join(dir, 'projects.json')) || existsSync(join(dir, 'state.json')))
  || join(homedir(), 'dsh-workbench')
const WB_DIR = process.env.DSH_WORKBENCH_DIR || DEFAULT_WB_DIR

const ARCHIVE_DIR = join(WB_DIR, '_archive', 'v0.15')
const PROJECTS_JSON = join(WB_DIR, 'projects.json')
const PROJECTS_DIR = join(WB_DIR, 'projects')
const GLOBALS_JSON = join(WB_DIR, 'globals.json')
const CONFIG_JSON = join(WB_DIR, 'config.json')

const REGISTRY_VERSION = 2
const MAX_PROJECTS = 50
const MAX_METHODS = 100
const MAX_NODES = 60
const MAX_EDGES = 120
const MAX_RUNS = 50
const MAX_PHRASES = 20
const MAX_AUDIT_CHARS = 256 * 1024
const MAX_AUDIT_ENTRIES = 400
const MAX_AGENTS_BLOCK_BYTES = 2600
const MAX_SOURCE_BYTES = 256 * 1024
const AGENTS_START = '<!-- dsh-workbench:generated:start -->'
const AGENTS_END = '<!-- dsh-workbench:generated:end -->'
const AGENTS_MANUAL_HEADER = [
  '# AGENTS.md',
  '',
  '> 手工区：这一块由你维护，工作台只改写下面 `dsh-workbench:generated` 之间的内容。',
  '> 生成的记忆来自工作台 `projects/<key>/memory.json`，真源在文件里，不在会话里。',
  '',
].join('\n')

const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.6

const OUTCOME_COLOURS = ['green', 'yellow', 'red']
const PORT_TYPES = new Set(['text', 'file', 'image', 'json', 'any'])
const VERIFIER_KINDS = new Set(['file-exists', 'file-contains'])

const METHOD_KINDS = {
  input: { label: '输入' },
  command: { label: '指令' },
  exec: { label: '执行' },
  observe: { label: '观测' },
  output: { label: '输出' },
}

// The executor registry is the single gate on green. v2 ships one real
// executor (local template assembly); model bridges stay declared but
// unregistered, so those methods render gray and refuse to run instead of
// faking success. Phase D registers llm against the session channels.
const EXECUTOR_KINDS = {
  text: { label: '模板拼装（本地，真跑）', available: true },
  llm: { label: '模型生文（阶段 D 接会话）', available: false },
  image: { label: '模型生图（供应商待定）', available: false },
  video: { label: '模型生视频（供应商待定）', available: false },
}

const INVALID = Symbol('invalid')

// ---------------------------------------------------------------------------
// small IO + normalisation helpers
// ---------------------------------------------------------------------------

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

function appendBounded(path, text, maxChars = 20000) {
  writeFileSync(path, boundedTail(readSafe(path) + text, maxChars), 'utf-8')
}

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '')
}

function cleanText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
}

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

function newId(prefix) {
  return prefix + '_' + randomBytes(5).toString('hex')
}

function serviceGet(ctx, name) {
  if (typeof ctx?.get === 'function') return ctx.get(name)
  return undefined
}

function readWorkspaceConfig() {
  const explicit = firstValue(process.env.DSH_WORKBENCH_CONFIG, process.env.DSH_CONFIG)
  const candidates = []
  if (explicit) candidates.push(isAbsolute(String(explicit)) ? String(explicit) : resolve(WB_DIR, String(explicit)))
  for (const name of ['workbench.config.json', 'dsh-workbench.json']) {
    const found = findAncestor(WB_DIR, dir => existsSync(join(dir, name)))
    if (found) candidates.push(join(found, name))
  }
  const path = candidates.find(candidate => existsSync(candidate)) || ''
  if (!path) return { path: '', value: {} }
  const value = readJsonSafe(path, null)
  return { path, value: value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
}

// Dispatch returns in Phase D; the workspace opt-in already matters there, so
// the read stays honest now and the panel can display it without guessing.
function executionConfig() {
  const value = readWorkspaceConfig().value.execution
  const exec = value && typeof value === 'object' ? value : {}
  let cwd = typeof exec.cwd === 'string' && exec.cwd ? exec.cwd : ''
  if (!cwd) {
    const base = basename(WB_DIR)
    cwd = base.startsWith('_') ? dirname(WB_DIR) : WB_DIR
  }
  return { enabled: exec.enabled === true, cwd }
}

// ---------------------------------------------------------------------------
// v2 storage: one directory per project, one JSON truth per concern
// ---------------------------------------------------------------------------

function projectPaths(key) {
  const dir = join(PROJECTS_DIR, key)
  return {
    dir,
    memory: join(dir, 'memory.json'),
    decisions: join(dir, 'decisions.md'),
    methods: join(dir, 'methods.json'),
    canvas: join(dir, 'canvas.json'),
    runs: join(dir, 'runs.json'),
    audit: join(dir, 'audit.jsonl'),
    artifacts: join(dir, 'artifacts'),
  }
}

function readProjects() {
  const raw = readJsonSafe(PROJECTS_JSON, null)
  const source = raw && typeof raw === 'object' ? raw : {}
  const items = Array.isArray(source.items)
    ? source.items.filter(item => item && typeof item.key === 'string' && typeof item.root === 'string')
    : []
  return {
    version: REGISTRY_VERSION,
    active: typeof source.active === 'string' ? source.active : '',
    items,
  }
}

function writeProjects(value) {
  ensureDir()
  writeFileSync(PROJECTS_JSON, JSON.stringify({
    version: REGISTRY_VERSION,
    active: value.active || '',
    items: value.items.slice(0, MAX_PROJECTS),
  }, null, 2), 'utf-8')
}

function projectNameFor(root) {
  return basename(canonicalPath(String(root))) || 'project'
}

function projectKeyFor(root) {
  return createHash('sha256').update(String(root).toLowerCase()).digest('hex').slice(0, 12)
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

// ---------------------------------------------------------------------------
// per-project records
// ---------------------------------------------------------------------------

function emptyMemory(key, root) {
  const stamp = new Date().toISOString()
  return {
    version: REGISTRY_VERSION,
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
    basis: { runId: '' },
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
    version: REGISTRY_VERSION,
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
    basis: raw.basis && typeof raw.basis === 'object' ? { runId: String(raw.basis.runId || '') } : { runId: '' },
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    migratedFrom: typeof raw.migratedFrom === 'string' ? raw.migratedFrom : '',
  }
}

function readMemory(key) {
  const raw = readJsonSafe(projectPaths(key).memory, null)
  if (!raw || typeof raw !== 'object') return null
  return normaliseMemory(raw, key)
}

function writeMemoryJson(memory) {
  const paths = projectPaths(memory.key)
  mkdirSync(paths.dir, { recursive: true })
  writeFileSync(paths.memory, JSON.stringify(memory, null, 2), 'utf-8')
}

function defaultMethods() {
  const builtin = (id, name, kind, ports, executor, verifier) => ({
    id, name, kind, owner: 'builtin',
    ports, executor, verifier,
    updatedAt: new Date().toISOString(),
  })
  return [
    builtin('m_input', '用户输入', 'input', { inputs: [], outputs: [{ name: 'out', type: 'text' }] }, { kind: '', params: {} }, { kind: 'file-exists', path: '' }),
    builtin('m_exec', '执行与日志', 'exec', { inputs: [{ name: 'in', type: 'text' }], outputs: [{ name: 'out', type: 'text' }] }, { kind: 'text', params: { content: '', template: '' } }, { kind: 'file-exists', path: '' }),
    builtin('m_output', '任务输出', 'output', { inputs: [{ name: 'in', type: 'text' }], outputs: [] }, { kind: '', params: {} }, { kind: 'file-exists', path: '' }),
  ]
}

function normalisePorts(raw, side) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 8).map((port, index) => {
    const name = cleanText(port?.name, 40) || side + (index + 1)
    const type = cleanText(port?.type, 20)
    return { name, type: PORT_TYPES.has(type) ? type : 'text' }
  })
}

function normaliseExecutor(kind, params) {
  const key = cleanText(kind, 40)
  if (!EXECUTOR_KINDS[key]) return { kind: '', params: {} }
  if (key === 'text') {
    return {
      kind: key,
      params: {
        content: String(params?.content ?? '').slice(0, 8000),
        template: String(params?.template ?? '').slice(0, 4000),
      },
    }
  }
  return { kind: key, params: {} }
}

function normaliseVerifier(raw) {
  const kind = cleanText(raw?.kind, 40)
  if (!VERIFIER_KINDS.has(kind)) return { kind: 'file-exists', path: '' }
  const verifier = { kind, path: cleanText(raw?.path, 200) }
  if (kind === 'file-contains') verifier.contains = String(raw?.contains ?? '').slice(0, 200)
  return verifier
}

// Only the exec kind carries an executor and a verifier. Anything else that
// arrives with one has it stripped here — the invariant is enforced at the
// storage boundary, not in the canvas renderer.
function normaliseMethod(raw, existing = null) {
  const name = cleanText(raw?.name ?? existing?.name, 60) || '未命名方法'
  const kind = cleanText(raw?.kind ?? existing?.kind, 20)
  const safeKind = METHOD_KINDS[kind] ? kind : (existing && METHOD_KINDS[existing.kind] ? existing.kind : 'exec')
  const ownerRaw = cleanText(raw?.owner ?? existing?.owner, 20)
  const owner = ['builtin', 'user', 'ai'].includes(ownerRaw) ? ownerRaw : 'user'
  const execInput = safeKind === 'exec' ? (raw?.executor !== undefined ? raw.executor : existing?.executor) : { kind: '', params: {} }
  const verifierInput = safeKind === 'exec' ? (raw?.verifier !== undefined ? raw.verifier : existing?.verifier) : { kind: 'file-exists', path: '' }
  return {
    // Read-back must keep the stored id (canvas nodes reference it); only a
    // genuinely new method gets a fresh one.
    id: existing ? existing.id : (cleanText(raw?.id, 80) || newId('m')),
    name,
    kind: safeKind,
    owner,
    ports: {
      inputs: normalisePorts(raw?.ports?.inputs !== undefined ? raw.ports.inputs : existing?.ports?.inputs, 'in'),
      outputs: normalisePorts(raw?.ports?.outputs !== undefined ? raw.ports.outputs : existing?.ports?.outputs, 'out'),
    },
    executor: normaliseExecutor(execInput?.kind, execInput?.params),
    verifier: normaliseVerifier(verifierInput),
    updatedAt: new Date().toISOString(),
  }
}

function ensureBuiltinMethods(methods) {
  const next = [...methods]
  for (const builtin of defaultMethods()) {
    if (!next.some(item => item.id === builtin.id)) next.unshift(builtin)
  }
  return next.slice(0, MAX_METHODS)
}

function readMethods(key) {
  const raw = readJsonSafe(projectPaths(key).methods, null)
  const items = Array.isArray(raw?.items) ? raw.items.filter(item => item && typeof item === 'object') : []
  return ensureBuiltinMethods(items.map(item => normaliseMethod(item, null)))
}

function writeMethods(key, methods) {
  const paths = projectPaths(key)
  mkdirSync(paths.dir, { recursive: true })
  writeFileSync(paths.methods, JSON.stringify({ version: REGISTRY_VERSION, items: ensureBuiltinMethods(methods) }, null, 2), 'utf-8')
}

function readCanvas(key) {
  const raw = readJsonSafe(projectPaths(key).canvas, null)
  return {
    version: REGISTRY_VERSION,
    nodes: Array.isArray(raw?.nodes) ? raw.nodes.filter(node => node && typeof node === 'object').map(node => ({ ...node })) : [],
    edges: Array.isArray(raw?.edges) ? raw.edges.filter(edge => edge && typeof edge === 'object').map(edge => ({ ...edge })) : [],
    state: raw && typeof raw.state === 'object' && raw.state ? { ...raw.state } : {},
  }
}

function writeCanvas(key, canvas) {
  const paths = projectPaths(key)
  mkdirSync(paths.dir, { recursive: true })
  writeFileSync(paths.canvas, JSON.stringify({
    version: REGISTRY_VERSION,
    nodes: canvas.nodes,
    edges: canvas.edges,
    state: canvas.state || {},
  }, null, 2), 'utf-8')
}

function clampViewNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.round(Math.min(max, Math.max(min, number)) * 10) / 10
}

function readCanvasView(key) {
  const raw = readJsonSafe(join(projectPaths(key).dir, 'canvas-view.json'), null)
  const positions = {}
  const source = raw && typeof raw.positions === 'object' && raw.positions ? raw.positions : {}
  for (const [id, point] of Object.entries(source).slice(0, MAX_NODES)) {
    if (!id) continue
    positions[id] = { x: clampViewNumber(point?.x, 0, 4000, 0), y: clampViewNumber(point?.y, 0, 4000, 0) }
  }
  return { positions, zoom: clampViewNumber(raw?.zoom, MIN_ZOOM, MAX_ZOOM, 1) }
}

function writeCanvasView(key, view) {
  const paths = projectPaths(key)
  mkdirSync(paths.dir, { recursive: true })
  writeFileSync(join(paths.dir, 'canvas-view.json'), JSON.stringify({ version: REGISTRY_VERSION, positions: view.positions, zoom: view.zoom }, null, 2), 'utf-8')
}

function readRuns(key) {
  const raw = readJsonSafe(projectPaths(key).runs, null)
  return Array.isArray(raw?.items) ? raw.items.filter(item => item && typeof item === 'object') : []
}

function writeRuns(key, items) {
  const paths = projectPaths(key)
  mkdirSync(paths.dir, { recursive: true })
  writeFileSync(paths.runs, JSON.stringify({ version: REGISTRY_VERSION, items: items.slice(0, MAX_RUNS) }, null, 2), 'utf-8')
}

function appendAudit(key, entry) {
  const paths = projectPaths(key)
  mkdirSync(paths.dir, { recursive: true })
  const line = JSON.stringify({ ts: new Date().toISOString(), actor: 'panel', version: REGISTRY_VERSION, ...entry }) + '\n'
  let text = readSafe(paths.audit) + line
  if (text.length > MAX_AUDIT_CHARS) {
    const lines = text.split('\n').filter(Boolean)
    text = lines.slice(-MAX_AUDIT_ENTRIES).join('\n') + '\n'
  }
  writeFileSync(paths.audit, text, 'utf-8')
}

// ---------------------------------------------------------------------------
// project registry + activation
// ---------------------------------------------------------------------------

function ensureProject(rootInput, { create = false, activate = false } = {}) {
  const requested = String(rootInput || '').trim()
  if (!requested) return { ok: false, error: '缺少项目根目录' }
  const lexical = isAbsolute(requested) ? resolve(requested) : resolve(WB_DIR, requested)
  if (!existsSync(lexical)) {
    if (!create) return { ok: false, error: '项目目录不存在：' + lexical }
    try { mkdirSync(lexical, { recursive: true }) } catch (error) {
      return { ok: false, error: '无法创建项目目录：' + String(error?.message || error) }
    }
  }
  try {
    if (!statSync(lexical).isDirectory()) return { ok: false, error: '项目根不是目录：' + lexical }
  } catch {
    return { ok: false, error: '项目目录不可读：' + lexical }
  }
  const root = canonicalPath(lexical)
  const key = projectKeyFor(root)
  const projects = readProjects()
  const stamp = new Date().toISOString()
  let item = projects.items.find(entry => entry.key === key)
  if (!item) {
    item = { key, root, name: projectNameFor(root), enabled: true, archived: false, roles: { t1: '', t2: '', t3: '' }, createdAt: stamp, updatedAt: stamp }
    projects.items.unshift(item)
  }
  if (activate || !projects.active) projects.active = key
  item.updatedAt = stamp
  writeProjects(projects)
  const paths = projectPaths(key)
  mkdirSync(paths.dir, { recursive: true })
  mkdirSync(paths.artifacts, { recursive: true })
  let memory = readMemory(key)
  if (!memory) {
    memory = emptyMemory(key, root)
    writeMemoryJson(memory)
  }
  memory.root = root
  if (!memory.name) memory.name = projectNameFor(root)
  if (!existsSync(paths.methods)) writeMethods(key, defaultMethods())
  if (!existsSync(paths.canvas)) writeCanvas(key, defaultCanvas())
  if (!existsSync(paths.runs)) writeRuns(key, [])
  return { ok: true, key, root, item, memory, projects }
}

function ensureReady() {
  if (existsSync(PROJECTS_JSON)) return
  try { migrateV2Layout() } catch { /* migration is best effort; routes still come up */ }
}

function activeProject() {
  ensureReady()
  const projects = readProjects()
  const item = projects.items.find(entry => entry.key === projects.active && !entry.archived) || projects.items.find(entry => !entry.archived)
  if (item) {
    const memory = readMemory(item.key)
    if (memory) return { ok: true, key: item.key, root: item.root, item, memory, projects }
  }
  return ensureProject(defaultMemoryRoot(), { create: true })
}

function resolveProjectArg(value) {
  const text = String(value || '').trim()
  if (!text) return activeProject()
  ensureReady()
  const projects = readProjects()
  const byName = projects.items.find(item => item.key === text || item.name === text || item.root === text)
  if (byName) {
    const memory = readMemory(byName.key)
    if (memory) return { ok: true, key: byName.key, root: byName.root, item: byName, memory, projects }
  }
  // No directory is created from a bare argument: a typo must not materialise
  // a project. Creation goes through POST /api/project.
  return ensureProject(text)
}

// ---------------------------------------------------------------------------
// AGENTS.md generated block (the memory reaches a model with no prompt code)
// ---------------------------------------------------------------------------

function decisionId(at, title) {
  return 'dec_' + createHash('sha256').update(String(at) + '|' + String(title)).digest('hex').slice(0, 10)
}

function decisionTitleFromBody(body, max = 90) {
  const text = String(body || '')
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const decidedLine = lines.find(line => /^决定[：:]/.test(line))
  if (decidedLine) return decidedLine.replace(/^决定[：:]\s*/, '').slice(0, max)
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
  const entry = explicit && explicit !== firstLine ? `${explicit}\n\n${body}` : body
  appendBounded(projectPaths(memory.key).decisions, `\n### ${stamp}\n${entry}\n`, 120000)
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
  lines.push(`> 真源 \`projects/${memory.key}/memory.json\`；本段由 dsh-workbench 生成，只读。`)
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

function blockShapes(memory) {
  const redTotal = Math.max(1, memory.red_lines.length)
  const decisionsTotal = Math.max(1, memory.decisions.length)
  const redSteps = [...new Set([redTotal, Math.min(redTotal, 4), Math.min(redTotal, 3), 2, 1])]
  const decisionSteps = [...new Set([6, 4, 2, 1].filter(count => count <= decisionsTotal).concat([0]))]
  const shapes = []
  for (const red of redSteps) {
    for (const decisions of decisionSteps) shapes.push({ decisions, next: 3, red })
  }
  return shapes
}

function fitMemoryBlock(memory) {
  for (const shape of blockShapes(memory)) {
    const block = renderMemoryBlock(memory, shape)
    if (Buffer.byteLength(block, 'utf8') <= MAX_AGENTS_BLOCK_BYTES) return block
  }
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

// A cycle is "closed" only when a close happened after the last finished run.
function memoryGap(memory) {
  const closedAt = Date.parse(memory.closedAt || '') || 0
  const openedAt = Date.parse(memory.openedAt || '') || 0
  const open = openedAt > closedAt
  let finishedAfterClose = 0
  let lastRunId = ''
  let lastAt = 0
  try {
    for (const run of readRuns(memory.key)) {
      if (!run.status || run.status === 'running') continue
      const at = Number(run.endedAt || run.startedAt || 0)
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

// ---------------------------------------------------------------------------
// globals (跨项目偏好：常用语句 + 设计令牌) — one JSON, user-editable
// ---------------------------------------------------------------------------

function readGlobals() {
  const raw = readJsonSafe(GLOBALS_JSON, null)
  const source = raw && typeof raw === 'object' ? raw : {}
  const phrases = Array.isArray(source.phrases) ? source.phrases.map(item => String(item)).filter(Boolean).slice(0, MAX_PHRASES) : []
  const tokensRaw = source.tokens && typeof source.tokens === 'object' ? source.tokens : {}
  const clampNum = (value, min, max, fallback) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
  }
  const accent = typeof tokensRaw.accent === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(tokensRaw.accent) ? tokensRaw.accent : ''
  return {
    version: REGISTRY_VERSION,
    phrases,
    tokens: {
      radius: clampNum(tokensRaw.radius, 6, 20, 14),
      gap: clampNum(tokensRaw.gap, 8, 32, 16),
      accent,
    },
  }
}

function writeGlobals(value) {
  ensureDir()
  writeFileSync(GLOBALS_JSON, JSON.stringify(value, null, 2), 'utf-8')
}

// ---------------------------------------------------------------------------
// canvas: node = method instance; the graph refuses what it cannot order
// ---------------------------------------------------------------------------

function defaultCanvas() {
  return minimalLoopSpec(1)
}

// The minimal loop is the acceptance floor (大纲 §6): user input → exec+log →
// task output. It is equivalent to one native conversation; a project opens
// with it already wired.
function minimalLoopSpec(loop) {
  const suffix = loop === 1 ? '' : '_' + loop
  return {
    version: REGISTRY_VERSION,
    nodes: [
      { id: 'n_in' + suffix, methodId: 'm_input', params: { content: '' }, loop },
      { id: 'n_exec' + suffix, methodId: 'm_exec', params: {}, loop },
      { id: 'n_out' + suffix, methodId: 'm_output', params: {}, loop },
    ],
    edges: [
      { id: 'e_in_exec' + suffix, from: { node: 'n_in' + suffix, port: 'out' }, to: { node: 'n_exec' + suffix, port: 'in' } },
      { id: 'e_exec_out' + suffix, from: { node: 'n_exec' + suffix, port: 'out' }, to: { node: 'n_out' + suffix, port: 'in' } },
    ],
    state: {},
  }
}

function methodById(methods, id) {
  return methods.find(item => item.id === id) || null
}

function mergedParams(method, node) {
  return { ...(method?.executor?.params || {}), ...(node.params && typeof node.params === 'object' ? node.params : {}) }
}

function nodeTitle(method, node) {
  return method?.name || cleanText(node?.methodId, 60) || '未知方法'
}

// Deterministic slot layout: columns follow graph depth, rows follow loops.
// Dragging still wins (positions persist), 整理 just falls back to this.
function layoutPosition(depth, loop) {
  return { x: 24 + depth * 360, y: 24 + (loop - 1) * 300 }
}

function graphDepth(canvas) {
  const depth = new Map()
  const indegree = new Map(canvas.nodes.map(node => [node.id, 0]))
  const outgoing = new Map(canvas.nodes.map(node => [node.id, []]))
  for (const edge of canvas.edges) {
    if (!indegree.has(edge?.from?.node) || !indegree.has(edge?.to?.node)) continue
    indegree.set(edge.to.node, indegree.get(edge.to.node) + 1)
    outgoing.get(edge.from.node).push(edge.to.node)
  }
  const queue = canvas.nodes.filter(node => indegree.get(node.id) === 0).map(node => node.id)
  for (const id of queue) depth.set(id, 0)
  while (queue.length) {
    const id = queue.shift()
    for (const next of outgoing.get(id)) {
      depth.set(next, Math.max(depth.get(next) || 0, (depth.get(id) || 0) + 1))
      indegree.set(next, indegree.get(next) - 1)
      if (indegree.get(next) === 0) queue.push(next)
    }
  }
  return id => depth.get(id) || 0
}

function topoOrder(canvas) {
  const ids = canvas.nodes.map(node => node.id)
  const indegree = new Map(ids.map(id => [id, 0]))
  const outgoing = new Map(ids.map(id => [id, []]))
  for (const edge of canvas.edges) {
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

function validateCanvas(canvas, methods) {
  const issues = []
  const byId = new Map()
  for (const node of canvas.nodes) {
    if (byId.has(node.id)) issues.push({ code: 'duplicate-node', nodeId: node.id, message: '节点 id 重复：' + node.id })
    byId.set(node.id, node)
    const method = methodById(methods, node.methodId)
    if (!method) issues.push({ code: 'unknown-method', nodeId: node.id, message: '方法库里没有 ' + String(node.methodId || '（空）') })
  }
  const boundInputs = new Map()
  for (const edge of canvas.edges) {
    const from = byId.get(edge?.from?.node)
    const to = byId.get(edge?.to?.node)
    if (!from || !to) {
      issues.push({ code: 'unknown-endpoint', edgeId: edge.id || '', message: '边的端点不在画布上' })
      continue
    }
    const fromMethod = methodById(methods, from.methodId)
    const toMethod = methodById(methods, to.methodId)
    const outPort = (fromMethod?.ports?.outputs || []).find(port => port.name === edge.from.port)
    const inPort = (toMethod?.ports?.inputs || []).find(port => port.name === edge.to.port)
    if (!outPort || !inPort) {
      issues.push({ code: 'unknown-port', edgeId: edge.id || '', message: '边的端口不存在：' + String(edge.from.port || '?') + ' → ' + String(edge.to.port || '?') })
      continue
    }
    const compatible = outPort.type === inPort.type || outPort.type === 'any' || inPort.type === 'any'
    if (!compatible) {
      issues.push({
        code: 'type-mismatch', edgeId: edge.id || '',
        message: (fromMethod?.name || from.id) + ' 产出 ' + outPort.type + '，而 ' + (toMethod?.name || to.id) + ' 需要 ' + inPort.type,
      })
    }
    const key = to.id + ':' + inPort.name
    if (boundInputs.has(key)) {
      issues.push({ code: 'input-bound-twice', edgeId: edge.id || '', message: (toMethod?.name || to.id) + ' 的 ' + inPort.name + ' 被两条边同时接上' })
    }
    boundInputs.set(key, edge)
    if (from.id === to.id) issues.push({ code: 'self-loop', edgeId: edge.id || '', message: '节点不能接回自己' })
  }
  const order = topoOrder(canvas)
  if (!order) issues.push({ code: 'cycle', message: '这些边形成了环，画布无法排序执行' })
  return { ok: issues.length === 0, issues, order: order || [] }
}

function nodeRuntime(node, method, canvas) {
  const isExec = method?.kind === 'exec'
  const registered = isExec ? EXECUTOR_KINDS[method?.executor?.kind] : null
  const available = Boolean(registered && registered.available)
  const record = canvas.state?.[node.id] || null
  return {
    methodId: node.methodId,
    kind: method?.kind || 'exec',
    kindLabel: METHOD_KINDS[method?.kind]?.label || '执行',
    title: nodeTitle(method, node),
    executor: isExec ? (method?.executor?.kind || '') : '',
    executorLabel: isExec ? (registered?.label || '未注册 executor') : '无执行器（' + (METHOD_KINDS[method?.kind]?.label || '执行') + '型）',
    available,
    status: available ? String(record?.status || 'idle') : 'gray',
    artifact: String(record?.artifact || ''),
    note: available ? String(record?.note || '') : (isExec ? 'executor 未注册：这个方法在 v2 里跑不了。' : '无执行器：' + (method?.kind === 'input' ? '文字存在节点上。' : '渲染上游的产物。')),
    checkedAt: String(record?.checkedAt || ''),
  }
}

function canvasPayload(project) {
  const methods = readMethods(project.key)
  const canvas = readCanvas(project.key)
  const view = readCanvasView(project.key)
  const validation = validateCanvas(canvas, methods)
  const badEdges = new Set(validation.issues.map(issue => issue.edgeId).filter(Boolean))
  const badNodes = new Set(validation.issues.map(issue => issue.nodeId).filter(Boolean))
  const depthOf = graphDepth(canvas)
  const loops = {}
  for (const node of canvas.nodes) {
    const loop = Number(node.loop) || 1
    loops[loop] = Math.max(loops[loop] || 0, loop)
  }
  const maxLoop = Math.max(1, ...Object.keys(loops).map(Number))
  const runs = readRuns(project.key)
  const runByLoop = new Map(runs.map(run => [Number(run.loop) || 0, run]))
  return {
    ok: true,
    version: REGISTRY_VERSION,
    nodes: canvas.nodes.map(node => {
      const method = methodById(methods, node.methodId)
      return {
        ...node,
        params: mergedParams(method, node),
        hasOwnParams: Boolean(node.params && Object.keys(node.params).length),
        position: view.positions[node.id] || layoutPosition(depthOf(node.id), Number(node.loop) || 1),
        runtime: nodeRuntime(node, method, canvas),
        issues: validation.issues.filter(issue => issue.nodeId === node.id).map(issue => issue.message),
        blocked: badNodes.has(node.id),
      }
    }),
    edges: canvas.edges.map(edge => ({ ...edge, valid: !badEdges.has(edge.id) })),
    validation,
    view,
    maxLoop,
    loops: Object.keys(loops).map(Number).sort((a, b) => a - b).map(loop => {
      const run = runByLoop.get(loop) || null
      return {
        loop,
        runId: run?.runId || '',
        status: run?.status || '',
        colour: run?.colour || '',
        goal: String(run?.goal || '').slice(0, 60),
      }
    }),
    methods: methods.map(method => ({
      id: method.id,
      name: method.name,
      kind: method.kind,
      kindLabel: METHOD_KINDS[method.kind]?.label || method.kind,
      owner: method.owner,
      ports: method.ports,
      executor: { kind: method.executor.kind, available: Boolean(EXECUTOR_KINDS[method.executor.kind]?.available) },
    })),
    executors: Object.entries(EXECUTOR_KINDS).map(([kind, value]) => ({ kind, label: value.label, available: value.available })),
    fetchedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// run engine: one engine for canvas execution and the minimal loop
// ---------------------------------------------------------------------------

function artifactPathIn(projectKey, candidate) {
  const root = projectPaths(projectKey).artifacts
  const target = resolve(root, candidate || '')
  const rel = relative(root, target)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return ''
  return target
}

function verifyArtifact(projectKey, method, merged, artifact) {
  const verifier = method?.verifier || { kind: 'file-exists', path: '' }
  const path = artifactPathIn(projectKey, verifier.path) || artifact
  if (!path) return { status: 'red', note: '没有可验证的产物路径' }
  let exists = false
  let bytes = 0
  try {
    const info = statSync(path)
    exists = info.isFile()
    bytes = info.size
  } catch { exists = false }
  if (!exists || bytes === 0) {
    const display = projectPaths(projectKey).artifacts
    return { status: 'red', note: '产物不存在：' + relative(display, path) }
  }
  if (verifier.kind === 'file-contains') {
    const text = readSafe(path)
    if (!verifier.contains) return { status: 'red', note: 'file-contains 没有给出要匹配的文字' }
    if (!text.includes(verifier.contains)) return { status: 'red', note: '产物里找不到「' + verifier.contains + '」' }
  }
  return { status: 'green', note: relative(projectPaths(projectKey).artifacts, path) }
}

function resolveUpstreamText(projectKey, canvas, methods, node) {
  const chunks = []
  for (const edge of canvas.edges) {
    if (edge?.to?.node !== node.id) continue
    const source = canvas.nodes.find(item => item.id === edge.from.node)
    if (!source) continue
    const sourceMethod = methodById(methods, source.methodId)
    const record = canvas.state?.[source.id] || null
    const artifact = record?.artifact ? readSafe(record.artifact) : ''
    if (artifact.trim()) { chunks.push(artifact.trim()); continue }
    // Input-style nodes keep their text on the node itself, so an unsaved
    // upstream still contributes what the user typed instead of silence.
    const params = mergedParams(sourceMethod, source)
    const own = String(params.content || '').trim()
    if (own) chunks.push(own)
  }
  return chunks.join('\n\n')
}

function runLoop(project) {
  const methods = readMethods(project.key)
  const canvas = readCanvas(project.key)
  const validation = validateCanvas(canvas, methods)
  if (!validation.ok) return { ok: false, code: 'canvas-invalid', validation }
  const inputNode = canvas.nodes
    .filter(node => methodById(methods, node.methodId)?.kind === 'input')
    .sort((a, b) => validation.order.indexOf(a.id) - validation.order.indexOf(b.id))[0]
  const goal = String(mergedParams(methodById(methods, inputNode?.methodId), inputNode).content || '').trim()
  if (!goal) return { ok: false, code: 'empty-input', validation }

  const startedAt = Date.now()
  const results = []
  for (const nodeId of validation.order) {
    const node = canvas.nodes.find(item => item.id === nodeId)
    const method = methodById(methods, node.methodId)
    if (method.kind !== 'exec') {
      const note = method.kind === 'input' ? '输入就绪' : '渲染上游产物'
      results.push({ nodeId, methodId: node.methodId, title: nodeTitle(method, node), status: 'ready', artifact: '', note })
      continue
    }
    const runtime = nodeRuntime(node, method, canvas)
    if (!runtime.available) {
      // Gray stays gray: recorded with the reason, never as a green that no
      // verifier and no artifact backed.
      canvas.state[nodeId] = { status: 'gray', artifact: '', note: runtime.note, checkedAt: new Date().toISOString() }
      results.push({ nodeId, methodId: node.methodId, title: nodeTitle(method, node), status: 'gray', artifact: '', note: runtime.note })
      continue
    }
    const merged = mergedParams(method, node)
    const upstream = resolveUpstreamText(project.key, canvas, methods, node)
    const fallback = String(merged.content || '') ? '{{content}}' : '{{input}}'
    const body = String(merged.template || fallback)
      .replace(/\{\{input\}\}/g, upstream)
      .replace(/\{\{content\}\}/g, String(merged.content || ''))
    const paths = projectPaths(project.key)
    mkdirSync(paths.artifacts, { recursive: true })
    const artifact = join(paths.artifacts, node.id + '.md')
    writeFileSync(artifact, body, 'utf-8')
    const verified = verifyArtifact(project.key, method, merged, artifact)
    canvas.state[nodeId] = { status: verified.status, artifact, note: verified.note, checkedAt: new Date().toISOString() }
    results.push({ nodeId, methodId: node.methodId, title: nodeTitle(method, node), status: verified.status, artifact, note: verified.note })
  }

  // The output node's report is derived from what actually landed on disk.
  const outputs = {}
  for (const node of canvas.nodes) {
    if (methodById(methods, node.methodId)?.kind !== 'output') continue
    outputs[node.id] = resolveUpstreamText(project.key, canvas, methods, node).slice(0, 8000)
  }
  const green = results.filter(item => item.status === 'green').length
  const gray = results.filter(item => item.status === 'gray').length
  const red = results.filter(item => item.status === 'red').length
  const run = {
    runId: newId('r'),
    loop: Math.max(1, ...canvas.nodes.map(node => Number(node.loop) || 1)),
    goal: goal.slice(0, 200),
    status: red ? 'failed' : 'done',
    startedAt,
    endedAt: Date.now(),
    nodes: results,
    artifacts: results.filter(item => item.artifact).map(item => item.artifact),
    output: Object.values(outputs).join('\n\n').slice(0, 8000),
    counts: { green, gray, red },
  }
  const runs = readRuns(project.key)
  runs.unshift(run)
  writeRuns(project.key, runs)

  // 大纲 §6: after each loop a fresh minimal loop attaches behind the last
  // output, so the canvas always ends with an empty input ready to type into.
  const nextLoop = run.loop + 1
  const fresh = minimalLoopSpec(nextLoop)
  const depthOf = graphDepth({ ...canvas, nodes: canvas.nodes.concat(fresh.nodes) })
  const view = readCanvasView(project.key)
  for (const node of fresh.nodes) {
    view.positions[node.id] = layoutPosition(depthOf(node.id), nextLoop)
  }
  const merged = {
    nodes: canvas.nodes.concat(fresh.nodes),
    edges: canvas.edges.concat(fresh.edges),
    state: canvas.state,
  }
  writeCanvasView(project.key, view)
  writeCanvas(project.key, merged)
  appendAudit(project.key, {
    action: 'run.loop',
    requestId: run.runId,
    summary: `第 ${run.loop} 轮 · 绿 ${green} · 灰 ${gray} · 红 ${red} · 产物 ${run.artifacts.length}`,
  })
  return { ok: true, run, canvas: canvasPayload(project) }
}

// Deleting the artifact and re-verifying must turn the node red — that is the
// machine check on 绿不作假.
function reverifyCanvas(project) {
  const methods = readMethods(project.key)
  const canvas = readCanvas(project.key)
  const results = []
  for (const node of canvas.nodes) {
    const method = methodById(methods, node.methodId)
    if (method?.kind !== 'exec') continue
    const runtime = nodeRuntime(node, method, canvas)
    if (!runtime.available) {
      results.push({ nodeId: node.id, status: 'gray', note: runtime.note })
      continue
    }
    const record = canvas.state?.[node.id] || {}
    const verified = verifyArtifact(project.key, method, mergedParams(method, node), record.artifact || '')
    canvas.state[node.id] = { status: verified.status, artifact: record.artifact || '', note: verified.note, checkedAt: new Date().toISOString() }
    results.push({ nodeId: node.id, status: verified.status, note: verified.note })
  }
  writeCanvas(project.key, canvas)
  appendAudit(project.key, { action: 'run.reverify', summary: results.map(item => item.nodeId + ':' + item.status).join(' ') })
  return { ok: true, results, canvas: canvasPayload(project) }
}

function runDigest(projectKey, limit = 10) {
  return readRuns(projectKey).slice(0, limit).map(run => ({
    runId: run.runId,
    loop: Number(run.loop) || 0,
    goal: String(run.goal || '').slice(0, 80),
    status: run.status,
    colour: run.colour || '',
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    counts: run.counts || { green: 0, gray: 0, red: 0 },
    artifactCount: Array.isArray(run.artifacts) ? run.artifacts.length : 0,
    outputFirstLine: String(run.output || '').split('\n').find(Boolean) || '',
  }))
}

// ---------------------------------------------------------------------------
// v2 migration: import the old tree once, move the originals to _archive/v0.15
// ---------------------------------------------------------------------------

function moveOld(source, name) {
  const from = join(WB_DIR, name)
  if (!existsSync(from)) return false
  const to = join(ARCHIVE_DIR, name)
  if (existsSync(to)) {
    try { rmTree(from) } catch { /* leave it; the archive copy already exists */ }
    return true
  }
  try {
    renameSync(from, to)
    return true
  } catch {
    try { copyTree(from, to); rmTree(from); return true } catch { return false }
  }
}

function rmTree(target) {
  try {
    rmSync(target, { recursive: true, force: true })
  } catch { /* best effort */ }
}

function copyTree(from, to) {
  const info = statSync(from)
  if (info.isDirectory()) {
    mkdirSync(to, { recursive: true })
    for (const entry of readdirSync(from)) copyTree(join(from, entry), join(to, entry))
  } else {
    writeFileSync(to, readFileSync(from))
  }
}

// Legacy memory records become project directories; the legacy single slot
// becomes the default project. The originals then move to _archive/v0.15/,
// which is why this whole function is gated on projects.json existing.
function migrateV2Layout() {
  if (existsSync(PROJECTS_JSON)) return { migrated: false }
  ensureDir()
  mkdirSync(ARCHIVE_DIR, { recursive: true })

  const registry = { version: REGISTRY_VERSION, active: '', items: [] }
  const seen = new Set()
  const stamp = new Date().toISOString()

  // 1. legacy per-project memory (v1.0 layout: memory/<key>.json)
  const legacyMemoryDir = join(WB_DIR, 'memory')
  const legacyRegistry = readJsonSafe(join(legacyMemoryDir, 'projects.json'), null)
  const legacyItems = Array.isArray(legacyRegistry?.items) ? legacyRegistry.items : []
  for (const item of legacyItems) {
    if (!item || typeof item.key !== 'string' || typeof item.root !== 'string') continue
    const raw = readJsonSafe(join(legacyMemoryDir, item.key + '.json'), null)
    if (!raw) continue
    const memory = normaliseMemory(raw, item.key)
    const created = ensureProject(memory.root || item.root, { activate: item.key === legacyRegistry.active })
    if (!created.ok) continue
    writeMemoryJson({ ...memory, key: created.key, root: created.root })
    const legacyDecisions = readSafe(join(legacyMemoryDir, item.key + '.decisions.md'))
    if (legacyDecisions.trim()) {
      writeFileSync(projectPaths(created.key).decisions, legacyDecisions.replace(/\s*$/, '') + '\n', 'utf-8')
    }
    if (!registry.items.some(entry => entry.key === created.key)) {
      registry.items.push({ ...created.item, updatedAt: stamp })
      seen.add(created.key)
    }
  }

  // 2. legacy single slot + flow + runs + audit land on the default project
  const created = ensureProject(defaultMemoryRoot(), { activate: registry.items.length === 0 })
  if (!created.ok) return { migrated: false, error: created.error }
  const key = created.key
  if (!registry.items.some(entry => entry.key === key)) registry.items.push({ ...created.item, updatedAt: stamp })
  if (!registry.active) registry.active = key

  if (true) {
    const legacyState = readJsonSafe(join(WB_DIR, 'state.json'), null)
    const legacyDecisions = readSafe(join(WB_DIR, 'decisions.md'))
    // A v1.0 memory record for the same root wins; only a truly unrecorded
    // project imports from the legacy slot files. The content guards make the
    // import idempotent even when the default project IS a legacy project.
    const existingMemory = readMemory(key)
    if (legacyState && existingMemory && !existingMemory.mainline) {
      existingMemory.mainline = typeof legacyState.mainline === 'string' ? legacyState.mainline : ''
      existingMemory.stopped_at = typeof legacyState.stopped_at === 'string' ? legacyState.stopped_at : ''
      existingMemory.next = Array.isArray(legacyState.next) ? legacyState.next.map(String).filter(Boolean).slice(0, 3) : []
      existingMemory.red_lines = Array.isArray(legacyState.red_lines) ? legacyState.red_lines.map(String).filter(Boolean) : []
      if (typeof legacyState.updated === 'string' && legacyState.updated) existingMemory.closedAt = legacyState.updated
      existingMemory.migratedFrom = 'state.json+decisions.md'
      writeMemoryJson(existingMemory)
    }
    if (legacyDecisions.trim() && !readSafe(projectPaths(key).decisions).trim()) {
      writeFileSync(projectPaths(key).decisions, legacyDecisions.replace(/\s*$/, '') + '\n', 'utf-8')
      const memory = readMemory(key)
      memory.decisions = parseDecisionIndex(legacyDecisions).slice(-20)
      writeMemoryJson(memory)
    }

    const legacyRuns = readJsonSafe(join(WB_DIR, 'runs.json'), null)
    if (Array.isArray(legacyRuns?.items) && legacyRuns.items.length && readRuns(key).length === 0) {
      const mapped = legacyRuns.items.map(run => ({
        runId: String(run.runId || ''),
        loop: 0,
        goal: String(run.goal || '').slice(0, 200),
        status: run.status === 'running' ? 'cancelled' : String(run.status || 'cancelled'),
        startedAt: Number(run.createdAt) || 0,
        endedAt: Number(run.updatedAt) || Number(run.createdAt) || 0,
        nodes: [],
        artifacts: [],
        output: String(run.reply || '').slice(0, 8000),
        counts: { green: 0, gray: 0, red: 0 },
        migratedFrom: 'v0.16-dispatch',
      }))
      writeRuns(key, mapped)
    }

    const legacyAudit = readSafe(join(WB_DIR, 'audit.jsonl'))
    if (legacyAudit.trim() && !readSafe(projectPaths(key).audit).trim()) {
      writeFileSync(projectPaths(key).audit, legacyAudit, 'utf-8')
    }

    // 3. flow.json → methods + canvas. Old nodes carried the executor
    // directly; each becomes a user method so the canvas keeps its picture.
    // The minimal loop is appended next to the legacy picture (unless the old
    // graph already has one), so a migrated project opens ready to type into.
    const legacyFlow = readJsonSafe(join(WB_DIR, 'flow.json'), null)
    if (legacyFlow && Array.isArray(legacyFlow.nodes) && legacyFlow.nodes.length) {
      const methods = readMethods(key)
      const nodes = []
      for (const oldNode of legacyFlow.nodes) {
        if (!oldNode || typeof oldNode !== 'object') continue
        const hadExecutor = Boolean(oldNode.executor?.kind)
        const method = normaliseMethod({
          name: cleanText(oldNode.title, 60) || '旧节点',
          kind: hadExecutor ? 'exec' : 'input',
          owner: 'user',
          ports: { inputs: oldNode.inputs || [], outputs: oldNode.outputs || [] },
          executor: hadExecutor ? oldNode.executor : { kind: '', params: {} },
          verifier: oldNode.verifier || { kind: 'file-exists', path: '' },
        }, null)
        methods.push(method)
        nodes.push({ id: String(oldNode.id), methodId: method.id, params: (oldNode.executor?.params && { ...oldNode.executor.params }) || {}, loop: 1 })
      }
      writeMethods(key, methods)
      const state = {}
      const oldState = legacyFlow.state && typeof legacyFlow.state === 'object' ? legacyFlow.state : {}
      const artifactsDir = projectPaths(key).artifacts
      mkdirSync(artifactsDir, { recursive: true })
      for (const node of nodes) {
        const record = oldState[node.id]
        if (!record?.artifact) continue
        const base = basename(record.artifact)
        const from = join(WB_DIR, 'flow-out', base)
        if (existsSync(from)) {
          try { writeFileSync(join(artifactsDir, base), readFileSync(from)) } catch { /* skip a lost artifact honestly */ }
        }
        state[node.id] = { ...record, artifact: existsSync(join(artifactsDir, base)) ? join(artifactsDir, base) : '' }
      }
      const legacyEdges = Array.isArray(legacyFlow.edges) ? legacyFlow.edges : []
      // Append the minimal loop when the legacy graph lacks one — the §6 floor
      // is "a project opens ready to run", not "ready to be rebuilt first".
      const hasMinimal = nodes.some(node => ['n_in', 'n_exec', 'n_out'].includes(node.id))
      const legacyNodeIds = new Set(nodes.map(node => node.id))
      const canAppend = !hasMinimal && !legacyNodeIds.has('n_in') && !legacyNodeIds.has('n_exec') && !legacyNodeIds.has('n_out')
      const loopNodes = canAppend ? nodes.concat(minimalLoopSpec(1).nodes) : nodes
      const loopEdges = canAppend ? legacyEdges.concat(minimalLoopSpec(1).edges) : legacyEdges
      writeCanvas(key, {
        version: REGISTRY_VERSION,
        nodes: loopNodes,
        edges: loopEdges,
        state,
      })
      const legacyView = readJsonSafe(join(WB_DIR, 'flow-view.json'), null)
      if (legacyView && typeof legacyView.positions === 'object' && legacyView.positions) {
        writeCanvasView(key, { positions: legacyView.positions, zoom: clampViewNumber(legacyView.zoom, MIN_ZOOM, MAX_ZOOM, 1) })
      }
    }
  }

  writeProjects(registry)
  if (!existsSync(GLOBALS_JSON)) writeGlobals(readGlobals())

  // 4. regenerate every AGENTS.md block so the 真源 line points at the new path
  for (const item of registry.items) {
    const memory = readMemory(item.key)
    if (memory) syncAgentsFile(memory.root, memory)
  }

  // 5. move the originals to the read-only archive
  for (const name of ['state.json', 'state.md', 'decisions.md', 'memory', 'flow.json', 'flow-view.json', 'flow-out', 'runs.json', 'audit.jsonl', 'modules.json', 'templates.json', 'outcomes.json', 'ledger.json']) {
    moveOld(WB_DIR, name)
  }

  appendAudit(key, { action: 'migration.v2', summary: '旧布局导入 projects/<key>/，原件移入 _archive/v0.15/' })
  return { migrated: true, active: registry.active, projects: registry.items.length }
}

// ---------------------------------------------------------------------------
// model catalog (read-only) + derived health
// ---------------------------------------------------------------------------

function normalizeModelEntry(value) {
  if (!value || typeof value !== 'object') return null
  const id = String(value.id ?? value.model ?? '').trim()
  if (!id) return null
  return { id, name: String(value.name ?? value.label ?? id) }
}

function normalizeProviderEntry(value) {
  if (!value || typeof value === 'object' && Array.isArray(value)) return null
  if (typeof value === 'string') return { id: value, name: value, models: [] }
  const id = String(value.id ?? value.name ?? '').trim()
  if (!id) return null
  const models = Array.isArray(value.models) ? value.models.map(normalizeModelEntry).filter(Boolean) : []
  return { id, name: String(value.name ?? id), models }
}

async function modelCatalogPayload(ctx) {
  const llm = serviceGet(ctx, 'llm')
  const providers = llm && typeof llm.list === 'function' ? await llm.list() : null
  const groups = (Array.isArray(providers) ? providers : [])
    .map(normalizeProviderEntry).filter(Boolean)
  return {
    available: groups.length > 0,
    reason: groups.length ? '' : '当前 profile 的 llm 服务不可用或没有模型路由',
    groups,
    fetchedAt: new Date().toISOString(),
  }
}

// Health is derived from this project's own run history — the plugin never
// calls a provider, so "healthy" means "last run with this model finished".
function modelHealth(projectKey) {
  const health = {}
  for (const run of readRuns(projectKey)) {
    const model = String(run.model || '')
    if (!model) continue
    if (!(model in health)) health[model] = { lastStatus: run.status, at: Number(run.endedAt) || 0 }
  }
  return health
}

// ---------------------------------------------------------------------------
// snapshot: one request paints the whole page
// ---------------------------------------------------------------------------

async function snapshotPayload(ctx, projectKey = '') {
  const project = projectKey ? resolveProjectArg(projectKey) : activeProject()
  if (!project.ok) return { ok: false, error: project.error || '项目不可用' }
  const projects = readProjects()
  const gap = memoryGap(project.memory)
  const memory = { ...publicMemory(project.memory), gap }
  const execution = executionConfig()
  const runs = runDigest(project.key)
  const methods = readMethods(project.key)
  const canvas = canvasPayload(project)
  const catalog = await modelCatalogPayload(ctx)
  return {
    ok: true,
    version: REGISTRY_VERSION,
    active: project.key,
    projects: projects.items.map(item => ({
      key: item.key,
      root: item.root,
      name: item.name,
      enabled: item.enabled !== false && !item.archived,
      archived: Boolean(item.archived),
      roles: item.roles && typeof item.roles === 'object' ? item.roles : { t1: '', t2: '', t3: '' },
      outcome: readMemory(item.key)?.outcome || '',
      mainline: readMemory(item.key)?.mainline || '',
      updatedAt: item.updatedAt || '',
    })),
    memory,
    agents: {
      path: join(project.root, 'AGENTS.md'),
      bytes: Buffer.byteLength(fitMemoryBlock({ ...project.memory, gapNote: gap.open ? 'x' : '' }), 'utf8'),
    },
    globals: readGlobals(),
    execution: { enabled: execution.enabled, cwd: execution.cwd },
    methods: methods.map(method => ({
      id: method.id,
      name: method.name,
      kind: method.kind,
      kindLabel: METHOD_KINDS[method.kind]?.label || method.kind,
      owner: method.owner,
      ports: method.ports,
      executor: {
        kind: method.executor.kind,
        label: EXECUTOR_KINDS[method.executor.kind]?.label || '',
        available: Boolean(EXECUTOR_KINDS[method.executor.kind]?.available),
      },
      verifier: method.verifier,
    })),
    canvas,
    runs,
    models: { available: catalog.available, reason: catalog.reason, groups: catalog.groups },
    modelHealth: modelHealth(project.key),
    fetchedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// routes (8) + tools (3)
// ---------------------------------------------------------------------------

export const name = 'dsh-workbench'
export const inject = ['tools', 'webServer', 'connection']

export async function apply(ctx) {
  const disposers = []
  try { ensureReady() } catch { /* migration is best effort */ }

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

  const readBody = async (res, req) => {
    const body = await readJsonBody(req)
    if (body.tooLarge) { sendJson(res, 413, { ok: false, error: '请求体过大' }); return null }
    if (body.error) { sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON 对象' }); return null }
    return body.json
  }

  // 1. snapshot ---------------------------------------------------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-workbench/api/snapshot',
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      const url = new URL(String(req.url || ''), 'http://127.0.0.1')
      const projectKey = String(url.searchParams.get('project') || '').slice(0, 80)
      sendJson(res, 200, await snapshotPayload(ctx, projectKey))
    },
  }))

  // 2. project: create / activate / enable / archive / bind --------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-workbench/api/project',
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const input = await readBody(res, req)
      if (!input) return
      const op = cleanText(input.op, 20)
      const stamp = new Date().toISOString()
      if (op === 'create') {
        const root = normaliseText(input.root, 500)
        if (root === INVALID) { sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return }
        const created = ensureProject(root || defaultMemoryRoot(), { create: true, activate: true })
        if (!created.ok) { sendJson(res, 400, { ok: false, error: created.error }); return }
        const displayName = cleanText(input.name, 60)
        if (displayName && created.item.name !== displayName) {
          created.item.name = displayName
          created.item.updatedAt = stamp
          writeProjects(created.projects)
          const memory = readMemory(created.key)
          if (memory) saveMemory({ ...memory, name: displayName })
        }
        appendAudit(created.key, { action: 'project.create', summary: created.root })
        sendJson(res, 200, { ok: true, project: created.item, snapshot: await snapshotPayload(ctx, created.key) })
        return
      }
      const key = cleanText(input.key, 80)
      const projects = readProjects()
      const item = projects.items.find(entry => entry.key === key)
      if (!item) { sendJson(res, 404, { ok: false, error: '没有这个项目' }); return }
      if (op === 'activate') {
        if (item.archived) { sendJson(res, 409, { ok: false, error: '已归档的项目先恢复再打开' }); return }
        projects.active = key
        writeProjects(projects)
        appendAudit(key, { action: 'project.activate', summary: item.name })
        sendJson(res, 200, { ok: true, snapshot: await snapshotPayload(ctx, key) })
        return
      }
      if (op === 'enable' || op === 'archive') {
        if (op === 'enable') item.enabled = input.enabled !== false
        if (op === 'archive') {
          item.archived = input.archived !== false
          if (item.archived) item.enabled = false
        }
        item.updatedAt = stamp
        writeProjects(projects)
        appendAudit(key, { action: 'project.' + op, summary: item.name + ' · ' + (op === 'archive' ? (item.archived ? '归档' : '恢复') : (item.enabled ? '启用' : '停用')) })
        sendJson(res, 200, { ok: true, snapshot: await snapshotPayload(ctx) })
        return
      }
      if (op === 'bind') {
        const rolesIn = input.roles && typeof input.roles === 'object' ? input.roles : {}
        const cleanRole = value => {
          const text = normaliseText(value, 200)
          return text === INVALID || text === undefined ? undefined : text
        }
        const roles = { ...item.roles }
        for (const tier of ['t1', 't2', 't3']) {
          const value = cleanRole(rolesIn[tier])
          if (value !== undefined) roles[tier] = value
        }
        item.roles = roles
        item.updatedAt = stamp
        writeProjects(projects)
        appendAudit(key, { action: 'project.bind', summary: `t1=${roles.t1 || '—'} t2=${roles.t2 || '—'} t3=${roles.t3 || '—'}` })
        sendJson(res, 200, { ok: true, roles, snapshot: await snapshotPayload(ctx, key) })
        return
      }
      sendJson(res, 400, { ok: false, error: 'op 必须是 create / activate / enable / archive / bind' })
    },
  }))

  // 3. memory: main / global / close ------------------------------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-workbench/api/memory',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        if (!guard(req, res, 'GET')) return
        const project = activeProject()
        if (!project.ok) { sendJson(res, 503, { ok: false, error: project.error || '项目不可用' }); return }
        sendJson(res, 200, { ok: true, memory: { ...publicMemory(project.memory), gap: memoryGap(project.memory) } })
        return
      }
      if (!guard(req, res, 'PUT')) return
      const input = await readBody(res, req)
      if (!input) return
      const op = cleanText(input.op, 20)
      const stamp = new Date().toISOString()
      const project = input.key ? resolveProjectArg(String(input.key)) : activeProject()
      if (!project.ok) { sendJson(res, 503, { ok: false, error: project.error || '项目不可用' }); return }
      if (op === 'main') {
        const memory = { ...project.memory }
        const mainline = normaliseText(input.mainline, 500)
        const stopped = normaliseText(input.stopped_at, 500)
        const next = normaliseList(input.next, 10, 500)
        const redLines = normaliseList(input.red_lines, 20, 300)
        if ([mainline, stopped, next, redLines].includes(INVALID)) {
          sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return
        }
        const changed = []
        if (mainline !== undefined) { memory.mainline = mainline; changed.push('mainline') }
        if (stopped !== undefined) { memory.stopped_at = stopped; changed.push('stopped_at') }
        if (next !== undefined) { memory.next = next.slice(0, 3); changed.push('next') }
        if (redLines !== undefined) { memory.red_lines = redLines; changed.push('red_lines') }
        if (!changed.length) { sendJson(res, 200, { ok: true, changed: false }); return }
        memory.openedAt = stamp
        const saved = saveMemory(memory, { updatedAt: stamp })
        appendAudit(project.key, { action: 'memory.main', summary: changed.join(', ') })
        sendJson(res, 200, { ok: true, changed: changed, memory: publicMemory(saved.memory), agents: saved.agents })
        return
      }
      if (op === 'global') {
        const globals = readGlobals()
        const phrases = normaliseList(input.phrases, MAX_PHRASES, 500)
        if (phrases === INVALID) { sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return }
        if (phrases !== undefined) globals.phrases = phrases
        if (input.tokens && typeof input.tokens === 'object') {
          const clampNum = (value, min, max, fallback) => {
            const number = Number(value)
            return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
          }
          if (input.tokens.radius !== undefined) globals.tokens.radius = clampNum(input.tokens.radius, 6, 20, globals.tokens.radius)
          if (input.tokens.gap !== undefined) globals.tokens.gap = clampNum(input.tokens.gap, 8, 32, globals.tokens.gap)
          if (input.tokens.accent !== undefined) {
            const accent = String(input.tokens.accent || '')
            globals.tokens.accent = /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : ''
          }
        }
        writeGlobals(globals)
        appendAudit(project.key, { action: 'memory.global', summary: `语句 ${globals.phrases.length} 条 · 令牌已更新` })
        sendJson(res, 200, { ok: true, globals })
        return
      }
      if (op === 'close') {
        const next = normaliseList(input.next, 3, 500)
        const outcome = normaliseText(input.outcome, 20)
        const decision = normaliseText(input.decision, 4000)
        const title = normaliseText(input.title, 90)
        const runId = normaliseText(input.runId, 80)
        if ([next, outcome, decision, title, runId].includes(INVALID)) {
          sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return
        }
        if (!Array.isArray(next) || !next.length) {
          sendJson(res, 400, { ok: false, error: 'next 不能为空：收工必须说清下次的第一步' }); return
        }
        if (outcome && !OUTCOME_COLOURS.includes(outcome)) {
          sendJson(res, 400, { ok: false, error: 'outcome 只能是 green / yellow / red' }); return
        }
        if (outcome === 'red' && !decision) {
          sendJson(res, 400, { ok: false, error: '红必须写原因：收工时 decision 就是原因' }); return
        }
        const memory = { ...project.memory }
        memory.next = next.slice(0, 3)
        memory.closedAt = stamp
        if (outcome) memory.outcome = outcome
        if (runId) memory.basis = { runId }
        if (decision) appendDecision(memory, { text: decision, title: title || '' })
        const saved = saveMemory(memory, { updatedAt: stamp })
        if (runId && outcome) {
          const runs = readRuns(project.key)
          const run = runs.find(item => item.runId === runId)
          if (run) {
            run.colour = outcome
            run.updatedAt = Date.now()
            writeRuns(project.key, runs)
          }
        }
        appendAudit(project.key, { action: 'memory.close', summary: (outcome || 'no-outcome') + ' ' + String(next[0] || '').slice(0, 80) })
        sendJson(res, 200, {
          ok: true,
          closedAt: stamp,
          memory: publicMemory(saved.memory),
          agents: saved.agents,
          gap: memoryGap(saved.memory),
        })
        return
      }
      sendJson(res, 400, { ok: false, error: 'op 必须是 main / global / close' })
    },
  }))

  // 4. method library ----------------------------------------------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-workbench/api/method',
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const input = await readBody(res, req)
      if (!input) return
      const op = cleanText(input.op, 20)
      const project = input.key ? resolveProjectArg(String(input.key)) : activeProject()
      if (!project.ok) { sendJson(res, 503, { ok: false, error: project.error || '项目不可用' }); return }
      const methods = readMethods(project.key)
      if (op === 'save') {
        const id = cleanText(input.id, 80)
        const existing = id ? methods.find(item => item.id === id) : null
        if (id && !existing) { sendJson(res, 404, { ok: false, error: '没有这个方法' }); return }
        if (existing && existing.owner === 'builtin') {
          sendJson(res, 409, { ok: false, error: '内置方法不可修改：复制一份再改' }); return
        }
        const method = normaliseMethod(input, existing)
        const next = existing ? methods.map(item => (item.id === method.id ? method : item)) : methods.concat([method])
        writeMethods(project.key, next)
        appendAudit(project.key, {
          action: existing ? 'method.update' : 'method.create',
          summary: method.name + ' · ' + (METHOD_KINDS[method.kind]?.label || method.kind) + (existing ? '（所有实例同步更新）' : ''),
        })
        sendJson(res, 200, { ok: true, method, canvas: canvasPayload(project) })
        return
      }
      if (op === 'delete') {
        const id = cleanText(input.id, 80)
        const existing = methods.find(item => item.id === id)
        if (!existing) { sendJson(res, 404, { ok: false, error: '没有这个方法' }); return }
        if (existing.owner === 'builtin') { sendJson(res, 409, { ok: false, error: '内置方法不可删除' }); return }
        const canvas = readCanvas(project.key)
        if (canvas.nodes.some(node => node.methodId === id)) {
          sendJson(res, 409, { ok: false, error: '画布上还有这个方法的节点，先删节点' }); return
        }
        writeMethods(project.key, methods.filter(item => item.id !== id))
        appendAudit(project.key, { action: 'method.delete', summary: existing.name })
        sendJson(res, 200, { ok: true, canvas: canvasPayload(project) })
        return
      }
      sendJson(res, 400, { ok: false, error: 'op 必须是 save / delete' })
    },
  }))

  // 5. canvas: nodes / edges / view --------------------------------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-workbench/api/canvas',
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const input = await readBody(res, req)
      if (!input) return
      const op = cleanText(input.op, 20)
      const project = input.key ? resolveProjectArg(String(input.key)) : activeProject()
      if (!project.ok) { sendJson(res, 503, { ok: false, error: project.error || '项目不可用' }); return }
      const key = project.key
      const methods = readMethods(key)
      const canvas = readCanvas(key)
      const stamp = new Date().toISOString()

      if (op === 'node.add') {
        if (canvas.nodes.length >= MAX_NODES) { sendJson(res, 409, { ok: false, error: '节点数已达上限 ' + MAX_NODES }); return }
        const methodId = cleanText(input.methodId, 80)
        const method = methodById(methods, methodId)
        if (!method) { sendJson(res, 404, { ok: false, error: '方法库里没有这个方法' }); return }
        const loop = Math.max(1, ...canvas.nodes.map(node => Number(node.loop) || 1))
        const node = {
          id: newId('n'),
          methodId,
          params: input.params && typeof input.params === 'object' ? { ...input.params } : {},
          loop,
          createdAt: stamp,
        }
        canvas.nodes.push(node)
        const validation = validateCanvas(canvas, methods)
        if (!validation.ok) {
          const fatal = validation.issues.filter(issue => issue.nodeId === node.id)
          if (fatal.length) { sendJson(res, 409, { ok: false, code: 'node-rejected', issues: fatal }); return }
        }
        const view = readCanvasView(key)
        const depthOf = graphDepth(canvas)
        view.positions[node.id] = layoutPosition(depthOf(node.id), loop)
        writeCanvasView(key, view)
        writeCanvas(key, canvas)
        appendAudit(key, { action: 'canvas.node.add', summary: method.name })
        sendJson(res, 200, { ok: true, canvas: canvasPayload(project) })
        return
      }
      if (op === 'node.set') {
        const id = cleanText(input.id, 80)
        const node = canvas.nodes.find(item => item.id === id)
        if (!node) { sendJson(res, 404, { ok: false, error: '没有这个节点' }); return }
        if (input.params !== undefined) {
          if (!input.params || typeof input.params !== 'object') { sendJson(res, 400, { ok: false, error: 'params 必须是对象' }); return }
          const method = methodById(methods, node.methodId)
          const kind = method?.executor?.kind || ''
          const params = { ...(node.params || {}) }
          if (input.params.content !== undefined) {
            const content = normaliseText(input.params.content, 12000)
            if (content === INVALID) { sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return }
            params.content = content
          }
          if (input.params.template !== undefined && kind === 'text') {
            const template = normaliseText(input.params.template, 4000)
            if (template === INVALID) { sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return }
            params.template = template
          }
          node.params = params
        }
        writeCanvas(key, canvas)
        appendAudit(key, { action: 'canvas.node.set', summary: id })
        sendJson(res, 200, { ok: true, canvas: canvasPayload(project) })
        return
      }
      if (op === 'node.delete') {
        const id = cleanText(input.id, 80)
        const node = canvas.nodes.find(item => item.id === id)
        if (!node) { sendJson(res, 404, { ok: false, error: '没有这个节点' }); return }
        canvas.nodes = canvas.nodes.filter(item => item.id !== id)
        canvas.edges = canvas.edges.filter(edge => edge?.from?.node !== id && edge?.to?.node !== id)
        delete canvas.state[id]
        writeCanvas(key, canvas)
        appendAudit(key, { action: 'canvas.node.delete', summary: id })
        sendJson(res, 200, { ok: true, canvas: canvasPayload(project) })
        return
      }
      if (op === 'edge.add') {
        if (canvas.edges.length >= MAX_EDGES) { sendJson(res, 409, { ok: false, error: '边数已达上限 ' + MAX_EDGES }); return }
        const fromNode = cleanText(input.fromNode, 80)
        const fromPort = cleanText(input.fromPort, 40)
        const toNode = cleanText(input.toNode, 80)
        const toPort = cleanText(input.toPort, 40)
        if (!fromNode || !fromPort || !toNode || !toPort) {
          sendJson(res, 400, { ok: false, error: '一条边需要 fromNode/fromPort/toNode/toPort' }); return
        }
        const edge = {
          id: 'e_' + createHash('sha256').update(fromNode + '>' + fromPort + '|' + toNode + '|' + toPort).digest('hex').slice(0, 8),
          from: { node: fromNode, port: fromPort },
          to: { node: toNode, port: toPort },
        }
        const candidate = { ...canvas, edges: canvas.edges.concat([edge]) }
        const before = validateCanvas(canvas, methods)
        const validation = validateCanvas(candidate, methods)
        const keyOf = issue => [issue.code, issue.edgeId || '', issue.nodeId || '', issue.message || ''].join('|')
        const known = new Set(before.issues.map(keyOf))
        const introduced = validation.issues.filter(issue => !known.has(keyOf(issue)))
        if (introduced.length) {
          sendJson(res, 409, { ok: false, code: 'edge-rejected', issues: introduced, edge }); return
        }
        writeCanvas(key, candidate)
        appendAudit(key, { action: 'canvas.edge.add', summary: fromNode + '.' + fromPort + ' → ' + toNode + '.' + toPort })
        sendJson(res, 200, { ok: true, canvas: canvasPayload(project) })
        return
      }
      if (op === 'edge.delete') {
        const id = cleanText(input.id, 80)
        if (!canvas.edges.some(edge => edge.id === id)) { sendJson(res, 404, { ok: false, error: '没有这条边' }); return }
        canvas.edges = canvas.edges.filter(edge => edge.id !== id)
        writeCanvas(key, canvas)
        appendAudit(key, { action: 'canvas.edge.delete', summary: id })
        sendJson(res, 200, { ok: true, canvas: canvasPayload(project) })
        return
      }
      if (op === 'view') {
        const view = readCanvasView(key)
        const known = new Set(canvas.nodes.map(node => node.id))
        if (input.arrange === true) {
          const depthOf = graphDepth(canvas)
          const positions = {}
          for (const node of canvas.nodes) positions[node.id] = layoutPosition(depthOf(node.id), Number(node.loop) || 1)
          view.positions = positions
        } else if (input.positions && typeof input.positions === 'object') {
          for (const [id, point] of Object.entries(input.positions).slice(0, MAX_NODES)) {
            if (!known.has(id)) { sendJson(res, 409, { ok: false, code: 'unknown-node', error: '画布上没有节点 ' + id }); return }
            view.positions[id] = { x: clampViewNumber(point?.x, 0, 4000, 0), y: clampViewNumber(point?.y, 0, 4000, 0) }
          }
        }
        for (const id of Object.keys(view.positions)) if (!known.has(id)) delete view.positions[id]
        if (input.zoom !== undefined) view.zoom = clampViewNumber(input.zoom, MIN_ZOOM, MAX_ZOOM, view.zoom)
        writeCanvasView(key, view)
        appendAudit(key, { action: 'canvas.view', summary: (input.arrange === true ? '整理画布' : Object.keys(view.positions).length + ' 个位置') + ' · 缩放 ' + view.zoom })
        sendJson(res, 200, { ok: true, canvas: canvasPayload(project) })
        return
      }
      sendJson(res, 400, { ok: false, error: 'op 必须是 node.add / node.set / node.delete / edge.add / edge.delete / view' })
    },
  }))

  // 6. run: 跑循环 / 取消 / 重验 ------------------------------------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-workbench/api/run',
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const input = await readBody(res, req)
      if (!input) return
      const op = cleanText(input.op, 20) || 'run'
      const project = input.key ? resolveProjectArg(String(input.key)) : activeProject()
      if (!project.ok) { sendJson(res, 503, { ok: false, error: project.error || '项目不可用' }); return }
      if (op === 'run') {
        if (input.confirm !== true) {
          sendJson(res, 400, { ok: false, error: '需要确认：带 confirm:true 才会真跑循环' }); return
        }
        const result = runLoop(project)
        if (!result.ok) {
          sendJson(res, result.code === 'empty-input' ? 400 : 409, { ok: false, code: result.code, validation: result.validation || null })
          return
        }
        sendJson(res, 200, { ok: true, run: { ...result.run, output: String(result.run.output || '').slice(0, 8000) }, canvas: result.canvas })
        return
      }
      if (op === 'cancel') {
        const runId = cleanText(input.runId, 80)
        const runs = readRuns(project.key)
        const run = runs.find(item => item.runId === runId)
        if (!run) { sendJson(res, 404, { ok: false, error: '没有这个循环记录' }); return }
        if (run.status !== 'running') { sendJson(res, 409, { ok: false, error: '循环已结束，不假装取消' }); return }
        run.status = 'cancelled'
        run.endedAt = Date.now()
        writeRuns(project.key, runs)
        appendAudit(project.key, { action: 'run.cancel', requestId: runId, summary: run.goal })
        sendJson(res, 200, { ok: true, run })
        return
      }
      if (op === 'reverify') {
        const result = reverifyCanvas(project)
        sendJson(res, 200, { ok: true, results: result.results, canvas: result.canvas })
        return
      }
      sendJson(res, 400, { ok: false, error: 'op 必须是 run / cancel / reverify' })
    },
  }))

  // 7. outcome: 一跑一色，红必须写原因 ------------------------------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-workbench/api/outcome',
    handler: async (req, res) => {
      if (!guard(req, res, 'POST')) return
      const input = await readBody(res, req)
      if (!input) return
      const project = input.key ? resolveProjectArg(String(input.key)) : activeProject()
      if (!project.ok) { sendJson(res, 503, { ok: false, error: project.error || '项目不可用' }); return }
      const runId = normaliseText(input.runId, 80)
      const colour = normaliseText(input.colour, 20)
      const reason = normaliseText(input.reason, 500)
      if ([runId, colour, reason].includes(INVALID)) {
        sendJson(res, 400, { ok: false, error: '字段类型或长度不合法' }); return
      }
      if (!runId) { sendJson(res, 400, { ok: false, error: '记录结论需要 runId' }); return }
      if (!OUTCOME_COLOURS.includes(colour)) {
        sendJson(res, 400, { ok: false, error: 'colour 只能是 green / yellow / red' }); return
      }
      if (colour === 'red' && !reason) {
        sendJson(res, 400, { ok: false, error: '红必须写原因：没有原因的失败教不会下一轮' }); return
      }
      const runs = readRuns(project.key)
      const run = runs.find(item => item.runId === runId)
      if (!run) { sendJson(res, 404, { ok: false, error: '没有这个循环记录' }); return }
      run.colour = colour
      run.colourReason = reason || ''
      run.updatedAt = Date.now()
      writeRuns(project.key, runs)
      appendAudit(project.key, { action: 'outcome.record', requestId: runId, summary: colour + (reason ? ' · ' + reason.slice(0, 60) : '') })
      sendJson(res, 200, { ok: true, run: { runId, colour, colourReason: reason || '' } })
    },
  }))

  // 8. models: read-only catalog + derived health -------------------------------
  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-workbench/api/models',
    handler: async (req, res) => {
      if (!guard(req, res, 'GET')) return
      const catalog = await modelCatalogPayload(ctx)
      const project = activeProject()
      sendJson(res, 200, { ok: true, ...catalog, health: project.ok ? modelHealth(project.key) : {} })
    },
  }))

  // agent tools: exactly three, per-project ------------------------------------
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
          const archiveMark = item.archived ? '（已归档）' : ''
          return `${mark} ${item.name} · ${item.root} ${archiveMark}`
        })
        return { text: lines.join('\n') + '\n* = 当前激活项目' }
      }
      if (section === 'decisions') {
        const text = readSafe(projectPaths(project.key).decisions)
        return { text: text.trim() || '(这个项目还没有判例)' }
      }
      const gap = memoryGap(project.memory)
      const lines = []
      lines.push(`项目：${project.memory.name} · ${project.memory.root}`)
      lines.push(`主线：${project.memory.mainline || '（未填）'}`)
      lines.push(`停在哪：${project.memory.stopped_at || '（未填）'}`)
      lines.push(`下一步：${project.memory.next.length ? project.memory.next.join('；') : '（未填）'}`)
      lines.push(`红线：${project.memory.red_lines.length ? project.memory.red_lines.join('；') : '（未填）'}`)
      lines.push(`上次收工：${project.memory.closedAt ? project.memory.closedAt.slice(0, 16) + '（' + (project.memory.outcome || '未记录') + '）' : '无记录'}${project.memory.basis?.runId ? ' · ' + project.memory.basis.runId : ''}`)
      if (gap.open) lines.push(`缺口：未收工${gap.finishedAfterClose ? '（其后 ' + gap.finishedAfterClose + ' 轮循环已完成）' : ''}`)
      return { text: lines.join('\n') }
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
      if ([mainline, stopped, next, redLines].includes(INVALID)) {
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
      appendAudit(resolved.key, { action: 'memory.set', requestId: resolved.key, summary: changed.join(', ') })
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
        outcome: { type: 'string', enum: ['green', 'yellow', 'red'], description: '可选：本轮结论颜色。green 必须校验器过且产物在盘；没验证就留空。' },
        runId: { type: 'string', description: '可选：本轮对应的循环 runId。' },
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
      const decision = normaliseText(a.decision, 4000)
      const title = normaliseText(a.title, 90)
      if ([outcome, runId, decision, title].includes(INVALID)) {
        return { text: '收工失败：字段类型或长度不合法。' }
      }
      if (outcome && !OUTCOME_COLOURS.includes(outcome)) return { text: '收工失败：outcome 只能是 green / yellow / red。' }
      if (outcome === 'red' && !decision) return { text: '收工失败：红必须写原因（decision）。' }
      memory.next = next.slice(0, 3)
      memory.closedAt = stamp
      if (outcome) memory.outcome = outcome
      if (runId) memory.basis = { runId }
      if (decision) appendDecision(memory, { text: decision, title: title || '' })
      const saved = saveMemory(memory, { updatedAt: stamp })
      if (runId && outcome) {
        const runs = readRuns(resolved.key)
        const run = runs.find(item => item.runId === runId)
        if (run) {
          run.colour = outcome
          run.updatedAt = Date.now()
          writeRuns(resolved.key, runs)
        }
      }
      appendAudit(resolved.key, { action: 'memory.close', requestId: resolved.key, summary: (outcome || 'no-outcome') + ' ' + next[0].slice(0, 80) })
      const gap = memoryGap(saved.memory)
      const official = outcome || '未记录（green 需要校验器过且产物在盘）'
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
