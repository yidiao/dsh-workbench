window.__ModuleLoader__.load({
  id: 'dsh-workbench',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // The client is deliberately read-only. Form interactions below only build a
    // local preview; they never call a model, mutate a conversation, or POST data.
    const en = {
      title: 'Workbench', subtitle: 'A persistent control room for long-running work.',
      eyebrow: 'PROJECT CONTINUITY', workspace: 'Workspace', readOnly: 'READ ONLY',
      previewOnly: 'Preview only · no model run · no host write', refresh: 'Refresh',
      loading: 'Loading workbench…', error: 'Could not read workbench files.', retry: 'Try again',
      command: 'Command center', commandHint: 'Compose the next move locally, then review before any external action.',
      goal: 'Goal', goalPlaceholder: 'What outcome should this work produce?',
      plan: 'Plan', planPlaceholder: 'Outline the smallest useful next steps…',
      instruction: 'Instruction', instructionPlaceholder: 'Draft an instruction for a future run…',
      model: 'Model', modelPlaceholder: 'Draft only — do not run', modelsUnavailable: 'Model catalog unavailable in this profile; the choice is recorded locally only.',
      preview: 'Build preview', clear: 'Clear', previewReady: 'Local preview ready',
      previewHint: 'Nothing is sent. This form only prepares a handoff for review.',
      memoryPreview: 'Memory preview', memoryPreviewEntry: 'Open memory preview', closePreview: 'Close preview',
      memorySummary: 'Memory summary', memorySource: 'Source memory / state files',
      continuity: 'Continuity status', mainline: 'Current line', stopped: 'Last checkpoint',
      next: 'Next actions', redlines: 'Guardrails', tasks: 'Task queue',
      ledger: 'Ledger snapshot', decisions: 'Recent decisions', noData: 'No data yet',
      noTasks: 'No active tasks.', noDecisions: 'No decisions recorded yet.',
      tokens: 'Tokens', green: 'Green cards', rework: 'Calls completed', updated: 'Updated',
      source: 'Live workspace files', ledgerRecent: 'Recent runs', status: 'Status',
      unknown: 'Unknown', previewModel: 'Selected model', previewGoal: 'Goal',
      previewPlan: 'Plan', previewInstruction: 'Instruction', noInstruction: '(not provided)',
      notSet: '(not set)', emptyPlan: '(no plan provided)', memoryEmpty: 'No memory summary available yet.',
      taskStatus: 'status', taskGoal: 'goal', safe: 'Safe local action',
      edit: 'Edit', save: 'Save', cancel: 'Cancel', saving: 'Saving…', saveFailed: 'Save failed.',
      editHint: 'Writes this workbench’s state.json only; every save is recorded in the audit trail.',
      addDecision: 'Append decision', decisionPlaceholder: 'What was decided, why, and what it costs…',
      decisionSaved: 'Decision appended.', decisionFailed: 'Could not append the decision.',
      audit: 'Audit trail', auditEmpty: 'No audit entries yet.',
    }
    const zh = {
      title: '工作台', subtitle: '跨会话持续工作的控制台。',
      eyebrow: '项目接续', workspace: '工作区', readOnly: '只读',
      previewOnly: '仅预览 · 不执行模型 · 不写母站', refresh: '刷新',
      loading: '正在读取工作台…', error: '无法读取工作台文件。', retry: '重试',
      command: '指挥台', commandHint: '在本地整理下一步，确认后再决定是否交给外部执行。',
      goal: '目标', goalPlaceholder: '这次工作要产出什么结果？',
      plan: '计划', planPlaceholder: '列出最小可行的下一步…',
      instruction: '指令', instructionPlaceholder: '为未来的一次执行起草指令…',
      model: '模型', modelPlaceholder: '仅草稿——不执行模型', modelsUnavailable: '当前 profile 没有可用的模型目录；这里只记录选择，不会执行。',
      preview: '生成预览', clear: '清空', previewReady: '本地预览已生成',
      previewHint: '内容不会发送；表单只负责准备一份待审阅的接续草稿。',
      memoryPreview: '记忆预览', memoryPreviewEntry: '打开记忆预览', closePreview: '关闭预览',
      memorySummary: '记忆摘要', memorySource: '来源：记忆 / 状态文件',
      continuity: '接续状态', mainline: '当前主线', stopped: '上次停在',
      next: '下一步', redlines: '红线', tasks: '任务队列',
      ledger: '账本快照', decisions: '近期决策', noData: '暂无数据',
      noTasks: '暂无进行中的任务。', noDecisions: '还没有记录决策。',
      tokens: 'Token', green: '绿卡数', rework: '已完成 / 总调用', updated: '更新时间',
      source: '实时工作区文件', ledgerRecent: '最近运行', status: '状态',
      unknown: '未知', previewModel: '所选模型', previewGoal: '目标',
      previewPlan: '计划', previewInstruction: '指令', noInstruction: '（未提供）',
      notSet: '（未设置）', emptyPlan: '（未提供计划）', memoryEmpty: '暂时没有记忆摘要。',
      taskStatus: '状态', taskGoal: '目标', safe: '安全的本地操作',
      edit: '编辑', save: '保存', cancel: '取消', saving: '保存中…', saveFailed: '保存失败。',
      editHint: '只写入本工作区的 state.json；每次保存都会记入审计记录。',
      addDecision: '追加决策', decisionPlaceholder: '决定了什么、为什么、代价是什么…',
      decisionSaved: '决策已追加。', decisionFailed: '决策追加失败。',
      audit: '审计记录', auditEmpty: '还没有审计记录。',
    }

    const CSS = `
      .wb-page{box-sizing:border-box;height:100%;overflow-y:auto;overflow-x:hidden;padding:24px clamp(16px,4vw,56px) 56px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit}
      .wb-wrap{max-width:1180px;margin:0 auto}
      .wb-topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:12px 16px;margin-bottom:22px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}
      .wb-brand{display:flex;align-items:center;gap:12px;min-width:0}
      .wb-brand-mark{width:32px;height:32px;display:grid;place-items:center;border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent);color:var(--dsw-alias-brand-primary);font-weight:800;font-size:15px}
      .wb-brand-copy{min-width:0}.wb-brand-name{font-size:14px;font-weight:750;line-height:1.3}.wb-brand-meta{margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .wb-top-actions,.wb-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}
      .wb-badge{border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:5px 9px;color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      .wb-safe{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,var(--dsw-alias-border-l1));letter-spacing:0;text-transform:none}
      .wb-button{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:8px 12px;font:inherit;font-size:12px;cursor:pointer;transition:border-color .15s ease,background .15s ease}
      .wb-button:hover{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,var(--dsw-alias-bg-layer-1))}.wb-button:disabled{opacity:.55;cursor:wait}
      .wb-button-primary{border-color:var(--dsw-alias-button-primary-fill,#356be8);background:var(--dsw-alias-button-primary-fill,#356be8);color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:700}.wb-button-primary:hover{border-color:var(--dsw-alias-button-primary-fill,#356be8);background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-button-primary-fill,#356be8));filter:brightness(1.04)}
      .wb-intro{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin:0 2px 20px}.wb-kicker{font-size:10px;font-weight:750;letter-spacing:.18em;color:var(--dsw-alias-brand-primary);text-transform:uppercase}.wb-title{margin:6px 0 3px;font-size:clamp(25px,3.6vw,36px);line-height:1.12;letter-spacing:-.035em;font-weight:750}.wb-subtitle{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px}
      .wb-card{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);padding:18px 20px;box-shadow:0 4px 18px color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent)}
      .wb-card h2{margin:0 0 13px;font-size:12px;font-weight:750;letter-spacing:.04em;color:var(--dsw-alias-label-secondary)}.wb-card-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:13px}.wb-card-heading h2{margin:0}
      .wb-command{padding:20px 22px;margin-bottom:16px}.wb-command-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:16px}.wb-command-title{margin:0;font-size:17px;font-weight:750}.wb-command-hint{margin:5px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45}
      .wb-form{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}.wb-field{display:flex;flex-direction:column;gap:6px;min-width:0}.wb-field-goal{grid-column:span 6}.wb-field-model{grid-column:span 6}.wb-field-plan,.wb-field-instruction{grid-column:span 6}.wb-field label{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary)}.wb-field input,.wb-field textarea,.wb-field select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:9px 10px;font:inherit;font-size:12px;outline:none}.wb-field textarea{min-height:76px;resize:vertical;line-height:1.45}.wb-field input:focus,.wb-field textarea:focus,.wb-field select:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent)}.wb-form-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:2px}.wb-form-actions-right{display:flex;gap:8px;align-items:center}.wb-form-note{color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-preview{margin-top:15px;padding:14px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,var(--dsw-alias-border-l1));border-radius:11px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,var(--dsw-alias-bg-layer-1))}.wb-preview-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;color:var(--dsw-alias-brand-primary);font-size:12px;font-weight:750}.wb-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px}.wb-preview-item{min-width:0}.wb-preview-item strong{display:block;margin-bottom:3px;color:var(--dsw-alias-label-secondary);font-size:10px}.wb-preview-item span{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.45}
      .wb-memory-preview{margin-top:15px;padding:14px;border-radius:11px;background:var(--dsw-alias-bg-layer-2)}.wb-memory-preview pre{max-height:230px;margin:9px 0 0;overflow:auto;white-space:pre-wrap;word-break:break-word;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-secondary)}
      .wb-status{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(130px,.7fr));gap:10px;margin-bottom:16px}.wb-status-main{padding:18px 20px;position:relative;overflow:hidden}.wb-status-main:after{content:'';position:absolute;inset:0 auto 0 0;width:3px;background:var(--dsw-alias-brand-primary)}.wb-status-main h2{margin-bottom:9px}.wb-mainline{font-size:clamp(17px,2.2vw,23px);line-height:1.4;font-weight:700;letter-spacing:-.02em}.wb-stopped{margin-top:12px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.55}.wb-status-mini{padding:15px}.wb-status-label{display:block;margin-bottom:7px;color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700}.wb-status-value{font-size:13px;line-height:1.5}.wb-status-list{margin:0;padding-left:16px}.wb-status-list li{margin:3px 0;font-size:12px;line-height:1.4}
      .wb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.wb-wide{grid-column:1/-1}.wb-list{list-style:none;padding:0;margin:0;display:grid;gap:9px}.wb-list li{display:flex;gap:9px;align-items:flex-start;font-size:12px;line-height:1.5}.wb-num{flex:0 0 20px;height:20px;display:grid;place-items:center;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary);font-size:10px;font-weight:750}.wb-guard{display:flex;gap:8px;align-items:flex-start;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.5}.wb-guard:before{content:'•';color:var(--dsw-alias-state-warn-primary);font-weight:800}.wb-task{display:block;padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}.wb-task:last-child{border-bottom:0}.wb-task-line{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.wb-task-id{color:var(--dsw-alias-brand-primary);font:700 11px ui-monospace,SFMono-Regular,Consolas,monospace}.wb-task-status{color:var(--dsw-alias-label-secondary);font-size:10px}.wb-task-goal{margin-top:4px;font-size:12px;line-height:1.45}.wb-task-meta{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:10px}.wb-decisions{max-height:270px;overflow:auto;white-space:pre-wrap;font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-secondary)}.wb-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.wb-metric{border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:11px}.wb-metric strong{display:block;font-size:19px;line-height:1.2;font-weight:750}.wb-metric span{display:block;margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:10px}.wb-empty,.wb-error{padding:24px 15px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px}.wb-error{color:var(--dsw-alias-state-error-primary)}.wb-ledger-runs{margin-top:15px}.wb-ledger-runs h2{margin-bottom:9px}.wb-foot{display:flex;justify-content:space-between;gap:12px;margin-top:17px;color:var(--dsw-alias-label-secondary);font-size:10px}.wb-source{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wb-edit-grid{display:grid;gap:9px;margin-top:2px}.wb-edit-grid label{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary)}.wb-edit-grid input,.wb-edit-grid textarea,.wb-decision-form textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 10px;font:inherit;font-size:12px;outline:none}.wb-edit-grid textarea,.wb-decision-form textarea{min-height:64px;resize:vertical;line-height:1.45}.wb-edit-grid input:focus,.wb-edit-grid textarea:focus,.wb-decision-form textarea:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent)}.wb-edit-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:2px}.wb-edit-error{color:var(--dsw-alias-state-error-primary);font-size:11px}.wb-edit-hint{color:var(--dsw-alias-label-secondary);font-size:11px}.wb-decision-form{display:grid;gap:8px;margin-top:11px}.wb-decision-actions{display:flex;justify-content:flex-end;gap:8px}.wb-decision-notice{color:var(--dsw-alias-state-success-primary);font-size:11px}.wb-audit{display:grid;gap:7px;max-height:240px;overflow:auto}.wb-audit-item{display:flex;gap:8px;align-items:baseline;border-bottom:1px dashed var(--dsw-alias-border-l1);padding-bottom:6px;font-size:11px;color:var(--dsw-alias-label-secondary)}.wb-audit-item:last-child{border-bottom:0}.wb-audit-action{flex:0 0 auto;font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-brand-primary)}.wb-audit-time{flex:0 0 auto;font:10px ui-monospace,SFMono-Regular,Consolas,monospace}.wb-audit-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      @media(max-width:880px){.wb-status{grid-template-columns:1fr 1fr}.wb-status-main{grid-column:1/-1}}@media(max-width:680px){.wb-page{padding:18px 13px 35px}.wb-topbar,.wb-intro,.wb-command-head{align-items:flex-start;flex-direction:column}.wb-top-actions,.wb-actions{width:100%;justify-content:space-between}.wb-form{display:flex;flex-direction:column}.wb-grid{grid-template-columns:1fr}.wb-wide{grid-column:auto}.wb-preview-grid{grid-template-columns:1fr}.wb-form-actions{align-items:flex-start;flex-direction:column}.wb-form-actions-right{width:100%;justify-content:flex-end}.wb-status{grid-template-columns:1fr}.wb-status-main{grid-column:auto}.wb-metrics{grid-template-columns:1fr 1fr}}
    `

    function asList(value) {
      if (Array.isArray(value)) return value.filter(Boolean).map(String)
      if (typeof value === 'string') return value.split(/\r?\n|;/).map(x => x.replace(/^[-•\d.)\s]+/, '').trim()).filter(Boolean)
      return []
    }

    function firstValue(...values) {
      return values.find(value => value !== undefined && value !== null && String(value).trim() !== '')
    }

    function displayValue(value, fallback) {
      const found = firstValue(value)
      return found === undefined ? fallback : String(found)
    }

    function memoryText(data, state, t) {
      const explicit = firstValue(data?.memorySummary, data?.memory_summary, state.memorySummary, state.memory_summary, state.memory)
      if (explicit !== undefined) return Array.isArray(explicit) ? explicit.join('\n') : String(explicit)
      const preview = data?.memoryPreview?.memory
      if (preview?.snippets?.length) return preview.snippets.map(item => `[${item.role}] ${item.source}\n${item.text}`).join('\n\n')
      return String(data?.stateText || '').trim() || t('memoryEmpty')
    }

    function WorkbenchPanel({ t }) {
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [goal, setGoal] = React.useState('')
      const [plan, setPlan] = React.useState('')
      const [instruction, setInstruction] = React.useState('')
      const [model, setModel] = React.useState('')
      const [preview, setPreview] = React.useState(null)
      const [memoryOpen, setMemoryOpen] = React.useState(false)
      const [catalog, setCatalog] = React.useState(null)
      const [editOpen, setEditOpen] = React.useState(false)
      const [draft, setDraft] = React.useState({ mainline: '', stopped_at: '', next: '', red_lines: '' })
      const [saving, setSaving] = React.useState(false)
      const [saveError, setSaveError] = React.useState('')
      const [decisionDraft, setDecisionDraft] = React.useState('')
      const [decisionBusy, setDecisionBusy] = React.useState(false)
      const [decisionNotice, setDecisionNotice] = React.useState('')
      const [audit, setAudit] = React.useState([])

      const load = React.useCallback(async () => {
        setBusy(true); setError(false)
        try {
          // All three requests are read-only GETs against this plugin's own
          // Host routes. The model catalog and audit list are optional.
          const [response, modelsResponse, auditResponse] = await Promise.all([
            fetch('/dsh-workbench/api/state-v2', { cache: 'no-store', credentials: 'same-origin' }),
            fetch('/dsh-workbench/api/models', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
            fetch('/dsh-workbench/api/audit?limit=30', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
          ])
          if (!response.ok) throw new Error('HTTP ' + response.status)
          const next = await response.json()
          if (!next || next.ok !== true) throw new Error('invalid response')
          setData(next)
          if (modelsResponse && modelsResponse.ok) {
            try {
              const models = await modelsResponse.json()
              if (models && models.ok === true) {
                setCatalog(models)
                if (models.current?.provider && models.current?.model) {
                  const current = models.current.provider + '/' + models.current.model
                  setModel(prev => prev || current)
                }
              }
            } catch { /* keep previous catalog */ }
          }
          if (auditResponse && auditResponse.ok) {
            try {
              const auditPayload = await auditResponse.json()
              if (auditPayload && Array.isArray(auditPayload.entries)) setAudit(auditPayload.entries)
            } catch { /* keep previous audit */ }
          }
          const state = next.state || {}
          setGoal(String(firstValue(state.goal, state.mainline) || ''))
          setPlan(asList(state.next).join('\n'))
        } catch { setError(true) } finally { setBusy(false) }
      }, [])
      React.useEffect(() => { load() }, [load])

      async function postJson(path, body) {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        })
        let payload = null
        try { payload = await response.json() } catch { /* non-JSON error */ }
        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error(payload?.error || ('HTTP ' + response.status))
        }
        return payload
      }

      const state = data?.state || {}
      const next = asList(state.next)
      const redlines = asList(state.red_lines || state.redLines)
      const tasks = Array.isArray(data?.tasks) ? data.tasks : []
      const ledger = data?.ledger || {}
      const tokens = firstValue(ledger.totalTokens, ledger.total_tokens, ledger.tokens, '—')
      const green = firstValue(ledger.greenCards, ledger.green_cards, ledger.green, ledger.completed, '—')
      const rework = firstValue(ledger.reworkRate, ledger.rework_rate, ledger.rework, ledger.calls ? `${ledger.completed ?? 0}/${ledger.calls}` : undefined, '—')
      const recentRuns = Array.isArray(ledger.rows) ? ledger.rows.slice(-4).reverse() : []
      const decisions = String(data?.decisions || '').trim()
      const memory = memoryText(data, state, t)

      function makePreview(event) {
        event?.preventDefault?.()
        setPreview({ goal: goal.trim(), plan: plan.trim(), instruction: instruction.trim(), model })
      }

      function clearForm() {
        setGoal(''); setPlan(''); setInstruction(''); setPreview(null)
      }

      function openEdit() {
        setDraft({
          mainline: String(firstValue(state.mainline) || ''),
          stopped_at: String(firstValue(state.stopped_at, state.stoppedAt, '') || ''),
          next: next.join('\n'),
          red_lines: redlines.join('\n'),
        })
        setSaveError('')
        setEditOpen(true)
      }

      async function saveState(event) {
        event?.preventDefault?.()
        setSaving(true); setSaveError('')
        try {
          await postJson('/dsh-workbench/api/state-edit', {
            mainline: draft.mainline,
            stopped_at: draft.stopped_at,
            next: draft.next,
            red_lines: draft.red_lines,
            requestId: 'panel-' + Date.now(),
          })
          setEditOpen(false)
          await load()
        } catch (error) {
          setSaveError(String(error?.message || t('saveFailed')))
        } finally {
          setSaving(false)
        }
      }

      async function addDecision(event) {
        event?.preventDefault?.()
        const text = decisionDraft.trim()
        if (!text) return
        setDecisionBusy(true); setDecisionNotice(''); setSaveError('')
        try {
          await postJson('/dsh-workbench/api/decision-add', { text, requestId: 'panel-' + Date.now() })
          setDecisionDraft('')
          setDecisionNotice(t('decisionSaved'))
          await load()
        } catch (error) {
          setSaveError(String(error?.message || t('decisionFailed')))
        } finally {
          setDecisionBusy(false)
        }
      }

      function taskText(item) {
        if (typeof item !== 'object' || item === null) return { id: '', status: '', goal: String(item), meta: '' }
        return {
          id: firstValue(item.id, item.name, ''),
          status: firstValue(item.status, ''),
          goal: firstValue(item.goal, item.title, item.deliverable, item.text, t('notSet')),
          meta: [item.tier, item.model].filter(Boolean).join(' · '),
        }
      }

      function auditSummary(entry) {
        if (entry?.summary) return String(entry.summary)
        if (entry?.changes && typeof entry.changes === 'object') return Object.keys(entry.changes).join(', ')
        return ''
      }

      const topbar = h('header', { className: 'wb-topbar' },
        h('div', { className: 'wb-brand' },
          h('div', { className: 'wb-brand-mark', 'aria-hidden': true }, 'W'),
          h('div', { className: 'wb-brand-copy' },
            h('div', { className: 'wb-brand-name' }, t('workspace')),
            h('div', { className: 'wb-brand-meta' }, t('subtitle')))),
        h('div', { className: 'wb-top-actions' },
          h('span', { className: 'wb-badge' }, t('readOnly')),
          h('span', { className: 'wb-badge wb-safe' }, t('previewOnly')),
          h('button', { className: 'wb-button', type: 'button', onClick: load, disabled: busy }, busy ? t('loading') : t('refresh'))))

      const intro = h('div', { className: 'wb-intro' },
        h('div', null,
          h('div', { className: 'wb-kicker' }, t('eyebrow')),
          h('h1', { className: 'wb-title' }, t('title')),
          h('p', { className: 'wb-subtitle' }, t('subtitle'))))

      const commandCard = h('section', { className: 'wb-card wb-command', 'aria-labelledby': 'wb-command-title' },
        h('div', { className: 'wb-command-head' },
          h('div', null,
            h('h2', { className: 'wb-command-title', id: 'wb-command-title' }, t('command')),
            h('p', { className: 'wb-command-hint' }, t('commandHint'))),
          h('button', { className: 'wb-button', type: 'button', onClick: () => setMemoryOpen(!memoryOpen), 'aria-expanded': memoryOpen }, memoryOpen ? t('closePreview') : t('memoryPreviewEntry'))),
        h('form', { className: 'wb-form', onSubmit: makePreview },
          h('div', { className: 'wb-field wb-field-goal' },
            h('label', { htmlFor: 'wb-goal' }, t('goal')),
            h('input', { id: 'wb-goal', value: goal, onChange: event => setGoal(event.target.value), placeholder: t('goalPlaceholder') })),
          h('div', { className: 'wb-field wb-field-model' },
            h('label', { htmlFor: 'wb-model' }, t('model')),
            h('select', { id: 'wb-model', value: model, onChange: event => setModel(event.target.value) },
              h('option', { value: '' }, t('modelPlaceholder')),
              (catalog?.groups || []).map(group => h('optgroup', { key: group.id, label: group.name || group.id },
                (group.models || []).map(item => h('option', { key: group.id + '/' + item.id, value: group.id + '/' + item.id }, item.name || item.id))))),
            catalog && catalog.available === false && h('span', { className: 'wb-form-note' }, t('modelsUnavailable'))),
          h('div', { className: 'wb-field wb-field-plan' },
            h('label', { htmlFor: 'wb-plan' }, t('plan')),
            h('textarea', { id: 'wb-plan', value: plan, onChange: event => setPlan(event.target.value), placeholder: t('planPlaceholder') })),
          h('div', { className: 'wb-field wb-field-instruction' },
            h('label', { htmlFor: 'wb-instruction' }, t('instruction')),
            h('textarea', { id: 'wb-instruction', value: instruction, onChange: event => setInstruction(event.target.value), placeholder: t('instructionPlaceholder') })),
          h('div', { className: 'wb-form-actions' },
            h('span', { className: 'wb-form-note' }, t('previewHint')),
            h('div', { className: 'wb-form-actions-right' },
              h('button', { className: 'wb-button', type: 'button', onClick: clearForm }, t('clear')),
              h('button', { className: 'wb-button wb-button-primary', type: 'submit' }, t('preview'))))),
        preview && h('div', { className: 'wb-preview', 'aria-live': 'polite' },
          h('div', { className: 'wb-preview-title' },
            h('span', null, t('previewReady')),
            h('span', { className: 'wb-badge wb-safe' }, t('safe'))),
          h('div', { className: 'wb-preview-grid' },
            h('div', { className: 'wb-preview-item' }, h('strong', null, t('previewGoal')), h('span', null, preview.goal || t('notSet'))),
            h('div', { className: 'wb-preview-item' }, h('strong', null, t('previewModel')), h('span', null, preview.model || t('modelPlaceholder'))),
            h('div', { className: 'wb-preview-item' }, h('strong', null, t('previewPlan')), h('span', null, preview.plan || t('emptyPlan'))),
            h('div', { className: 'wb-preview-item' }, h('strong', null, t('previewInstruction')), h('span', null, preview.instruction || t('noInstruction'))))),
        memoryOpen && h('div', { className: 'wb-memory-preview' },
          h('strong', null, t('memoryPreview')),
          h('pre', null, memory)))

      const continuityRead = h('div', null,
        h('div', { className: 'wb-mainline' }, displayValue(state.mainline, t('noData'))),
        h('div', { className: 'wb-stopped' }, h('strong', null, t('stopped') + ' · '), displayValue(state.stopped_at || state.stoppedAt, t('noData'))),
        h('div', { className: 'wb-status' },
          h('div', { className: 'wb-card wb-status-mini' }, h('span', { className: 'wb-status-label' }, t('next')), next.length ? h('ol', { className: 'wb-status-list' }, next.slice(0, 3).map((item, i) => h('li', { key: i }, item))) : h('div', { className: 'wb-status-value' }, t('noData'))),
          h('div', { className: 'wb-card wb-status-mini' }, h('span', { className: 'wb-status-label' }, t('redlines')), redlines.length ? h('ul', { className: 'wb-status-list' }, redlines.slice(0, 3).map((item, i) => h('li', { key: i }, item))) : h('div', { className: 'wb-status-value' }, t('noData'))),
          h('div', { className: 'wb-card wb-status-mini' }, h('span', { className: 'wb-status-label' }, t('memorySummary')), h('div', { className: 'wb-status-value' }, memory.split(/\r?\n/)[0].slice(0, 120) || t('noData')))))

      const continuityEdit = h('form', { className: 'wb-edit-grid', onSubmit: saveState },
        h('label', { htmlFor: 'wb-edit-mainline' }, t('mainline')),
        h('input', { id: 'wb-edit-mainline', value: draft.mainline, onChange: event => setDraft({ ...draft, mainline: event.target.value }) }),
        h('label', { htmlFor: 'wb-edit-stopped' }, t('stopped')),
        h('input', { id: 'wb-edit-stopped', value: draft.stopped_at, onChange: event => setDraft({ ...draft, stopped_at: event.target.value }) }),
        h('label', { htmlFor: 'wb-edit-next' }, t('next') + '（每行一条）'),
        h('textarea', { id: 'wb-edit-next', value: draft.next, onChange: event => setDraft({ ...draft, next: event.target.value }) }),
        h('label', { htmlFor: 'wb-edit-redlines' }, t('redlines') + '（每行一条）'),
        h('textarea', { id: 'wb-edit-redlines', value: draft.red_lines, onChange: event => setDraft({ ...draft, red_lines: event.target.value }) }),
        saveError && h('div', { className: 'wb-edit-error', role: 'alert' }, saveError),
        h('div', { className: 'wb-edit-hint' }, t('editHint')),
        h('div', { className: 'wb-edit-actions' },
          h('button', { className: 'wb-button', type: 'button', onClick: () => { setEditOpen(false); setSaveError('') } }, t('cancel')),
          h('button', { className: 'wb-button wb-button-primary', type: 'submit', disabled: saving }, saving ? t('saving') : t('save'))))

      const continuityCard = h('section', { className: 'wb-card wb-wide wb-continuity' },
        h('div', { className: 'wb-card-heading' },
          h('h2', null, t('continuity')),
          h('div', { className: 'wb-actions' },
            h('span', { className: 'wb-form-note' }, t('updated') + ': ' + (state.updated || data?.fetchedAt || '—')),
            !editOpen && h('button', { className: 'wb-button', type: 'button', onClick: openEdit }, t('edit')))),
        editOpen ? continuityEdit : continuityRead)

      const memoryCard = h('section', { className: 'wb-card' },
        h('div', { className: 'wb-card-heading' },
          h('h2', null, t('memorySummary')),
          h('span', { className: 'wb-form-note' }, t('memorySource'))),
        h('div', { className: 'wb-decisions' }, memory))

      const tasksCard = h('section', { className: 'wb-card' },
        h('h2', null, t('tasks')),
        tasks.length ? h('div', null, tasks.map((item, i) => {
          const task = taskText(item)
          return h('div', { className: 'wb-task', key: i },
            h('div', { className: 'wb-task-line' },
              h('span', { className: 'wb-task-id' }, task.id || ('T-' + (i + 1))),
              h('span', { className: 'wb-task-status' }, task.status || t('unknown'))),
            h('div', { className: 'wb-task-goal' }, task.goal),
            task.meta && h('div', { className: 'wb-task-meta' }, task.meta))
        })) : h('div', { className: 'wb-empty' }, t('noTasks')))

      const recentRunsView = recentRuns.length
        ? h('div', { className: 'wb-ledger-runs' },
          h('h2', null, t('ledgerRecent')),
          h('ul', { className: 'wb-list' }, recentRuns.map((row, i) => {
            const label = String(row.tier || '') + ' · ' + String(row.model || '') + ' · ' + String(row.total_tokens || 0) + ' tokens · ' + String(row.status || '')
            return h('li', { key: i },
              h('span', { className: 'wb-num' }, String(row.id || '—')),
              h('span', null, label))
          })))
        : null

      const ledgerCard = h('section', { className: 'wb-card' },
        h('h2', null, t('ledger')),
        h('div', { className: 'wb-metrics' },
          h('div', { className: 'wb-metric' }, h('strong', null, String(tokens)), h('span', null, t('tokens'))),
          h('div', { className: 'wb-metric' }, h('strong', null, String(green)), h('span', null, t('green'))),
          h('div', { className: 'wb-metric' }, h('strong', null, String(rework)), h('span', null, t('rework')))),
        recentRunsView)

      const decisionsCard = h('section', { className: 'wb-card' },
        h('h2', null, t('decisions')),
        h('div', { className: 'wb-decisions' }, decisions || t('noDecisions')),
        h('form', { className: 'wb-decision-form', onSubmit: addDecision },
          h('textarea', {
            value: decisionDraft,
            placeholder: t('decisionPlaceholder'),
            'aria-label': t('addDecision'),
            onChange: event => setDecisionDraft(event.target.value),
          }),
          h('div', { className: 'wb-decision-actions' },
            decisionNotice && h('span', { className: 'wb-decision-notice' }, decisionNotice),
            h('button', {
              className: 'wb-button wb-button-primary',
              type: 'submit',
              disabled: decisionBusy || !decisionDraft.trim(),
            }, decisionBusy ? t('saving') : t('addDecision')))))

      const auditCard = h('section', { className: 'wb-card wb-wide' },
        h('h2', null, t('audit')),
        audit.length
          ? h('div', { className: 'wb-audit' }, audit.slice(0, 20).map((entry, i) => h('div', { className: 'wb-audit-item', key: i },
            h('span', { className: 'wb-audit-action' }, entry.action || '—'),
            h('span', { className: 'wb-audit-time' }, String(entry.ts || '').replace('T', ' ').slice(0, 19)),
            h('span', { className: 'wb-audit-summary' }, auditSummary(entry)))))
          : h('div', { className: 'wb-empty' }, t('auditEmpty')))

      let body
      if (error) {
        body = h('section', { className: 'wb-card wb-error', role: 'alert' },
          h('p', null, t('error')),
          h('button', { className: 'wb-button', type: 'button', onClick: load }, t('retry')))
      } else if (!data) {
        body = h('section', { className: 'wb-card wb-empty', 'aria-live': 'polite' }, t('loading'))
      } else {
        body = h('div', { className: 'wb-content' },
          commandCard,
          continuityCard,
          h('div', { className: 'wb-grid' }, memoryCard, tasksCard, ledgerCard, decisionsCard, auditCard),
          h('footer', { className: 'wb-foot' },
            h('span', { className: 'wb-source' }, t('source')),
            h('span', null, t('updated') + ': ' + (data.fetchedAt || '—'))))
      }

      return h('div', { className: 'wb-page' },
        h('style', null, CSS),
        h('div', { className: 'wb-wrap' }, topbar, intro, body))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dshWorkbench', { en, zh }), 'dsh-workbench locales')
        const t = ctx.locale.bind('dshWorkbench')
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'dsh-workbench' }, props => h(WorkbenchPanel, { ...props, t })))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'dsh-workbench', order: 25,
          label: () => t('title'),
        }, ({ size, active }) => h('svg', {
          width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
          'aria-hidden': true, style: { display: 'block', opacity: active ? 1 : .78 },
        },
          h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 3, stroke: 'currentColor', strokeWidth: 1.7 }),
          h('path', { d: 'M7 8h10M7 12h6M7 16h8', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' })))
      )
      return () => {}
    },
  }
}
})
