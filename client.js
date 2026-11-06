window.__ModuleLoader__.load({
  id: 'dsh-workbench',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // Panel information architecture (v0.5):
    //   1. current run  — the answer to "did anything happen?" lives here and is
    //      rebuilt from runs.json on every mount, so it can never vanish.
    //   2. dispatch     — the only place that can start work.
    //   3. continuity   — the long-lived context, compact.
    //   4. everything else (tasks / decisions / audit / metrics) collapsed.
    const en = {
      title: 'Workbench', refresh: 'Refresh', loading: 'Reading…',
      error: 'Could not read workbench files.', retry: 'Try again',
      execOn: 'execution on', execOff: 'execution off',
      runEmpty: 'No dispatch yet. Compose one below.',
      currentRun: 'Current run', runHistory: 'Recent runs',
      running: 'Running', done: 'Done', cancelled: 'Cancelled', failed: 'Failed',
      waiting: 'Waiting for your answer', reply: 'Reply',
      waitingHint: 'The session is parked on a question. Open it in workspace {cwd} to answer — the run continues right after that.',
      noReplyYet: 'No finished reply yet — the session is still working.',
      noReply: 'No reply captured for this run.',
      session: 'session', model: 'model', sessionWorkspace: 'session workspace',
      started: 'started', steps: 'steps', toolCalls: 'tool calls',
      cancelRun: 'Cancel run', unknown: 'unknown', notSet: '—',
      compose: 'Dispatch', composeHint: 'Compose, preview, then run. Nothing is sent before you confirm.',
      goal: 'Goal', goalPlaceholder: 'What outcome should this work produce?',
      plan: 'Plan', planPlaceholder: 'Smallest useful next steps…',
      instruction: 'Instruction', instructionPlaceholder: 'Extra instruction for the session…',
      modelLabel: 'Model', defaultModel: 'Default model',
      preview: 'Preview', clear: 'Clear', confirm: 'Run now', saving: 'Saving…',
      previewReady: 'Ready to dispatch', showPrompt: 'Show the full prompt',
      execOffHint: 'Execution disabled — set execution.enabled=true in workbench.config.json.',
      noController: 'No sessionController in this profile; dispatch is unavailable.',
      dispatchFailed: 'Dispatch failed.', modelsUnavailable: 'Model catalog unavailable; the choice stays local.',
      continuity: 'Continuity', mainline: 'Main line', stopped: 'Stopped at',
      next: 'Next', redlines: 'Guardrails', edit: 'Edit', save: 'Save', cancel: 'Cancel',
      saveFailed: 'Save failed.', editHint: 'Writes this workbench’s state.json; recorded in the audit trail.',
      more: 'Workspace details', tasks: 'Tasks', decisions: 'Decisions', audit: 'Audit trail',
      tokens: 'Tokens', green: 'Green', rework: 'Done / calls',
      noTasks: 'No tasks.', noDecisions: 'No decisions yet.', auditEmpty: 'No audit entries yet.',
      addDecision: 'Append', decisionPlaceholder: 'What was decided, why, what it costs…',
      decisionSaved: 'Appended.', decisionFailed: 'Could not append.',
      updated: 'Updated', noData: '—',
    }
    const zh = {
      title: '工作台', refresh: '刷新', loading: '读取中…',
      error: '无法读取工作台文件。', retry: '重试',
      execOn: '执行已启用', execOff: '执行未启用',
      runEmpty: '还没有派发过任务，在下面写一条。',
      currentRun: '当前运行', runHistory: '最近运行',
      running: '运行中', done: '已完成', cancelled: '已取消', failed: '出错',
      waiting: '等你回答', reply: '回复',
      waitingHint: '会话停在提问上：去工作区 {cwd} 打开该会话回答，运行就会继续。',
      noReplyYet: '还没有完成一轮，会话仍在工作。',
      noReply: '这次运行没有捕获到回复。',
      session: '会话', model: '模型', sessionWorkspace: '会话工作区',
      started: '开始于', steps: '步', toolCalls: '次工具调用',
      cancelRun: '取消运行', unknown: '未知', notSet: '—',
      compose: '派发', composeHint: '写清目标 → 生成预览 → 确认执行。不确认就不会发出任何东西。',
      goal: '目标', goalPlaceholder: '这次工作要产出什么结果？',
      plan: '计划', planPlaceholder: '最小可行的下一步…',
      instruction: '指令', instructionPlaceholder: '给这次会话的补充指令…',
      modelLabel: '模型', defaultModel: '默认模型',
      preview: '生成预览', clear: '清空', confirm: '立即执行', saving: '保存中…',
      previewReady: '可以派发', showPrompt: '查看完整提示词',
      execOffHint: '执行未启用——在工作区 workbench.config.json 中设置 execution.enabled=true。',
      noController: '当前 profile 没有 sessionController，无法派发。',
      dispatchFailed: '派发失败。', modelsUnavailable: '模型目录不可用；这里的选择只保存在本地。',
      continuity: '接续状态', mainline: '当前主线', stopped: '上次停在',
      next: '下一步', redlines: '红线', edit: '编辑', save: '保存', cancel: '取消',
      saveFailed: '保存失败。', editHint: '只写本工作区的 state.json，并记入审计。',
      more: '工作区详情', tasks: '任务队列', decisions: '近期决策', audit: '审计记录',
      tokens: 'Token', green: '绿卡', rework: '已完成 / 总调用',
      noTasks: '暂无任务。', noDecisions: '还没有记录决策。', auditEmpty: '还没有审计记录。',
      addDecision: '追加', decisionPlaceholder: '决定了什么、为什么、代价是什么…',
      decisionSaved: '已追加。', decisionFailed: '追加失败。',
      updated: '更新于', noData: '—',
    }

    const CSS = `
      .wb-page{box-sizing:border-box;height:100%;overflow-y:auto;overflow-x:hidden;padding:20px clamp(14px,3vw,44px) 48px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit}
      .wb-wrap{max-width:980px;margin:0 auto}
      .wb-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .wb-bar-left,.wb-bar-right{display:flex;align-items:center;gap:9px;min-width:0}
      .wb-dot{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-secondary)}
      .wb-dot[data-state="running"]{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 22%,transparent)}
      .wb-bar-title{font-size:14px;font-weight:750}
      .wb-muted{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-chip{border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 8px;color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700;white-space:nowrap}
      .wb-chip[data-status="running"]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 40%,var(--dsw-alias-border-l1))}
      .wb-chip[data-status="error"],.wb-chip.wb-warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,var(--dsw-alias-border-l1))}
      .wb-button{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:6px 11px;font:inherit;font-size:12px;cursor:pointer}
      .wb-button:hover{border-color:var(--dsw-alias-brand-primary)}
      .wb-button:disabled{opacity:.55;cursor:default}
      .wb-button-primary{border-color:var(--dsw-alias-button-primary-fill,#356be8);background:var(--dsw-alias-button-primary-fill,#356be8);color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:700}
      .wb-card{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:14px 16px;margin-bottom:12px}
      .wb-card h2{margin:0 0 10px;font-size:11px;font-weight:750;letter-spacing:.06em;color:var(--dsw-alias-label-secondary);text-transform:uppercase}
      .wb-run{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,var(--dsw-alias-border-l1))}
      .wb-run-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .wb-run-badges{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}
      .wb-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .wb-run-goal{margin:9px 0 8px;font-size:15px;line-height:1.45;font-weight:650;overflow-wrap:anywhere}
      .wb-meta{display:flex;flex-wrap:wrap;gap:4px 14px;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-meta b{color:var(--dsw-alias-label-primary);font-weight:600;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
      .wb-reply{margin-top:12px;padding-top:11px;border-top:1px solid var(--dsw-alias-border-l1)}
      .wb-reply strong{display:block;margin-bottom:6px;color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
      .wb-reply pre{margin:0;max-height:230px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}
      .wb-empty{padding:14px 2px;color:var(--dsw-alias-label-secondary);font-size:12px}
      .wb-run-list{list-style:none;margin:0;padding:0;display:grid;gap:2px}
      .wb-run-row{display:flex;align-items:center;gap:9px;width:100%;border:0;border-radius:8px;background:transparent;color:inherit;padding:6px 8px;font:inherit;font-size:12px;text-align:left;cursor:pointer}
      .wb-run-row:hover{background:var(--dsw-alias-bg-layer-2)}
      .wb-run-row[data-active="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}
      .wb-run-dot{flex:0 0 7px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-secondary)}
      .wb-run-dot[data-status="running"]{background:var(--dsw-alias-state-success-primary)}
      .wb-run-dot[data-status="error"]{background:var(--dsw-alias-state-error-primary)}
      .wb-run-row-goal{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wb-run-row-meta{flex:0 0 auto;color:var(--dsw-alias-label-secondary);font-size:10px}
      .wb-form{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px}
      .wb-field{display:flex;flex-direction:column;gap:5px;min-width:0}
      .wb-field-goal,.wb-field-model,.wb-field-plan,.wb-field-instruction{grid-column:span 6}
      .wb-field label{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary)}
      .wb-field input,.wb-field textarea,.wb-field select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 9px;font:inherit;font-size:12px;outline:none}
      .wb-field textarea{min-height:62px;resize:vertical;line-height:1.45}
      .wb-field input:focus,.wb-field textarea:focus,.wb-field select:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent)}
      .wb-form-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:2px}
      .wb-hint{margin:0 0 10px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}
      .wb-confirm{margin-top:12px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,var(--dsw-alias-border-l1));border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,var(--dsw-alias-bg-layer-1))}
      .wb-confirm-title{margin-bottom:7px;color:var(--dsw-alias-brand-primary);font-size:12px;font-weight:750}
      .wb-confirm .wb-actions{justify-content:flex-end;margin-top:9px}
      .wb-note{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}
      .wb-note.wb-error{color:var(--dsw-alias-state-error-primary)}
      .wb-note.wb-warn{color:var(--dsw-alias-state-warn-primary)}
      .wb-prompt{margin-top:9px}
      .wb-prompt summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-prompt pre{margin:7px 0 0;max-height:180px;overflow:auto;padding:9px;border-radius:8px;background:var(--dsw-alias-bg-base);white-space:pre-wrap;word-break:break-word;font:11px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-secondary)}
      .wb-mainline{font-size:15px;line-height:1.5;font-weight:650;overflow-wrap:anywhere}
      .wb-row{margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}
      .wb-row b{color:var(--dsw-alias-label-primary);font-weight:600}
      .wb-row ul{margin:4px 0 0;padding-left:15px}
      .wb-row li{margin:2px 0}
      .wb-edit-grid{display:grid;gap:8px}
      .wb-edit-grid label{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary)}
      .wb-edit-grid input,.wb-edit-grid textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 9px;font:inherit;font-size:12px;outline:none}
      .wb-edit-grid textarea{min-height:58px;resize:vertical}
      .wb-more{padding:0;overflow:hidden}
      .wb-more-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:12px 16px;font:inherit;font-size:12px;text-align:left;cursor:pointer}
      .wb-more-toggle:hover{color:var(--dsw-alias-label-primary)}
      .wb-more-body{padding:0 16px 14px;display:grid;gap:14px}
      .wb-more h3{margin:0 0 7px;font-size:11px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
      .wb-list{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:12px}
      .wb-task{padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .wb-task:last-child{border-bottom:0}
      .wb-task-line{display:flex;justify-content:space-between;gap:10px}
      .wb-task-id{color:var(--dsw-alias-brand-primary);font:700 11px ui-monospace,SFMono-Regular,Consolas,monospace}
      .wb-task-goal{margin-top:3px;font-size:12px;line-height:1.4}
      .wb-decisions{max-height:180px;overflow:auto;white-space:pre-wrap;font:11px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-secondary)}
      .wb-audit{display:grid;gap:5px;max-height:190px;overflow:auto}
      .wb-audit-item{display:flex;gap:8px;align-items:baseline;font-size:11px;color:var(--dsw-alias-label-secondary)}
      .wb-audit-action{flex:0 0 auto;font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-brand-primary)}
      .wb-audit-time{flex:0 0 auto;font:10px ui-monospace,SFMono-Regular,Consolas,monospace}
      .wb-audit-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wb-metrics{display:flex;gap:18px;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-metrics b{color:var(--dsw-alias-label-primary);font-weight:650}
      .wb-decision-form{display:grid;gap:7px;margin-top:8px}
      .wb-decision-form textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 9px;font:inherit;font-size:12px;min-height:54px;resize:vertical;outline:none}
      .wb-foot{display:flex;justify-content:space-between;gap:12px;margin-top:14px;color:var(--dsw-alias-label-secondary);font-size:10px}
      .wb-error-card{padding:20px;text-align:center;color:var(--dsw-alias-state-error-primary);font-size:12px}
      @media(max-width:720px){.wb-page{padding:16px 12px 32px}.wb-form{display:flex;flex-direction:column}.wb-bar{flex-direction:column;align-items:flex-start}.wb-bar-right{width:100%;justify-content:space-between}}
    `

    function asList(value) {
      if (Array.isArray(value)) return value.filter(Boolean).map(String)
      if (typeof value === 'string') return value.split(/\r?\n|;/).map(x => x.replace(/^[-•\d.)\s]+/, '').trim()).filter(Boolean)
      return []
    }
    function firstValue(...values) {
      return values.find(value => value !== undefined && value !== null && String(value).trim() !== '')
    }
    function formatClock(value) {
      const ms = Number(value)
      if (!Number.isFinite(ms) || ms <= 0) return '—'
      const date = new Date(ms)
      const pad = n => String(n).padStart(2, '0')
      return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
    }
    function formatElapsed(from, to) {
      const start = Number(from)
      const end = Number(to)
      if (!Number.isFinite(start) || start <= 0) return ''
      if (!Number.isFinite(end) || end <= start) return ''
      const seconds = Math.round((end - start) / 1000)
      if (seconds < 60) return seconds + 's'
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return minutes + 'm' + (seconds % 60 ? ' ' + (seconds % 60) + 's' : '')
      return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm'
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
      const [dryRun, setDryRun] = React.useState(null)
      const [dispatchBusy, setDispatchBusy] = React.useState(false)
      const [dispatchError, setDispatchError] = React.useState('')
      const [catalog, setCatalog] = React.useState(null)
      const [runs, setRuns] = React.useState([])
      const [selectedRunId, setSelectedRunId] = React.useState('')
      const [audit, setAudit] = React.useState([])
      const [moreOpen, setMoreOpen] = React.useState(false)
      const [editOpen, setEditOpen] = React.useState(false)
      const [draft, setDraft] = React.useState({ mainline: '', stopped_at: '', next: '', red_lines: '' })
      const [saving, setSaving] = React.useState(false)
      const [saveError, setSaveError] = React.useState('')
      const [decisionDraft, setDecisionDraft] = React.useState('')
      const [decisionBusy, setDecisionBusy] = React.useState(false)
      const [decisionNotice, setDecisionNotice] = React.useState('')
      const prefilled = React.useRef(false)

      const applyRuns = React.useCallback(items => {
        if (!Array.isArray(items)) return
        setRuns(items)
        setSelectedRunId(previous => (items.some(item => item && item.runId === previous) ? previous : ''))
      }, [])

      const load = React.useCallback(async () => {
        setBusy(true); setError(false)
        try {
          // Every request is a read-only GET against this plugin's own Host routes.
          const [response, modelsResponse, auditResponse, runsResponse] = await Promise.all([
            fetch('/dsh-workbench/api/state-v2', { cache: 'no-store', credentials: 'same-origin' }),
            fetch('/dsh-workbench/api/models', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
            fetch('/dsh-workbench/api/audit?limit=30', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
            fetch('/dsh-workbench/api/runs', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
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
                  setModel(previous => previous || models.current.provider + '/' + models.current.model)
                }
              }
            } catch { /* keep previous catalog */ }
          }
          if (auditResponse && auditResponse.ok) {
            try {
              const payload = await auditResponse.json()
              if (payload && Array.isArray(payload.entries)) setAudit(payload.entries)
            } catch { /* keep previous audit */ }
          }
          if (runsResponse && runsResponse.ok) {
            try {
              const payload = await runsResponse.json()
              if (payload && payload.ok === true) applyRuns(payload.items)
            } catch { /* keep previous runs */ }
          }
          const state = next.state || {}
          // The draft is filled once; later refreshes must not overwrite typing.
          if (!prefilled.current) {
            prefilled.current = true
            setGoal(String(firstValue(state.goal, state.mainline) || ''))
            setPlan(asList(state.next).join('\n'))
          }
        } catch { setError(true) } finally { setBusy(false) }
      }, [applyRuns])
      React.useEffect(() => { load() }, [load])

      async function postJson(path, body) {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        })
        let payload = null
        try { payload = await response.json() } catch { /* non-JSON */ }
        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error(payload?.error || ('HTTP ' + response.status))
        }
        return payload
      }

      async function refreshRuns() {
        try {
          const response = await fetch('/dsh-workbench/api/runs', { cache: 'no-store', credentials: 'same-origin' })
          const payload = await response.json()
          if (payload && payload.ok === true) applyRuns(payload.items)
        } catch { /* keep previous runs */ }
      }

      async function makePreview(event) {
        event?.preventDefault?.()
        const local = { goal: goal.trim(), plan: plan.trim(), instruction: instruction.trim(), model }
        setPreview(local); setDispatchError('')
        try {
          setDryRun(await postJson('/dsh-workbench/api/dispatch', { ...local, dryRun: true }))
        } catch (failure) {
          setDryRun({ ok: false, available: false, error: String(failure?.message || t('dispatchFailed')) })
        }
      }

      function clearForm() {
        setGoal(''); setPlan(''); setInstruction(''); setPreview(null); setDryRun(null); setDispatchError('')
      }

      async function confirmDispatch() {
        setDispatchBusy(true); setDispatchError('')
        try {
          const payload = await postJson('/dsh-workbench/api/dispatch', {
            goal: goal.trim(), plan: plan.trim(), instruction: instruction.trim(), model,
          })
          if (payload.warning) setDispatchError(payload.warning)
          if (payload.run) {
            setRuns(previous => [payload.run, ...previous.filter(item => item.runId !== payload.run.runId)])
            setSelectedRunId(payload.run.runId)
          }
          setPreview(null); setDryRun(null)
          await refreshRuns()
        } catch (failure) {
          setDispatchError(String(failure?.message || t('dispatchFailed')))
        } finally {
          setDispatchBusy(false)
        }
      }

      async function cancelRun(run) {
        if (!run) return
        setDispatchBusy(true); setDispatchError('')
        try {
          const payload = await postJson('/dsh-workbench/api/runs/cancel', { runId: run.runId })
          if (payload.run) {
            setRuns(previous => previous.map(item => (item.runId === payload.run.runId ? payload.run : item)))
          }
          await refreshRuns()
        } catch (failure) {
          setDispatchError(String(failure?.message || t('dispatchFailed')))
        } finally {
          setDispatchBusy(false)
        }
      }

      // Poll while any run is still running. Keyed on the status string so the
      // effect restarts only when the set of unfinished runs actually changes.
      const runningKey = runs.filter(item => item && item.status === 'running').map(item => item.runId).join(',')
      React.useEffect(() => {
        if (typeof document === 'undefined') return
        if (!runningKey) return
        const timer = setInterval(() => { refreshRuns() }, 4000)
        return () => clearInterval(timer)
      }, [runningKey])

      function openEdit() {
        setDraft({
          mainline: String(firstValue(state.mainline) || ''),
          stopped_at: String(firstValue(state.stopped_at, state.stoppedAt, '') || ''),
          next: next.join('\n'),
          red_lines: redlines.join('\n'),
        })
        setSaveError(''); setEditOpen(true)
      }

      async function saveState(event) {
        event?.preventDefault?.()
        setSaving(true); setSaveError('')
        try {
          await postJson('/dsh-workbench/api/state-edit', {
            mainline: draft.mainline, stopped_at: draft.stopped_at,
            next: draft.next, red_lines: draft.red_lines, requestId: 'panel-' + Date.now(),
          })
          setEditOpen(false); await load()
        } catch (failure) {
          setSaveError(String(failure?.message || t('saveFailed')))
        } finally { setSaving(false) }
      }

      async function addDecision(event) {
        event?.preventDefault?.()
        const text = decisionDraft.trim()
        if (!text) return
        setDecisionBusy(true); setDecisionNotice('')
        try {
          await postJson('/dsh-workbench/api/decision-add', { text, requestId: 'panel-' + Date.now() })
          setDecisionDraft(''); setDecisionNotice(t('decisionSaved')); await load()
        } catch (failure) {
          setDecisionNotice(String(failure?.message || t('decisionFailed')))
        } finally { setDecisionBusy(false) }
      }

      const state = data?.state || {}
      const next = asList(state.next)
      const redlines = asList(state.red_lines || state.redLines)
      const tasks = Array.isArray(data?.tasks) ? data.tasks : []
      const ledger = data?.ledger || {}
      const tokens = firstValue(ledger.totalTokens, ledger.total_tokens, ledger.tokens, '—')
      const green = firstValue(ledger.greenCards, ledger.green_cards, ledger.green, ledger.completed, '—')
      const rework = firstValue(ledger.reworkRate, ledger.rework_rate, ledger.rework, '—')
      const decisions = String(data?.decisions || '').trim()
      const execution = data?.execution || {}
      const canDispatch = Boolean(execution.controller && execution.enabled)

      const current = runs.find(item => item && item.runId === selectedRunId) || runs[0] || null
      const live = runs.some(item => item && item.status === 'running')
      const statusLabel = status => status === 'running' ? t('running')
        : status === 'done' ? t('done')
          : status === 'cancelled' ? t('cancelled')
            : status === 'error' ? t('failed') : t('unknown')

      const bar = h('header', { className: 'wb-bar' },
        h('div', { className: 'wb-bar-left' },
          h('span', { className: 'wb-dot', 'data-state': live ? 'running' : 'idle', 'aria-hidden': true }),
          h('strong', { className: 'wb-bar-title' }, t('title')),
          h('span', { className: 'wb-muted' }, execution.cwd || '')),
        h('div', { className: 'wb-bar-right' },
          h('span', { className: 'wb-chip' }, canDispatch ? t('execOn') : t('execOff')),
          h('button', { className: 'wb-button', type: 'button', onClick: load, disabled: busy }, busy ? t('loading') : t('refresh'))))

      const runView = current
        ? h('section', { className: 'wb-card wb-run', 'aria-labelledby': 'wb-run-title' },
          h('div', { className: 'wb-run-head' },
            h('div', { className: 'wb-run-badges' },
              h('span', { className: 'wb-chip', 'data-status': current.status }, statusLabel(current.status)),
              current.waiting && h('span', { className: 'wb-chip wb-warn' }, t('waiting')),
              h('h2', { id: 'wb-run-title', style: { margin: 0 } }, t('currentRun'))),
            h('div', { className: 'wb-actions' },
              current.status === 'running' && h('button', { className: 'wb-button', type: 'button', onClick: () => cancelRun(current), disabled: dispatchBusy }, t('cancelRun')),
              h('button', { className: 'wb-button', type: 'button', onClick: refreshRuns }, t('refresh')))),
          h('div', { className: 'wb-run-goal' }, current.goal || t('notSet')),
          h('div', { className: 'wb-meta' },
            h('span', null, t('session') + ' ', h('b', null, current.sessionId || '—')),
            h('span', null, t('model') + ' ', h('b', null, current.model || '—')),
            h('span', null, t('started') + ' ', h('b', null, formatClock(current.createdAt))),
            current.status === 'running' && formatElapsed(current.createdAt, Date.now()) && h('span', null, '⏱ ', h('b', null, formatElapsed(current.createdAt, Date.now()))),
            Number.isFinite(Number(current.steps)) && h('span', null, h('b', null, String(current.steps)), ' ' + t('steps')),
            Number.isFinite(Number(current.toolCalls)) && h('span', null, h('b', null, String(current.toolCalls)), ' ' + t('toolCalls')),
            h('span', null, t('sessionWorkspace') + ' ', h('b', null, current.cwd || '—'))),
          current.waiting && h('div', { className: 'wb-note wb-warn', style: { marginTop: 8 } }, String(t('waitingHint')).replace('{cwd}', current.cwd || t('notSet'))),
          h('div', { className: 'wb-reply' },
            h('strong', null, t('reply')),
            h('pre', null, current.reply || (current.status === 'running' ? t('noReplyYet') : t('noReply')))))
        : h('section', { className: 'wb-card wb-run' }, h('div', { className: 'wb-empty' }, t('runEmpty')))

      const history = runs.length > 1
        ? h('section', { className: 'wb-card wb-runs' },
          h('h2', null, t('runHistory')),
          h('ul', { className: 'wb-run-list' }, runs.slice(0, 6).map(item => h('li', { key: item.runId },
            h('button', {
              className: 'wb-run-row', type: 'button',
              'data-active': item.runId === current?.runId ? 'true' : 'false',
              onClick: () => setSelectedRunId(item.runId),
            },
              h('span', { className: 'wb-run-dot', 'data-status': item.status, 'aria-hidden': true }),
              h('span', { className: 'wb-run-row-goal' }, item.goal || t('notSet')),
              h('span', { className: 'wb-run-row-meta' }, statusLabel(item.status) + ' · ' + formatClock(item.createdAt)))))))
        : null

      const modelField = h('div', { className: 'wb-field wb-field-model' },
        h('label', { htmlFor: 'wb-model' }, t('modelLabel')),
        h('select', { id: 'wb-model', value: model, onChange: event => setModel(event.target.value) },
          h('option', { value: '' }, t('defaultModel')),
          (catalog?.groups || []).map(group => h('optgroup', { key: group.id, label: group.name || group.id },
            (group.models || []).map(item => h('option', { key: group.id + '/' + item.id, value: group.id + '/' + item.id }, item.name || item.id))))),
        catalog && catalog.available === false && h('span', { className: 'wb-note' }, t('modelsUnavailable')))

      const composeButtons = h('div', { className: 'wb-actions' },
        h('button', { className: 'wb-button', type: 'button', onClick: clearForm }, t('clear')),
        h('button', { className: 'wb-button wb-button-primary', type: 'submit' }, t('preview')))

      const confirmButtons = h('div', { className: 'wb-actions' },
        h('button', { className: 'wb-button', type: 'button', onClick: () => { setPreview(null); setDryRun(null) } }, t('cancel')),
        canDispatch && h('button', {
          className: 'wb-button wb-button-primary',
          type: 'button',
          onClick: confirmDispatch,
          disabled: dispatchBusy || !goal.trim(),
        }, dispatchBusy ? t('saving') : t('confirm')))

      const composeForm = h('form', { className: 'wb-form', onSubmit: makePreview },
        h('div', { className: 'wb-field wb-field-goal' },
          h('label', { htmlFor: 'wb-goal' }, t('goal')),
          h('input', { id: 'wb-goal', value: goal, onChange: event => setGoal(event.target.value), placeholder: t('goalPlaceholder') })),
        modelField,
        h('div', { className: 'wb-field wb-field-plan' },
          h('label', { htmlFor: 'wb-plan' }, t('plan')),
          h('textarea', { id: 'wb-plan', value: plan, onChange: event => setPlan(event.target.value), placeholder: t('planPlaceholder') })),
        h('div', { className: 'wb-field wb-field-instruction' },
          h('label', { htmlFor: 'wb-instruction' }, t('instruction')),
          h('textarea', { id: 'wb-instruction', value: instruction, onChange: event => setInstruction(event.target.value), placeholder: t('instructionPlaceholder') })),
        h('div', { className: 'wb-form-actions' },
          h('span', { className: 'wb-note' }, canDispatch ? '' : (execution.controller ? t('execOffHint') : t('noController'))),
          composeButtons))

      const confirmBlock = preview && h('div', { className: 'wb-confirm' },
        h('div', { className: 'wb-confirm-title' }, t('previewReady')),
        h('div', { className: 'wb-meta' },
          h('span', null, t('model') + ' ', h('b', null, preview.model || t('defaultModel'))),
          h('span', null, t('sessionWorkspace') + ' ', h('b', null, execution.cwd || '—'))),
        confirmButtons,
        !canDispatch && h('div', { className: 'wb-note wb-warn' }, execution.controller ? t('execOffHint') : t('noController')),
        dryRun?.prompt && h('details', { className: 'wb-prompt' },
          h('summary', null, t('showPrompt')),
          h('pre', null, dryRun.prompt)),
        dispatchError && h('div', { className: 'wb-note wb-error', role: 'alert' }, dispatchError))

      const compose = h('section', { className: 'wb-card wb-compose' },
        h('h2', null, t('compose')),
        h('p', { className: 'wb-hint' }, t('composeHint')),
        composeForm,
        confirmBlock)

      const continuityRead = h('div', null,
        h('div', { className: 'wb-mainline' }, String(firstValue(state.mainline, t('noData')) || '')),
        h('div', { className: 'wb-row' }, h('b', null, t('stopped') + ': '), String(firstValue(state.stopped_at, state.stoppedAt, t('noData')) || '')),
        next.length ? h('div', { className: 'wb-row' }, h('b', null, t('next') + ':'), h('ul', null, next.map((item, index) => h('li', { key: index }, item)))) : null,
        redlines.length ? h('div', { className: 'wb-row' }, h('b', null, t('redlines') + ':'), h('ul', null, redlines.map((item, index) => h('li', { key: index }, item)))) : null)

      const continuityEdit = h('form', { className: 'wb-edit-grid', onSubmit: saveState },
        h('div', null, h('label', { htmlFor: 'wb-edit-mainline' }, t('mainline')),
          h('input', { id: 'wb-edit-mainline', value: draft.mainline, onChange: event => setDraft({ ...draft, mainline: event.target.value }) })),
        h('div', null, h('label', { htmlFor: 'wb-edit-stopped' }, t('stopped')),
          h('input', { id: 'wb-edit-stopped', value: draft.stopped_at, onChange: event => setDraft({ ...draft, stopped_at: event.target.value }) })),
        h('div', null, h('label', { htmlFor: 'wb-edit-next' }, t('next')),
          h('textarea', { id: 'wb-edit-next', value: draft.next, onChange: event => setDraft({ ...draft, next: event.target.value }) })),
        h('div', null, h('label', { htmlFor: 'wb-edit-redlines' }, t('redlines')),
          h('textarea', { id: 'wb-edit-redlines', value: draft.red_lines, onChange: event => setDraft({ ...draft, red_lines: event.target.value }) })),
        h('div', { className: 'wb-note' }, t('editHint')),
        saveError && h('div', { className: 'wb-note wb-error' }, saveError),
        h('div', { className: 'wb-actions', style: { justifyContent: 'flex-end' } },
          h('button', { className: 'wb-button', type: 'button', onClick: () => setEditOpen(false) }, t('cancel')),
          h('button', { className: 'wb-button wb-button-primary', type: 'submit', disabled: saving }, saving ? t('saving') : t('save'))))

      const continuity = h('section', { className: 'wb-card wb-continuity' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 } },
          h('h2', { style: { margin: 0 } }, t('continuity')),
          !editOpen && h('button', { className: 'wb-button', type: 'button', onClick: openEdit }, t('edit'))),
        h('div', { style: { marginTop: 10 } }, editOpen ? continuityEdit : continuityRead))

      const tasksView = h('div', null,
        h('h3', null, t('tasks')),
        tasks.length
          ? h('div', null, tasks.map((item, index) => {
            const task = typeof item === 'object' && item !== null ? item : { goal: String(item) }
            return h('div', { className: 'wb-task', key: index },
              h('div', { className: 'wb-task-line' },
                h('span', { className: 'wb-task-id' }, String(firstValue(task.id, task.name, 'T-' + (index + 1)) || '')),
                h('span', { className: 'wb-run-row-meta' }, String(firstValue(task.status, '') || ''))),
              h('div', { className: 'wb-task-goal' }, String(firstValue(task.goal, task.title, task.deliverable, task.text, '—') || '')))
          }))
          : h('div', { className: 'wb-note' }, t('noTasks')))

      const decisionsView = h('div', null,
        h('h3', null, t('decisions')),
        h('div', { className: 'wb-decisions' }, decisions || t('noDecisions')),
        h('form', { className: 'wb-decision-form', onSubmit: addDecision },
          h('textarea', { value: decisionDraft, onChange: event => setDecisionDraft(event.target.value), placeholder: t('decisionPlaceholder') }),
          h('div', { className: 'wb-actions', style: { justifyContent: 'flex-end' } },
            decisionNotice && h('span', { className: 'wb-note' }, decisionNotice),
            h('button', { className: 'wb-button', type: 'submit', disabled: decisionBusy || !decisionDraft.trim() }, decisionBusy ? t('saving') : t('addDecision')))))

      const auditView = h('div', null,
        h('h3', null, t('audit')),
        audit.length
          ? h('div', { className: 'wb-audit' }, audit.slice(0, 20).map((entry, index) => h('div', { className: 'wb-audit-item', key: index },
            h('span', { className: 'wb-audit-action' }, entry.action || '—'),
            h('span', { className: 'wb-audit-time' }, String(entry.ts || '').replace('T', ' ').slice(0, 19)),
            h('span', { className: 'wb-audit-summary' }, String(entry.summary || '')))))
          : h('div', { className: 'wb-note' }, t('auditEmpty')))

      const metricsView = h('div', null,
        h('h3', null, t('more')),
        h('div', { className: 'wb-metrics' },
          h('span', null, t('tokens') + ' ', h('b', null, String(tokens))),
          h('span', null, t('green') + ' ', h('b', null, String(green))),
          h('span', null, t('rework') + ' ', h('b', null, String(rework))),
          h('span', null, t('updated') + ' ', h('b', null, String(data?.fetchedAt || '—').replace('T', ' ').slice(0, 19)))))

      const more = h('section', { className: 'wb-card wb-more' },
        h('button', { className: 'wb-more-toggle', type: 'button', onClick: () => setMoreOpen(!moreOpen), 'aria-expanded': moreOpen },
          h('span', null, (moreOpen ? '▾ ' : '▸ ') + t('more')),
          h('span', { className: 'wb-note' }, t('tasks') + ' ' + tasks.length + ' · ' + t('audit') + ' ' + audit.length)),
        moreOpen && h('div', { className: 'wb-more-body' }, tasksView, decisionsView, auditView, metricsView))

      let body
      if (error) {
        body = h('section', { className: 'wb-card wb-error-card', role: 'alert' },
          h('p', null, t('error')),
          h('button', { className: 'wb-button', type: 'button', onClick: load }, t('retry')))
      } else if (!data) {
        body = h('section', { className: 'wb-card' }, h('div', { className: 'wb-empty' }, t('loading')))
      } else {
        body = h('div', { className: 'wb-content' }, runView, history, compose, continuity, more)
      }

      return h('div', { className: 'wb-page' }, h('style', null, CSS), h('div', { className: 'wb-wrap' }, bar, body))
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