window.__ModuleLoader__.load({
  id: 'dsh-workbench',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // Panel information architecture (v0.6) — one tab answers one question:
    //   run       : is work happening right now, and what came of it?
    //   task      : assemble the next dispatch from reusable modules.
    //   history   : past runs as digested reports, raw event text folded away.
    //   workspace : continuity, decisions, audit timeline, real metrics.
    //
    // Two rules the layout encodes:
    //   1. Evidence never outranks the conclusion. Raw replies/audit lines are
    //      always behind a disclosure, never the first thing painted.
    //   2. Input is assembled, not retyped: each field can be filled from a
    //      saved module, and the fields of the previous run are one click away.
// v1.0 flow copy: three moments instead of five tabs. The panel lives in the
    // conversation's right column, so it must say the next physical action, not
    // describe a taxonomy.
    const FLOW_EN = {
      momentAttach: 'Attach', momentWork: 'Working', momentClose: 'Close out',
      momentHint: 'The moment is picked from data: a live run wins, then an unclosed gap, else attach.',
      guideDescription: 'Attach to the session, work in it, close it out — one memory per project.',
      sessionMissing: 'No session is bound to this panel, so sync work cannot be queued. Open the workbench from a conversation.',
      memoryTitle: 'Project memory', memoryRoot: 'root', memoryGapOpen: 'Not closed out yet',
      memoryActivate: 'Use this project', memoryActivateDone: 'Project bound to this session.',
      memoryEmpty: 'This project has no memory yet — the first save creates it.',
      attachHint: 'Pick up where the last session stopped, then say what this one is for.',
      syncTitle: 'This task', syncPlaceholder: 'What should happen now, in this session?',
      syncGo: 'Do it here', syncAsync: 'Dispatch instead', syncBusy: 'Queuing…',
      syncQueued: 'Queued into this session — it continues at the next step.',
      syncRefused: 'That is long work: it belongs in its own session.',
      channelSync: 'same session', channelAsync: 'child session', channelWhy: 'why',
      liveTitle: 'This session', liveIdle: 'idle', liveRunning: 'working',
      closeTitle: 'Close out', closeNext: 'Next first step', closeDecisionTitle: 'Decision title',
      closeDecision: 'Judgement (optional)', closeDecisionPlaceholder: 'What was decided, why, what it costs…',
      closeOutcome: 'Outcome', outcomeGreen: 'green — verified', outcomeYellow: 'yellow — partly',
      outcomeRed: 'red — failed', closeSubmit: 'Write close-out', closeBusy: 'Writing…',
      closeDone: 'Close-out written: the injected block now carries the next step.',
      closeFailed: 'Close-out failed.', closeNeedsNext: 'A close-out needs the next first step.',
      moreLongJobs: 'Long jobs', moreCanvas: 'Canvas', moreHistory: 'Past runs', moreAudit: 'Audit trail',
      memoryDecisions: 'Recent decisions', running: 'running',
    }
    const FLOW_ZH = {
      momentAttach: '接上', momentWork: '在做', momentClose: '收工',
      momentHint: '时刻由数据自动判定：有运行就进「在做」，有未收工的缺口就进「收工」，否则「接上」。',
      guideDescription: '接上当前会话、在里面做事、收工写回记忆——一个项目一份记忆。',
      sessionMissing: '这个面板没有绑定会话，同步任务无处可排。请从某个对话里打开工作台。',
      memoryTitle: '项目记忆', memoryRoot: '根目录', memoryGapOpen: '上次没收工',
      memoryActivate: '用这个项目', memoryActivateDone: '已把这个项目绑到当前会话。',
      memoryEmpty: '这个项目还没有记忆——第一次保存时创建。',
      attachHint: '先接上次停的地方，再说清这次要做什么。',
      syncTitle: '这次做什么', syncPlaceholder: '现在要在这个会话里做什么？',
      syncGo: '就在这里做', syncAsync: '改成派长活', syncBusy: '排队中…',
      syncQueued: '已排进当前会话，下一步就接着做。',
      syncRefused: '这属于长活，应该给它自己的会话。',
      channelSync: '同一会话', channelAsync: '子会话', channelWhy: '依据',
      liveTitle: '当前会话', liveIdle: '空闲', liveRunning: '工作中',
      closeTitle: '收工', closeNext: '下次第一步', closeDecisionTitle: '判断标题',
      closeDecision: '判断（可选）', closeDecisionPlaceholder: '决定了什么、为什么、代价是什么…',
      closeOutcome: '结论', outcomeGreen: '绿——已验证', outcomeYellow: '黄——部分',
      outcomeRed: '红——失败', closeSubmit: '写入收工', closeBusy: '写入中…',
      closeDone: '已写入收工：注入块里已经带上下一步。',
      closeFailed: '收工写入失败。', closeNeedsNext: '收工必须写下次的第一步。',
      moreLongJobs: '长活', moreCanvas: '画布', moreHistory: '历史运行', moreAudit: '审计时间线',
      memoryDecisions: '最近判断', running: '运行中',
    }
    const en = {
      ...FLOW_EN,
      title: 'Workbench', refresh: 'Refresh', loading: 'Reading…',
      error: 'Could not read workbench files.', retry: 'Try again',
      execOn: 'execution on', execOff: 'execution off',
      tabRun: 'Run', tabTask: 'Task', tabHistory: 'History', tabWorkspace: 'Workspace',
      runEmpty: 'Nothing is running. Compose the first task.',
      goToTask: 'Compose a task',
      currentRun: 'Current run', running: 'Running', done: 'Done', cancelled: 'Cancelled', failed: 'Failed',
      waiting: 'Waiting for your answer', waitingHint: 'The session is parked on a question. Open it in workspace {cwd} to answer — the run continues right after that.',
      noReplyYet: 'No finished reply yet — the session is still working.',
      noReply: 'No reply captured for this run.',
      session: 'session', model: 'model', sessionWorkspace: 'session workspace', started: 'started',
      steps: 'steps', toolCalls: 'tool calls', duration: 'duration',
      cancelRun: 'Cancel run', unknown: 'unknown', notSet: '—',
      orphanedHint: 'This run\'s session is no longer in the current Harness process (usually after a restart), so the panel cannot track it. The record stays in runs.json; you can archive it.',
      archiveRun: 'Archive',
      orphanedChip: 'not tracked',
      compose: 'Compose', composeHint: 'Fill the slots (or reuse a module), preview, then run. Nothing is sent before you confirm.',
      goal: 'Goal', goalPlaceholder: 'What outcome should this work produce?',
      plan: 'Plan', planPlaceholder: 'Smallest useful next steps…',
      instruction: 'Instruction', instructionPlaceholder: 'Extra instruction for the session…',
      modelLabel: 'Model', defaultModel: 'Default model',
      sessionTarget: 'Session target', newSession: 'New session (ungrouped)', sessionHint: 'Existing sessions keep their history; a new one lands in the ungrouped list.',
      insertModule: '+ module', useLast: 'Use last run', moduleTitle: 'Module title',
      saveModule: 'Save as module', moduleSaved: 'Module saved.', moduleFailed: 'Could not save module.',
      moduleEmpty: 'No module of this kind yet — write a slot, then save it.', noModulesYet: 'No modules yet.', close: 'Close',
      preview: 'Preview', clear: 'Clear', confirm: 'Run now', saving: 'Working…',
      previewReady: 'Ready to dispatch', showPrompt: 'Show the full prompt',
      execOffHint: 'Execution disabled — set execution.enabled=true in workbench.config.json.',
      noController: 'No sessionController in this profile; dispatch is unavailable.',
      dispatchFailed: 'Dispatch failed.', modelsUnavailable: 'Model catalog unavailable; the choice stays local.',
      reusedNotice: 'Fields copied from that run.',
      continuity: 'Continuity', mainline: 'Main line', stopped: 'Stopped at',
      next: 'Next', redlines: 'Guardrails', edit: 'Edit', save: 'Save', cancel: 'Cancel',
      saveFailed: 'Save failed.', editHint: 'Writes this workbench’s state.json; recorded in the audit trail.',
      tasks: 'Tasks', decisions: 'Decisions', audit: 'Audit trail', metrics: 'Metrics',
      noTasks: 'No tasks.', noDecisions: 'No decisions yet.', auditEmpty: 'No audit entries yet.',
      addDecision: 'Append', decisionPlaceholder: 'What was decided, why, what it costs…',
      decisionSaved: 'Appended.', decisionFailed: 'Could not append.',
      reportTitle: 'Run report', conclusion: 'Conclusion', points: 'Key points',
      artifacts: 'Artifacts', pending: 'Needs your answer', rawReply: 'Raw record',
      reportNote: 'Machine summary — if it disagrees with the raw record, the raw record wins.',
      reportEmpty: 'Pick a run to see its report.', noArtifacts: 'No file paths were touched or produced.',
      noPending: 'Nothing is waiting on you.', noPoints: 'No list-style findings in this run.',
      reuseRun: 'Reuse this run', dispatches: 'dispatches', successRate: 'success rate',
      avgDuration: 'average duration', avgSteps: 'average steps', sampleTooSmall: 'Not enough runs to summarise yet.',
      action_dispatch_start: 'dispatch', action_dispatch_done: 'done', action_dispatch_failed: 'failed',
      action_dispatch_error: 'error', action_dispatch_cancel: 'cancelled', action_state_edit: 'state',
      action_decision_append: 'decision', action_module_save: 'module+', action_module_remove: 'module−',
      action_template_save: 'template+', action_template_remove: 'template−', action_dispatch_archive: 'archived',
      templateLabel: 'Template', noTemplate: 'No template — fill the slots',
      templateTitle: 'Template name', saveTemplate: 'Save as template', deleteTemplate: 'Delete',
      templateSaved: 'Template saved.', templateRemoved: 'Template deleted.',
      templateFailed: 'Could not save the template.', templateNeedsGoal: 'A template needs a goal.',
      templateHint: 'Picking a template fills every slot; saving one records this combination for next time.',
      templateEmpty: 'No templates yet — assemble the slots once, then save them here.',
      templateUses: 'used {n}×', templateRuns: 'template dispatches',

      canvasTitle: 'Canvas', tabCanvas: 'Canvas',
      canvasHint: 'Read-only: this only shows how modules, templates and runs actually connect. Nothing can be dragged or edited here.',
      canvasEmpty: 'Nothing to draw yet — save a template, then dispatch from it.',
      canvasModules: 'Modules', canvasRecipe: 'Template', canvasRuns: 'Runs',
      canvasNoModules: 'This template records no modules.', canvasNoRuns: 'Never dispatched from this template yet.',
      canvasMoreRuns: 'and {n} more', canvasMissingModule: 'module deleted',
      canvasLoose: 'Loose dispatches', canvasLooseHint: 'These runs did not come from any template.',
      canvasNoTemplate: 'No template',
      updated: 'Updated', noData: '—',
    }
    const zh = {
      ...FLOW_ZH,
      title: '工作台', refresh: '刷新', loading: '读取中…',
      error: '无法读取工作台文件。', retry: '重试',
      execOn: '执行已启用', execOff: '执行未启用',
      tabRun: '运行', tabTask: '任务', tabHistory: '历史', tabWorkspace: '工作区',
      runEmpty: '当前没有在跑的任务。先派一个。',
      goToTask: '去派发任务',
      currentRun: '当前运行', running: '运行中', done: '已完成', cancelled: '已取消', failed: '出错',
      waiting: '等你回答', waitingHint: '会话停在提问上：去工作区 {cwd} 打开该会话回答，运行就会继续。',
      noReplyYet: '还没有完成一轮，会话仍在工作。',
      noReply: '这次运行没有捕获到回复。',
      session: '会话', model: '模型', sessionWorkspace: '会话工作区', started: '开始于',
      steps: '步', toolCalls: '次工具调用', duration: '耗时',
      cancelRun: '取消运行', unknown: '未知', notSet: '—',
      orphanedHint: '这次运行的会话已不在当前 Harness 进程里（通常是重启过），面板无法再跟踪它。记录保留在 runs.json，可以归档。',
      orphanedChip: '失去跟踪',
      archiveRun: '归档',
      compose: '派发', composeHint: '填槽位（或用模块），先预览再执行。不确认就不会发出任何东西。',
      goal: '目标', goalPlaceholder: '这次工作要产出什么结果？',
      plan: '计划', planPlaceholder: '最小可行的下一步…',
      instruction: '指令', instructionPlaceholder: '给这次会话的补充指令…',
      modelLabel: '模型', defaultModel: '默认模型',
      sessionTarget: '会话目标', newSession: '新会话（未分组）', sessionHint: '选已有会话会接着它原来的上下文；新建则出现在未分组里。',
      insertModule: '＋模块', useLast: '带入上次', moduleTitle: '模块标题',
      saveModule: '存为模块', moduleSaved: '已存为模块。', moduleFailed: '存模块失败。',
      moduleEmpty: '还没有这类模块——先把槽位写好，再存成模块。', noModulesYet: '还没有模块。', close: '关闭',
      preview: '生成预览', clear: '清空', confirm: '立即执行', saving: '处理中…',
      previewReady: '可以派发', showPrompt: '查看完整提示词',
      execOffHint: '执行未启用——在工作区 workbench.config.json 中设置 execution.enabled=true。',
      noController: '当前 profile 没有 sessionController，无法派发。',
      dispatchFailed: '派发失败。', modelsUnavailable: '模型目录不可用；这里的选择只保存在本地。',
      reusedNotice: '已带入那一次的字段。',
      continuity: '接续状态', mainline: '当前主线', stopped: '上次停在',
      next: '下一步', redlines: '红线', edit: '编辑', save: '保存', cancel: '取消',
      saveFailed: '保存失败。', editHint: '只写本工作区的 state.json，并记入审计。',
      tasks: '任务队列', decisions: '决策', audit: '审计时间线', metrics: '执行指标',
      noTasks: '暂无任务。', noDecisions: '还没有记录决策。', auditEmpty: '还没有审计记录。',
      addDecision: '追加', decisionPlaceholder: '决定了什么、为什么、代价是什么…',
      decisionSaved: '已追加。', decisionFailed: '追加失败。',
      reportTitle: '运行报告', conclusion: '结论', points: '要点',
      artifacts: '产物', pending: '需要你回答', rawReply: '原始记录',
      reportNote: '机器摘要——与原始记录冲突时，以原始记录为准。',
      reportEmpty: '选一次运行查看它的报告。', noArtifacts: '这次没有触碰或产出文件路径。',
      noPending: '没有需要你回答的事。', noPoints: '这次没有列表式结论。',
      reuseRun: '按这次再来一遍', dispatches: '次派发', successRate: '成功率',
      avgDuration: '平均耗时', avgSteps: '平均步数', sampleTooSmall: '样本还不够，先跑几次再看统计。',
      action_dispatch_start: '派发', action_dispatch_done: '完成', action_dispatch_failed: '失败',
      action_dispatch_error: '出错', action_dispatch_cancel: '取消', action_state_edit: '改状态',
      action_decision_append: '记决策', action_module_save: '存模块', action_module_remove: '删模块',
      action_template_save: '存模板', action_template_remove: '删模板', action_dispatch_archive: '归档运行',
      templateLabel: '模板', noTemplate: '不用模板，自己填槽位',
      templateTitle: '模板名字', saveTemplate: '存为模板', deleteTemplate: '删除',
      templateSaved: '模板已保存。', templateRemoved: '模板已删除。',
      templateFailed: '模板保存失败。', templateNeedsGoal: '模板至少要有目标。',
      templateHint: '选一个模板会把三个槽位一次填好；把当前组合存下来，下次就不用重拼。',
      templateEmpty: '还没有模板：先把槽位拼一次，再存成模板。',
      templateUses: '用了 {n} 次', templateRuns: '模板派发',

      canvasTitle: '画布', tabCanvas: '画布',
      canvasHint: '只读：这里只显示「模块 → 模板 → 运行」的真实关系，不能拖动，也不能在这里改任何东西。',
      canvasEmpty: '还没有可画的东西：先存一个模板，再用它派发一次。',
      canvasModules: '模块', canvasRecipe: '模板', canvasRuns: '运行',
      canvasNoModules: '这个模板没有记录模块。', canvasNoRuns: '还没用它派发过。',
      canvasMoreRuns: '还有 {n} 条', canvasMissingModule: '模块已删除',
      canvasLoose: '裸派发', canvasLooseHint: '这些运行不来自任何模板。',
      canvasNoTemplate: '无模板',
      updated: '更新于', noData: '—',
    }

    const CSS = `
      .wb-page{box-sizing:border-box;height:100%;overflow-y:auto;overflow-x:hidden;padding:14px 12px 28px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit}
      .wb-moments{display:flex;gap:6px;margin-bottom:10px}
      .wb-moment{flex:1;min-width:0;padding:7px 4px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
      .wb-moment-reset{flex:0 0 28px;color:var(--dsw-alias-label-tertiary)}
      .wb-moment[data-active="true"]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-weight:650}
      .wb-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
      .wb-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;word-break:break-all}
      .wb-warn-note{color:var(--dsw-alias-label-warn,#b8791a)}
      .wb-channel{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}
      .wb-chip[data-channel="sync"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
      .wb-details{margin-bottom:12px}
      .wb-wrap{max-width:980px;margin:0 auto}
      .wb-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .wb-bar-left,.wb-bar-right{display:flex;align-items:center;gap:9px;min-width:0}
      .wb-dot{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-secondary)}
      .wb-dot[data-state="running"]{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 22%,transparent)}
      .wb-bar-title{font-size:14px;font-weight:750}
      .wb-muted{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-tabs{display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .wb-tab{border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);padding:7px 13px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
      .wb-tab:hover{color:var(--dsw-alias-label-primary)}
      .wb-tab[data-active="true"]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
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
      .wb-run-row-tpl{flex:0 0 auto;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--dsw-alias-border-l1));border-radius:999px;padding:1px 7px;color:var(--dsw-alias-brand-primary);font-size:10px;font-weight:650}
      .wb-canvas-row{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr) minmax(0,1.2fr);gap:10px;align-items:start;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1)}
      .wb-canvas-row:first-of-type{border-top:none}
      .wb-canvas-col{display:flex;flex-direction:column;gap:6px;min-width:0}
      .wb-canvas-label{color:var(--dsw-alias-label-secondary);font-size:10px;letter-spacing:.08em;text-transform:uppercase}
      .wb-canvas-nodes{flex-wrap:wrap;flex-direction:row;align-items:flex-start}
      .wb-canvas-nodes .wb-canvas-label{flex-basis:100%}
      .wb-canvas-node{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:2px 8px;font-size:11px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
      .wb-canvas-node[data-kind=goal]{border-left:3px solid var(--dsw-alias-brand-primary)}
      .wb-canvas-node[data-kind=plan]{border-left:3px solid var(--dsw-alias-state-warn-primary)}
      .wb-canvas-node[data-kind=instruction]{border-left:3px solid var(--dsw-alias-state-success-primary)}
      .wb-canvas-missing{color:var(--dsw-alias-state-error-primary);border-style:dashed}
      .wb-canvas-template{font-weight:650;font-size:12px;min-width:0;overflow-wrap:anywhere}
      .wb-canvas-run{display:flex;align-items:center;gap:6px;min-width:0;font-size:11px}
      .wb-canvas-run-goal{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wb-canvas-run-meta{flex:0 0 auto;color:var(--dsw-alias-label-secondary);font-size:10px}
      .wb-canvas-plain{margin-top:14px}
      @media(max-width:720px){.wb-canvas-row{grid-template-columns:1fr}}
      .wb-template select{min-width:150px;max-width:260px;min-height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:5px 8px;font:inherit;font-size:12px}
      .wb-template input{box-sizing:border-box;flex:1 1 140px;min-width:0;min-height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:6px 9px;font:inherit;font-size:12px;outline:none}
      .wb-slot{display:grid;gap:6px;margin-bottom:11px}
      .wb-slot-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .wb-slot-head label{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary)}
      .wb-slot-tools{display:flex;align-items:center;gap:6px}
      .wb-mini{border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);padding:4px 9px;font:inherit;font-size:11px;font-weight:600;cursor:pointer}
      .wb-mini:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}
      .wb-slot input,.wb-slot textarea{box-sizing:border-box;width:100%;min-height:34px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 9px;font:inherit;font-size:12px;outline:none}
      .wb-slot textarea{min-height:64px;resize:vertical;line-height:1.45}
      .wb-slot input:focus,.wb-slot textarea:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent)}
      .wb-picker input{box-sizing:border-box;flex:1 1 160px;min-width:0;min-height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:6px 9px;font:inherit;font-size:12px;outline:none}
      .wb-field{display:flex;flex-direction:column;gap:5px;min-width:0}
      .wb-field input,.wb-field textarea,.wb-field select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 9px;font:inherit;font-size:12px;outline:none}
      .wb-field textarea{min-height:60px;resize:vertical;line-height:1.45}
      .wb-field input:focus,.wb-field textarea:focus,.wb-field select:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,transparent)}
      .wb-form-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:2px}
      .wb-hint{margin:0 0 10px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}
      .wb-picker{margin-top:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 11px;background:var(--dsw-alias-bg-base);display:grid;gap:8px}
      .wb-picker-item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .wb-picker-item:last-of-type{border-bottom:0}
      .wb-picker-text{min-width:0}
      .wb-picker-title{font-size:12px;font-weight:650;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
      .wb-picker-body{margin-top:2px;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
      .wb-confirm{margin-top:12px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,var(--dsw-alias-border-l1));border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,var(--dsw-alias-bg-layer-1))}
      .wb-confirm-title{margin-bottom:7px;color:var(--dsw-alias-brand-primary);font-size:12px;font-weight:750}
      .wb-confirm .wb-actions{justify-content:flex-end;margin-top:9px}
      .wb-note{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}
      .wb-note.wb-error{color:var(--dsw-alias-state-error-primary)}
      .wb-note.wb-warn{color:var(--dsw-alias-state-warn-primary)}
      .wb-prompt{margin-top:9px}
      .wb-prompt summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-prompt pre{margin:7px 0 0;max-height:200px;overflow:auto;padding:9px;border-radius:8px;background:var(--dsw-alias-bg-base);white-space:pre-wrap;word-break:break-word;font:11px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-secondary)}
      .wb-mainline{font-size:15px;line-height:1.5;font-weight:650;overflow-wrap:anywhere}
      .wb-row{margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}
      .wb-row b{color:var(--dsw-alias-label-primary);font-weight:600}
      .wb-row ul{margin:4px 0 0;padding-left:15px}
      .wb-row li{margin:2px 0}
      .wb-edit-grid{display:grid;gap:8px}
      .wb-edit-grid label{font-size:11px;font-weight:700;color:var(--dsw-alias-label-secondary)}
      .wb-edit-grid input,.wb-edit-grid textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 9px;font:inherit;font-size:12px;outline:none}
      .wb-edit-grid textarea{min-height:58px;resize:vertical}
      .wb-report-block{margin-top:11px}
      .wb-report-label{margin-bottom:5px;font-size:10px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
      .wb-report-conclusion{font-size:14px;line-height:1.6;font-weight:600;overflow-wrap:anywhere}
      .wb-report-list{margin:0;padding-left:17px;font-size:12px;line-height:1.6}
      .wb-report-list li{margin:3px 0;overflow-wrap:anywhere}
      .wb-report-list.wb-warn-list li{color:var(--dsw-alias-state-warn-primary)}
      .wb-artifact{display:flex;gap:8px;align-items:baseline;font-size:11px;margin:2px 0}
      .wb-artifact code{font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
      .wb-artifact span{flex:0 0 auto;color:var(--dsw-alias-label-secondary);font-size:10px}
      .wb-stats{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:11px;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-stats b{color:var(--dsw-alias-label-primary);font-weight:650}
      .wb-decisions-cards{display:grid;gap:8px;margin-bottom:10px}
      .wb-decision-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 11px;background:var(--dsw-alias-bg-base)}
      .wb-decision-title{font-size:12px;font-weight:650;line-height:1.45;overflow-wrap:anywhere}
      .wb-decision-stamp{margin-top:2px;color:var(--dsw-alias-label-secondary);font:10px ui-monospace,SFMono-Regular,Consolas,monospace}
      .wb-decision-part{margin-top:6px;font-size:11px;line-height:1.55;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
      .wb-decision-part b{display:inline-block;min-width:36px;color:var(--dsw-alias-label-primary);font-weight:700}
      .wb-day{margin-bottom:11px}
      .wb-day-title{margin-bottom:5px;font-size:10px;font-weight:750;letter-spacing:.06em;color:var(--dsw-alias-label-secondary)}
      .wb-audit{display:grid;gap:5px;max-height:260px;overflow:auto}
      .wb-audit-item{display:flex;gap:8px;align-items:baseline;font-size:11px;color:var(--dsw-alias-label-secondary)}
      .wb-audit-action{flex:0 0 auto;font:700 10px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-brand-primary)}
      .wb-audit-action[data-action$="failed"],.wb-audit-action[data-action$="error"]{color:var(--dsw-alias-state-error-primary)}
      .wb-audit-time{flex:0 0 auto;font:10px ui-monospace,SFMono-Regular,Consolas,monospace}
      .wb-audit-summary{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .wb-metrics{display:flex;flex-wrap:wrap;gap:6px 20px;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-metrics b{color:var(--dsw-alias-label-primary);font-weight:650;font-size:13px}
      .wb-decision-form{display:grid;gap:7px;margin-top:10px}
      .wb-decision-form textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 9px;font:inherit;font-size:12px;min-height:54px;resize:vertical;outline:none}
      .wb-foot{margin-top:14px;color:var(--dsw-alias-label-secondary);font-size:10px}
      .wb-error-card{padding:20px;text-align:center;color:var(--dsw-alias-state-error-primary);font-size:12px}
      @media(max-width:720px){.wb-page{padding:16px 12px 32px}.wb-bar{flex-direction:column;align-items:flex-start}.wb-bar-right{width:100%;justify-content:space-between}.wb-form-actions{flex-direction:column;align-items:stretch}}
    `

    function asList(value) {
      if (Array.isArray(value)) return value.filter(Boolean).map(String)
      if (typeof value === 'string') {
        return value.split(/\r?\n|;/).map(item => item.replace(/^[-•\d.)\s]+/, '').trim()).filter(Boolean)
      }
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
    function formatDuration(ms) {
      const value = Number(ms)
      if (!Number.isFinite(value) || value <= 0) return '—'
      return formatElapsed(0, value).replace(/^0s$/, '<1s')
    }

    // decisions.md is markdown written by the agent, not a report. Turn each
    // `### <stamp>` block into a card and split the labelled sentences out, so a
    // human reads "背景 / 决定 / 代价" instead of a wall of prose.
    function parseDecisions(text) {
      const blocks = String(text || '').replace(/\r\n/g, '\n').split(/^###[ \t]*/m).slice(1)
      const cards = []
      for (const block of blocks) {
        const lines = block.split('\n')
        const stamp = String(lines.shift() || '').trim()
        const body = lines.join('\n').trim()
        if (!body) continue
        const firstLine = body.split('\n')[0].replace(/[*`#]/g, '').trim()
        const title = firstLine.length > 110 ? firstLine.slice(0, 110) + '…' : firstLine
        const pattern = /(背景|决定|代价|判断|结论)[ \t]*[：:]/g
        const marks = []
        let match = pattern.exec(body)
        while (match) {
          marks.push({ label: match[1], start: match.index, end: match.index + match[0].length })
          match = pattern.exec(body)
        }
        const parts = []
        for (let index = 0; index < marks.length; index++) {
          const stop = index + 1 < marks.length ? marks[index + 1].start : body.length
          const value = body.slice(marks[index].end, stop).trim()
          if (value) parts.push({ label: marks[index].label, text: value })
        }
        cards.push({ stamp, title, parts, body })
      }
      return cards
    }

    function groupByDay(entries) {
      const groups = []
      for (const entry of entries) {
        const stamp = String(entry?.ts || '')
        const day = stamp.slice(0, 10) || '—'
        let group = groups.find(item => item.day === day)
        if (!group) { group = { day, entries: [] }; groups.push(group) }
        group.entries.push(entry)
      }
      return groups
    }

    function WorkbenchPanel({ t, sessionId }) {
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [tab, setTab] = React.useState('run')
      const [goal, setGoal] = React.useState('')
      const [plan, setPlan] = React.useState('')
      const [instruction, setInstruction] = React.useState('')
      const [model, setModel] = React.useState('')
      const [sessionTarget, setSessionTarget] = React.useState('')
      const [modulePicker, setModulePicker] = React.useState('')
      const [moduleTitle, setModuleTitle] = React.useState('')
      const [moduleBusy, setModuleBusy] = React.useState(false)
      const [moduleNotice, setModuleNotice] = React.useState('')
      const [usedModuleIds, setUsedModuleIds] = React.useState([])
      const [preview, setPreview] = React.useState(null)
      const [dryRun, setDryRun] = React.useState(null)
      const [dispatchBusy, setDispatchBusy] = React.useState(false)
      const [dispatchError, setDispatchError] = React.useState('')
      const [reusedNotice, setReusedNotice] = React.useState('')
      const [catalog, setCatalog] = React.useState(null)
      const [runs, setRuns] = React.useState([])
      const [sessions, setSessions] = React.useState([])
      const [modules, setModules] = React.useState([])
      const [templates, setTemplates] = React.useState([])
      const [templateId, setTemplateId] = React.useState('')
      const [templateTitle, setTemplateTitle] = React.useState('')
      const [templateNotice, setTemplateNotice] = React.useState('')
      const [templateBusy, setTemplateBusy] = React.useState(false)
      const [selectedRunId, setSelectedRunId] = React.useState('')
      const [report, setReport] = React.useState(null)
      const [audit, setAudit] = React.useState([])
      const [editOpen, setEditOpen] = React.useState(false)
      const [draft, setDraft] = React.useState({ mainline: '', stopped_at: '', next: '', red_lines: '' })
      const [saving, setSaving] = React.useState(false)
      const [saveError, setSaveError] = React.useState('')
      const [decisionDraft, setDecisionDraft] = React.useState('')
      const [decisionBusy, setDecisionBusy] = React.useState(false)
      const [decisionNotice, setDecisionNotice] = React.useState('')
const [momentOverride, setMomentOverride] = React.useState('')
      const [momentNotice, setMomentNotice] = React.useState('')
      const [syncText, setSyncText] = React.useState('')
      const [channel, setChannel] = React.useState(null)
      const [syncBusy, setSyncBusy] = React.useState(false)
      const [syncNotice, setSyncNotice] = React.useState('')
      const [liveState, setLiveState] = React.useState(null)
      const [closeDraft, setCloseDraft] = React.useState({ next: '', outcome: 'yellow', decision: '', title: '' })
      const [closeBusy, setCloseBusy] = React.useState(false)
      const [closeNotice, setCloseNotice] = React.useState('')
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
          const [response, modelsResponse, auditResponse, runsResponse, sessionsResponse, modulesResponse, templatesResponse] = await Promise.all([
            fetch('/dsh-workbench/api/state-v2', { cache: 'no-store', credentials: 'same-origin' }),
            fetch('/dsh-workbench/api/models', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
            fetch('/dsh-workbench/api/audit?limit=40', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
            fetch('/dsh-workbench/api/runs', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
            fetch('/dsh-workbench/api/sessions', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
            fetch('/dsh-workbench/api/modules', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
            fetch('/dsh-workbench/api/templates', { cache: 'no-store', credentials: 'same-origin' }).catch(() => null),
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
          if (sessionsResponse && sessionsResponse.ok) {
            try {
              const payload = await sessionsResponse.json()
              if (payload && Array.isArray(payload.items)) setSessions(payload.items)
            } catch { /* keep previous sessions */ }
          }
          if (modulesResponse && modulesResponse.ok) {
            try {
              const payload = await modulesResponse.json()
              if (payload && Array.isArray(payload.items)) setModules(payload.items)
            } catch { /* keep previous modules */ }
          }
          if (templatesResponse && templatesResponse.ok) {
            try {
              const payload = await templatesResponse.json()
              if (payload && Array.isArray(payload.items)) setTemplates(payload.items)
            } catch { /* keep previous templates */ }
          }
          if (runsResponse && runsResponse.ok) {
            try {
              const payload = await runsResponse.json()
              if (payload && payload.ok === true) {
                applyRuns(payload.items)
                const last = Array.isArray(payload.items) ? payload.items[0] : null
                // Prefill once from the previous dispatch: an empty form every
                // time is exactly what makes the panel feel like busywork.
                if (!prefilled.current && last) {
                  prefilled.current = true
                  setGoal(String(last.goal || ''))
                  setPlan(String(last.plan || ''))
                  setInstruction(String(last.instruction || ''))
                }
              }
            } catch { /* keep previous runs */ }
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

const boundSessionId = String(sessionId || '').trim()

      // One request shape for the flow routes: a 409 carries a decision, not an
      // error string, so the caller must be able to read the payload either way.
      async function postJsonStatus(path, body) {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        })
        let payload = null
        try { payload = await response.json() } catch { /* non-JSON */ }
        return { status: response.status, payload: payload || null, ok: Boolean(response.ok && payload && payload.ok === true) }
      }

      async function decideChannel(text) {
        const trimmed = String(text || '').trim()
        if (!trimmed) { setChannel(null); return }
        try {
          const result = await postJsonStatus('/dsh-workbench/api/channel', { text: trimmed })
          if (result.ok) setChannel(result.payload)
        } catch { /* keep the previous decision */ }
      }

      async function loadLive() {
        if (!boundSessionId) { setLiveState(null); return }
        try {
          const response = await fetch('/dsh-workbench/api/live?sessionId=' + encodeURIComponent(boundSessionId), { cache: 'no-store', credentials: 'same-origin' })
          const payload = await response.json()
          if (payload && payload.ok === true) setLiveState(payload)
        } catch { /* keep the previous live state */ }
      }

      async function submitSync() {
        const trimmed = syncText.trim()
        if (!trimmed || syncBusy) return
        if (!boundSessionId) { setSyncNotice(t('sessionMissing')); return }
        setSyncBusy(true); setSyncNotice('')
        try {
          const result = await postJsonStatus('/dsh-workbench/api/sync', { sessionId: boundSessionId, text: trimmed })
          if (result.payload?.code === 'channel-async') {
            setChannel(result.payload)
            setSyncNotice(t('syncRefused') + ' ' + String(result.payload.reasons?.[0] || ''))
            return
          }
          if (!result.ok) { setSyncNotice(String(result.payload?.error || ('HTTP ' + result.status))); return }
          setSyncText(''); setSyncNotice(t('syncQueued'))
          await loadLive()
        } catch (failure) {
          setSyncNotice(String(failure?.message || failure))
        } finally { setSyncBusy(false) }
      }

      async function submitClose() {
        if (closeBusy) return
        if (!closeDraft.next.trim()) { setCloseNotice(t('closeNeedsNext')); return }
        setCloseBusy(true); setCloseNotice('')
        try {
          const result = await postJsonStatus('/dsh-workbench/api/close', {
            next: closeDraft.next,
            outcome: closeDraft.outcome,
            decision: closeDraft.decision,
            title: closeDraft.title,
            runId: latestRun?.runId || '',
          })
          if (!result.ok) { setCloseNotice(String(result.payload?.error || ('HTTP ' + result.status))); return }
          setCloseDraft({ next: '', outcome: 'yellow', decision: '', title: '' })
          setCloseNotice(t('closeDone'))
          await load()
        } catch (failure) {
          setCloseNotice(String(failure?.message || failure))
        } finally { setCloseBusy(false) }
      }

      async function bindProject() {
        if (!boundSessionId) { setMomentNotice(t('sessionMissing')); return }
        try {
          await postJson('/dsh-workbench/api/memory', { sessionId: boundSessionId })
          setMomentNotice(t('memoryActivateDone'))
          await load()
        } catch (failure) { setMomentNotice(String(failure?.message || failure)) }
      }

      const latestRun = runs[0] || null
      const selectedRun = runs.find(item => item && item.runId === selectedRunId) || latestRun
      const selectedKey = selectedRun ? selectedRun.runId + ':' + selectedRun.status + ':' + (selectedRun.updatedAt || 0) : ''

      // The report is what the history tab paints; keeping it server-side means
      // the raw reply and the digest never disagree about which run they cover.
      React.useEffect(() => {
        if (!selectedRun) return
        let alive = true
        const runId = selectedRun.runId
        fetch('/dsh-workbench/api/report?runId=' + encodeURIComponent(runId), { cache: 'no-store', credentials: 'same-origin' })
          .then(response => response.json())
          .then(payload => { if (alive && payload && payload.ok === true) setReport(payload) })
          .catch(() => { /* keep previous report */ })
        return () => { alive = false }
      }, [selectedKey])

      function makePreview(event) {
        event?.preventDefault?.()
        const local = { goal: goal.trim(), plan: plan.trim(), instruction: instruction.trim(), model, sessionId: sessionTarget }
        setPreview(local); setDispatchError('')
        postJson('/dsh-workbench/api/dispatch', { ...local, moduleIds: usedModuleIds, templateId: templateId || '', dryRun: true })
          .then(payload => setDryRun(payload))
          .catch(failure => setDryRun({ ok: false, available: false, error: String(failure?.message || t('dispatchFailed')) }))
      }

      function clearForm() {
        setGoal(''); setPlan(''); setInstruction(''); setPreview(null); setDryRun(null)
        setDispatchError(''); setUsedModuleIds([]); setReusedNotice('')
      }

      async function confirmDispatch() {
        setDispatchBusy(true); setDispatchError('')
        try {
          const payload = await postJson('/dsh-workbench/api/dispatch', {
            goal: goal.trim(), plan: plan.trim(), instruction: instruction.trim(), model,
            sessionId: sessionTarget, moduleIds: usedModuleIds,
            ...(templateId ? { templateId } : {}),
          })
          if (payload.warning) setDispatchError(payload.warning)
          if (payload.run) {
            setRuns(previous => [payload.run, ...previous.filter(item => item.runId !== payload.run.runId)])
            setSelectedRunId(payload.run.runId)
            setTab('run')
          }
          setPreview(null); setDryRun(null); setUsedModuleIds([])
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
          const payload = await postJson('/dsh-workbench/api/runs/cancel', run.orphaned
            ? { runId: run.runId, archive: true }
            : { runId: run.runId })
          if (payload.run) setRuns(previous => previous.map(item => (item.runId === payload.run.runId ? payload.run : item)))
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
          next: asList(state.next).join('\n'),
          red_lines: asList(state.red_lines || state.redLines).join('\n'),
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

      function slotText(kind) {
        return kind === 'goal' ? goal : kind === 'plan' ? plan : instruction
      }
      function setSlotText(kind, value) {
        if (kind === 'goal') setGoal(value)
        else if (kind === 'plan') setPlan(value)
        else setInstruction(value)
      }
      function insertModule(module) {
        const current = slotText(module.kind)
        setSlotText(module.kind, current.trim() ? current.trim() + '\n' + module.text : module.text)
        setUsedModuleIds(ids => (ids.includes(module.id) ? ids : ids.concat(module.id)))
        setModulePicker(''); setModuleNotice('')
      }
      async function saveModule(kind) {
        const text = slotText(kind).trim()
        if (!text) return
        const title = moduleTitle.trim() || text.split('\n')[0].slice(0, 40)
        setModuleBusy(true); setModuleNotice('')
        try {
          const payload = await postJson('/dsh-workbench/api/modules', { kind, title, text })
          if (Array.isArray(payload.items)) setModules(payload.items)
          setModuleTitle(''); setModuleNotice(t('moduleSaved'))
        } catch (failure) {
          setModuleNotice(String(failure?.message || t('moduleFailed')))
        } finally { setModuleBusy(false) }
      }
      function useLastRun() {
        if (!latestRun) return
        setGoal(String(latestRun.goal || ''))
        setPlan(String(latestRun.plan || ''))
        setInstruction(String(latestRun.instruction || ''))
        setReusedNotice(t('reusedNotice'))
      }
      function reuseRun(reportValue) {
        const run = reportValue?.run || {}
        setGoal(String(run.goal || ''))
        setPlan(String(run.plan || ''))
        setInstruction(String(run.instruction || ''))
        setReusedNotice(t('reusedNotice'))
        setTab('task')
      }

      // ---- templates: a saved recipe fills every slot in one action ----------
      function applyTemplate(id) {
        setTemplateId(id)
        setTemplateNotice('')
        if (!id) return
        const template = templates.find(item => item.id === id)
        if (!template) return
        setGoal(String(template.goal || ''))
        setPlan(String(template.plan || ''))
        setInstruction(String(template.instruction || ''))
        setUsedModuleIds(Array.isArray(template.moduleIds) ? template.moduleIds.slice(0, 20) : [])
        if (template.model) setModel(String(template.model))
        setSessionTarget('')
        setPreview(null); setDryRun(null)
        setTemplateTitle(String(template.title || ''))
      }
      async function saveTemplate() {
        const goalText = goal.trim()
        if (!goalText) { setTemplateNotice(t('templateNeedsGoal')); return }
        const title = templateTitle.trim() || goalText.split('\n')[0].slice(0, 40)
        setTemplateBusy(true); setTemplateNotice('')
        try {
          const payload = await postJson('/dsh-workbench/api/templates', {
            ...(templateId ? { id: templateId } : {}),
            title,
            goal: goalText,
            plan,
            instruction,
            moduleIds: usedModuleIds,
            model,
            sessionMode: sessionTarget ? 'existing' : 'new',
          })
          if (Array.isArray(payload.items)) setTemplates(payload.items)
          if (payload.template?.id) setTemplateId(payload.template.id)
          setTemplateTitle(payload.template?.title || title)
          setTemplateNotice(t('templateSaved'))
        } catch (failure) {
          setTemplateNotice(String(failure?.message || t('templateFailed')))
        } finally { setTemplateBusy(false) }
      }
      async function removeTemplate() {
        if (!templateId) return
        setTemplateBusy(true); setTemplateNotice('')
        try {
          const payload = await postJson('/dsh-workbench/api/templates', { id: templateId, remove: true })
          if (Array.isArray(payload.items)) setTemplates(payload.items)
          setTemplateId(''); setTemplateTitle(''); setTemplateNotice(t('templateRemoved'))
        } catch (failure) {
          setTemplateNotice(String(failure?.message || t('templateFailed')))
        } finally { setTemplateBusy(false) }
      }

      const state = data?.state || {}
      const next = asList(state.next)
      const redlines = asList(state.red_lines || state.redLines)
      const tasks = Array.isArray(data?.tasks) ? data.tasks : []
      const decisions = String(data?.decisions || '').trim()
      const execution = data?.execution || {}
      const canDispatch = Boolean(execution.controller && execution.enabled)
      const live = runs.some(item => item && item.status === 'running')
      const memoryPayload = data?.memory || null
      const memory = memoryPayload?.memory || null
      const gapOpen = Boolean(memory?.gap?.open)
      const sessionActive = Boolean(liveState?.running)
      const activeMoment = momentOverride || (live || sessionActive ? 'work' : gapOpen ? 'close' : 'attach')

      // The working moment reads the current session's own progress; the attach
      // moment asks the Host which channel a task belongs to before any click.
      React.useEffect(() => {
        if (activeMoment !== 'work' || !boundSessionId) return undefined
        loadLive()
        const timer = setInterval(() => { loadLive() }, 5000)
        return () => clearInterval(timer)
      }, [activeMoment, boundSessionId])
      React.useEffect(() => {
        const timer = setTimeout(() => { decideChannel(syncText) }, 350)
        return () => clearTimeout(timer)
      }, [syncText])
      const statusLabel = status => status === 'running' ? t('running')
        : status === 'done' ? t('done')
          : status === 'cancelled' ? t('cancelled')
            : status === 'error' ? t('failed') : t('unknown')
      const actionLabel = action => {
        const key = 'action_' + String(action || '').replace(/[./]/g, '_')
        const text = t(key)
        return text === key ? String(action || '—') : text
      }

      const bar = h('header', { className: 'wb-bar' },
        h('div', { className: 'wb-bar-left' },
          h('span', { className: 'wb-dot', 'data-state': live || sessionActive ? 'running' : 'idle', 'aria-hidden': true }),
          h('strong', { className: 'wb-bar-title' }, t('title')),
          memoryPayload?.name ? h('span', { className: 'wb-muted' }, String(memoryPayload.name)) : null),
        h('div', { className: 'wb-bar-right' },
          h('span', { className: 'wb-chip' }, canDispatch ? t('execOn') : t('execOff')),
          h('button', { className: 'wb-button', type: 'button', onClick: load, disabled: busy }, busy ? t('loading') : t('refresh'))))

const momentButton = (id, label) => h('button', {
        className: 'wb-moment', type: 'button',
        'data-moment': id, 'data-active': activeMoment === id ? 'true' : 'false',
        'aria-pressed': activeMoment === id,
        title: t('momentHint'),
        onClick: () => setMomentOverride(id),
      }, label)

      const moments = h('div', { className: 'wb-moments', role: 'group', 'aria-label': t('momentHint') },
        momentButton('attach', t('momentAttach')),
        momentButton('work', t('momentWork')),
        momentButton('close', t('momentClose')),
        momentOverride
          ? h('button', {
            className: 'wb-moment wb-moment-reset', type: 'button', title: t('momentHint'),
            onClick: () => setMomentOverride(''),
          }, '↺')
          : null)

      // ---- run tab -----------------------------------------------------------
      const runMeta = run => [
        run.templateTitle && h('span', { key: 'template' }, t('templateLabel') + ' ', h('b', null, run.templateTitle)),
        h('span', { key: 'session' }, t('session') + ' ', h('b', null, run.sessionId || '—')),
        h('span', { key: 'model' }, t('model') + ' ', h('b', null, run.model || '—')),
        h('span', { key: 'started' }, t('started') + ' ', h('b', null, formatClock(run.createdAt))),
        run.status === 'running' && formatElapsed(run.createdAt, Date.now())
          ? h('span', { key: 'elapsed' }, t('duration') + ' ', h('b', null, formatElapsed(run.createdAt, Date.now())))
          : null,
        Number.isFinite(Number(run.steps)) ? h('span', { key: 'steps' }, h('b', null, String(run.steps)), ' ' + t('steps')) : null,
        Number.isFinite(Number(run.toolCalls)) ? h('span', { key: 'tools' }, h('b', null, String(run.toolCalls)), ' ' + t('toolCalls')) : null,
        h('span', { key: 'cwd' }, t('sessionWorkspace') + ' ', h('b', null, run.cwd || '—')),
      ].filter(Boolean)

      const runCard = latestRun
        ? h('section', { className: 'wb-card wb-run' },
          h('div', { className: 'wb-run-head' },
            h('div', { className: 'wb-run-badges' },
              h('span', { className: 'wb-chip' + (latestRun.orphaned ? ' wb-warn' : ''), 'data-status': latestRun.orphaned ? 'orphaned' : latestRun.status }, latestRun.orphaned ? t('orphanedChip') : statusLabel(latestRun.status)),
              latestRun.status === 'running' && latestRun.waiting && h('span', { className: 'wb-chip wb-warn' }, t('waiting')),
              h('h2', { style: { margin: 0 } }, t('currentRun'))),
            h('div', { className: 'wb-actions' },
              latestRun.orphaned
                ? h('button', {
                  className: 'wb-button', type: 'button', onClick: () => cancelRun(latestRun), disabled: dispatchBusy,
                }, t('archiveRun'))
                : (latestRun.status === 'running' && h('button', {
                  className: 'wb-button', type: 'button', onClick: () => cancelRun(latestRun), disabled: dispatchBusy,
                }, t('cancelRun'))),
              h('button', { className: 'wb-button', type: 'button', onClick: () => { setSelectedRunId(latestRun.runId); setTab('history') } }, t('reportTitle')))),
          h('div', { className: 'wb-run-goal' }, latestRun.goal || t('notSet')),
          h('div', { className: 'wb-meta' }, runMeta(latestRun)),
          latestRun.orphaned
            ? h('div', { className: 'wb-note wb-warn', style: { marginTop: 8 } }, t('orphanedHint'))
            : null,
          latestRun.status === 'running' && latestRun.waiting && !latestRun.orphaned
            ? h('div', { className: 'wb-note wb-warn', style: { marginTop: 8 } }, String(t('waitingHint')).replace('{cwd}', latestRun.cwd || t('notSet')))
            : null,
          report && report.run && report.run.runId === latestRun.runId
            ? h('div', { className: 'wb-report-block' },
              h('div', { className: 'wb-report-label' }, t('conclusion')),
              h('div', { className: 'wb-report-conclusion' }, report.conclusion))
            : h('div', { className: 'wb-note', style: { marginTop: 10 } }, latestRun.status === 'running' ? t('noReplyYet') : t('noReply')),
          dispatchError && h('div', { className: 'wb-note wb-error', style: { marginTop: 8 }, role: 'alert' }, dispatchError))
        : h('section', { className: 'wb-card wb-run' },
          h('div', { className: 'wb-empty' }, t('runEmpty')),
          h('div', { className: 'wb-actions', style: { marginTop: 10 } },
            h('button', { className: 'wb-button wb-button-primary', type: 'button', onClick: () => setTab('task') }, t('goToTask'))))

      // ---- task tab ----------------------------------------------------------
      const modelField = h('div', { className: 'wb-field' },
        h('label', { htmlFor: 'wb-model' }, t('modelLabel')),
        h('select', { id: 'wb-model', value: model, onChange: event => setModel(event.target.value) },
          h('option', { value: '' }, t('defaultModel')),
          (catalog?.groups || []).map(group => h('optgroup', { key: group.id, label: group.name || group.id },
            (group.models || []).map(item => h('option', {
              key: group.id + '/' + item.id, value: group.id + '/' + item.id,
            }, item.name || item.id))))),
        catalog && catalog.available === false && h('span', { className: 'wb-note' }, t('modelsUnavailable')))

      const sessionField = h('div', { className: 'wb-field' },
        h('label', { htmlFor: 'wb-session' }, t('sessionTarget')),
        h('select', { id: 'wb-session', value: sessionTarget, onChange: event => setSessionTarget(event.target.value) },
          h('option', { value: '' }, t('newSession')),
          sessions.map(item => h('option', { key: item.sessionId, value: item.sessionId },
            (item.title || item.sessionId.slice(0, 16)) + (item.running ? ' · ' + t('running') : '')))),
        h('span', { className: 'wb-note' }, t('sessionHint')))

      // A template is the difference between "pieces exist" and "reuse is cheaper
      // than retyping": one choice fills every slot below.
      const templateField = h('div', { className: 'wb-field wb-template' },
        h('label', { htmlFor: 'wb-template' }, t('templateLabel')),
        h('div', { className: 'wb-actions' },
          h('select', {
            id: 'wb-template', value: templateId,
            onChange: event => applyTemplate(event.target.value),
          },
            h('option', { value: '' }, t('noTemplate')),
            templates.map(item => h('option', { key: item.id, value: item.id },
              item.title + (Number(item.uses) ? ' · ' + String(t('templateUses')).replace('{n}', String(item.uses)) : '')))),
          h('input', {
            id: 'wb-template-title', value: templateTitle, placeholder: t('templateTitle'),
            onChange: event => setTemplateTitle(event.target.value),
            style: { flex: '1 1 140px', minWidth: 0 },
          }),
          h('button', { className: 'wb-button', type: 'button', onClick: saveTemplate, disabled: templateBusy || !goal.trim() }, t('saveTemplate')),
          templateId && h('button', { className: 'wb-mini', type: 'button', onClick: removeTemplate, disabled: templateBusy }, t('deleteTemplate'))),
        h('span', { className: 'wb-note' }, templates.length ? t('templateHint') : t('templateEmpty')),
        templateNotice && h('div', { className: 'wb-note' }, templateNotice))

      const modulePickerFor = kind => {
        if (modulePicker !== kind) return null
        const items = modules.filter(item => item && item.kind === kind)
        return h('div', { className: 'wb-picker' },
          items.length
            ? items.map(item => h('div', { className: 'wb-picker-item', key: item.id },
              h('div', { className: 'wb-picker-text' },
                h('div', { className: 'wb-picker-title' }, item.title || item.id),
                h('div', { className: 'wb-picker-body' }, String(item.text || '').slice(0, 160))),
              h('button', { className: 'wb-mini', type: 'button', onClick: () => insertModule(item) }, t('insertModule'))))
            : h('div', { className: 'wb-note' }, t('moduleEmpty')),
          h('div', { className: 'wb-actions' },
            h('input', {
              id: 'wb-module-title', value: moduleTitle, placeholder: t('moduleTitle'),
              onChange: event => setModuleTitle(event.target.value),
              style: { flex: '1 1 160px', minWidth: 0 },
            }),
            h('button', {
              className: 'wb-button', type: 'button',
              disabled: moduleBusy || !slotText(kind).trim(),
              onClick: () => saveModule(kind),
            }, t('saveModule')),
            h('button', { className: 'wb-mini', type: 'button', onClick: () => setModulePicker('') }, t('close'))),
          moduleNotice && h('div', { className: 'wb-note' }, moduleNotice))
      }

      const slot = (kind, label, control) => h('div', { className: 'wb-slot' },
        h('div', { className: 'wb-slot-head' },
          h('label', { htmlFor: 'wb-' + kind }, label),
          h('div', { className: 'wb-slot-tools' },
            h('button', { className: 'wb-mini', type: 'button', onClick: () => setModulePicker(modulePicker === kind ? '' : kind) }, t('insertModule')),
            h('button', { className: 'wb-mini', type: 'button', onClick: () => saveModule(kind), disabled: !slotText(kind).trim() }, t('saveModule')),
            modules.length === 0 && h('span', { className: 'wb-note' }, t('noModulesYet')))),
        control,
        modulePickerFor(kind))

      const confirmButtons = h('div', { className: 'wb-actions' },
        h('button', { className: 'wb-button', type: 'button', onClick: () => { setPreview(null); setDryRun(null) } }, t('cancel')),
        canDispatch && h('button', {
          className: 'wb-button wb-button-primary', type: 'button', onClick: confirmDispatch,
          disabled: dispatchBusy || !goal.trim(),
        }, dispatchBusy ? t('saving') : t('confirm')))

      const confirmBlock = preview && h('div', { className: 'wb-confirm' },
        h('div', { className: 'wb-confirm-title' }, t('previewReady')),
        h('div', { className: 'wb-meta' },
          h('span', null, t('model') + ' ', h('b', null, preview.model || t('defaultModel'))),
          h('span', null, t('sessionTarget') + ' ', h('b', null, preview.sessionId || t('newSession'))),
          h('span', null, t('sessionWorkspace') + ' ', h('b', null, execution.cwd || '—'))),
        confirmButtons,
        !canDispatch && h('div', { className: 'wb-note wb-warn' }, execution.controller ? t('execOffHint') : t('noController')),
        dryRun?.prompt && h('details', { className: 'wb-prompt' },
          h('summary', null, t('showPrompt')),
          h('pre', null, dryRun.prompt)),
        dispatchError && h('div', { className: 'wb-note wb-error', role: 'alert' }, dispatchError))

      const taskForm = h('form', { onSubmit: makePreview },
        h('p', { className: 'wb-hint' }, t('composeHint')),
        templateField,
        h('div', { style: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' } },
          sessionField, modelField),
        slot('goal', t('goal'), h('input', {
          id: 'wb-goal', value: goal, placeholder: t('goalPlaceholder'),
          onChange: event => setGoal(event.target.value),
        })),
        slot('plan', t('plan'), h('textarea', {
          id: 'wb-plan', value: plan, placeholder: t('planPlaceholder'),
          onChange: event => setPlan(event.target.value),
        })),
        slot('instruction', t('instruction'), h('textarea', {
          id: 'wb-instruction', value: instruction, placeholder: t('instructionPlaceholder'),
          onChange: event => setInstruction(event.target.value),
        })),
        h('div', { className: 'wb-form-actions' },
          h('div', { className: 'wb-actions' },
            h('button', { className: 'wb-button', type: 'button', onClick: useLastRun, disabled: !latestRun }, t('useLast')),
            h('button', { className: 'wb-button', type: 'button', onClick: clearForm }, t('clear')),
            reusedNotice && h('span', { className: 'wb-note' }, reusedNotice)),
          h('div', { className: 'wb-actions' },
            h('span', { className: 'wb-note' }, canDispatch ? '' : (execution.controller ? t('execOffHint') : t('noController'))),
            h('button', { className: 'wb-button wb-button-primary', type: 'submit' }, t('preview')))),
        confirmBlock)

      const taskView = h('section', { className: 'wb-card wb-compose' },
        h('h2', null, t('compose')),
        taskForm)

      // ---- history tab -------------------------------------------------------
      const historyList = runs.length
        ? h('ul', { className: 'wb-run-list' }, runs.slice(0, 20).map(item => h('li', { key: item.runId },
          h('button', {
            className: 'wb-run-row', type: 'button',
            'data-active': item.runId === (selectedRun?.runId || '') ? 'true' : 'false',
            onClick: () => setSelectedRunId(item.runId),
          },
            h('span', { className: 'wb-run-dot', 'data-status': item.status, 'aria-hidden': true }),
            h('span', { className: 'wb-run-row-goal' }, item.goal || t('notSet')),
            item.templateTitle && h('span', { className: 'wb-run-row-tpl' }, item.templateTitle),
            h('span', { className: 'wb-run-row-meta' }, statusLabel(item.status) + ' · ' + formatClock(item.createdAt))))))
        : h('div', { className: 'wb-empty' }, t('runEmpty'))

      const reportCard = report && report.run && report.run.runId === (selectedRun?.runId || '')
        ? h('section', { className: 'wb-card wb-report' },
          h('div', { className: 'wb-run-head' },
            h('div', { className: 'wb-run-badges' },
              h('span', { className: 'wb-chip', 'data-status': report.run.status }, statusLabel(report.run.status)),
              report.run.waiting && h('span', { className: 'wb-chip wb-warn' }, t('waiting')),
              h('h2', { style: { margin: 0 } }, t('reportTitle'))),
            h('div', { className: 'wb-actions' },
              h('button', { className: 'wb-button', type: 'button', onClick: () => reuseRun(report) }, t('reuseRun')))),
          h('div', { className: 'wb-run-goal' }, report.run.goal || t('notSet')),
          h('div', { className: 'wb-meta' },
            h('span', null, t('session') + ' ', h('b', null, report.run.sessionId || '—')),
            h('span', null, t('model') + ' ', h('b', null, report.run.model || '—')),
            h('span', null, t('started') + ' ', h('b', null, formatClock(report.run.createdAt))),
            h('span', null, t('duration') + ' ', h('b', null, formatDuration(report.stats?.durationMs)))),
          h('div', { className: 'wb-report-block' },
            h('div', { className: 'wb-report-label' }, t('conclusion')),
            h('div', { className: 'wb-report-conclusion' }, report.conclusion || t('noReply'))),
          h('div', { className: 'wb-report-block' },
            h('div', { className: 'wb-report-label' }, t('points')),
            Array.isArray(report.points) && report.points.length
              ? h('ul', { className: 'wb-report-list' }, report.points.map((item, index) => h('li', { key: index }, item)))
              : h('div', { className: 'wb-note' }, t('noPoints'))),
          h('div', { className: 'wb-report-block' },
            h('div', { className: 'wb-report-label' }, t('artifacts')),
            Array.isArray(report.artifacts) && report.artifacts.length
              ? h('div', null, report.artifacts.map((item, index) => h('div', { className: 'wb-artifact', key: index },
                h('span', null, item.tool || 'tool'),
                h('code', null, item.path))))
              : h('div', { className: 'wb-note' }, t('noArtifacts'))),
          h('div', { className: 'wb-report-block' },
            h('div', { className: 'wb-report-label' }, t('pending')),
            Array.isArray(report.pending) && report.pending.length
              ? h('ul', { className: 'wb-report-list wb-warn-list' }, report.pending.map((item, index) => h('li', { key: index }, item)))
              : h('div', { className: 'wb-note' }, t('noPending'))),
          h('div', { className: 'wb-stats' },
            h('span', null, t('steps') + ' ', h('b', null, String(report.stats?.steps ?? 0))),
            h('span', null, t('toolCalls') + ' ', h('b', null, String(report.stats?.toolCalls ?? 0))),
            h('span', null, t('duration') + ' ', h('b', null, formatDuration(report.stats?.durationMs)))),
          report.reply && h('details', { className: 'wb-prompt' },
            h('summary', null, t('rawReply')),
            h('pre', null, report.reply)),
          h('div', { className: 'wb-note', style: { marginTop: 9 } }, t('reportNote')))
        : h('section', { className: 'wb-card' }, h('div', { className: 'wb-empty' }, t('reportEmpty')))

      const historyView = h('div', null,
        h('section', { className: 'wb-card wb-runs' }, h('h2', null, t('tabHistory')), historyList),
        reportCard)

      // ---- workspace tab -----------------------------------------------------
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

      const decisionCards = parseDecisions(decisions)
      const decisionsView = h('section', { className: 'wb-card wb-decisions-card' },
        h('h2', null, t('decisions')),
        decisionCards.length
          ? h('div', { className: 'wb-decisions-cards' }, decisionCards.slice(0, 12).map((card, index) => h('div', { className: 'wb-decision-card', key: index },
            h('div', { className: 'wb-decision-title' }, card.title || t('notSet')),
            h('div', { className: 'wb-decision-stamp' }, card.stamp),
            card.parts.map((part, partIndex) => h('div', { className: 'wb-decision-part', key: partIndex },
              h('b', null, part.label), part.text)))))
          : h('div', { className: 'wb-note' }, t('noDecisions')),
        h('form', { className: 'wb-decision-form', onSubmit: addDecision },
          h('textarea', {
            id: 'wb-decision', value: decisionDraft, placeholder: t('decisionPlaceholder'),
            onChange: event => setDecisionDraft(event.target.value),
          }),
          h('div', { className: 'wb-actions', style: { justifyContent: 'flex-end' } },
            decisionNotice && h('span', { className: 'wb-note' }, decisionNotice),
            h('button', { className: 'wb-button', type: 'submit', disabled: decisionBusy || !decisionDraft.trim() }, decisionBusy ? t('saving') : t('addDecision')))))

      const auditView = h('section', { className: 'wb-card wb-audit-card' },
        h('h2', null, t('audit')),
        audit.length
          ? h('div', { className: 'wb-audit' }, groupByDay(audit).map(group => h('div', { className: 'wb-day', key: group.day },
            h('div', { className: 'wb-day-title' }, group.day),
            group.entries.map((entry, index) => h('div', { className: 'wb-audit-item', key: index },
              h('span', { className: 'wb-audit-time' }, String(entry.ts || '').slice(11, 19)),
              h('span', { className: 'wb-audit-action', 'data-action': entry.action || '' }, actionLabel(entry.action)),
              h('span', { className: 'wb-audit-summary', title: String(entry.summary || '') }, String(entry.summary || '')))))))
          : h('div', { className: 'wb-note' }, t('auditEmpty')))

      const doneRuns = runs.filter(item => item && item.status === 'done')
      const durations = doneRuns.map(item => (Number(item.updatedAt) || 0) - (Number(item.createdAt) || 0)).filter(ms => ms > 0)
      const stepsList = runs.map(item => Number(item.steps)).filter(value => Number.isFinite(value) && value > 0)
      const templateRunCount = runs.filter(item => item && item.templateId).length
      const average = list => (list.length ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length) : 0)
      const metricsView = h('section', { className: 'wb-card wb-metrics-card' },
        h('h2', null, t('metrics')),
        runs.length
          ? h('div', { className: 'wb-metrics' },
            h('span', null, h('b', null, String(runs.length)), ' ' + t('dispatches')),
            h('span', null, h('b', null, Math.round((doneRuns.length / runs.length) * 100) + '%'), ' ' + t('successRate')),
            h('span', null, h('b', null, durations.length ? formatDuration(average(durations)) : '—'), ' ' + t('avgDuration')),
            h('span', null, h('b', null, stepsList.length ? String(average(stepsList)) : '—'), ' ' + t('avgSteps')),
            templateRunCount > 0 && h('span', null, h('b', null, String(templateRunCount) + ' / ' + String(runs.length)), ' ' + t('templateRuns')))
          : h('div', { className: 'wb-note' }, t('sampleTooSmall')))

      const tasksView = h('section', { className: 'wb-card wb-tasks-card' },
        h('h2', null, t('tasks')),
        tasks.length
          ? h('div', null, tasks.map((item, index) => {
            const task = typeof item === 'object' && item !== null ? item : { goal: String(item) }
            return h('div', { className: 'wb-decision-card', key: index },
              h('div', { className: 'wb-decision-title' }, String(firstValue(task.goal, task.title, task.deliverable, task.text, '—') || '')),
              h('div', { className: 'wb-decision-stamp' }, String(firstValue(task.id, task.name, 'T-' + (index + 1))) + ' · ' + String(firstValue(task.status, ''))))
          }))
          : h('div', { className: 'wb-note' }, t('noTasks')))

      const workspaceView = h('div', null, continuity, decisionsView, auditView, metricsView, tasksView)

      // ---- canvas tab: read-only relations -----------------------------------
      // Everything here is already on disk (modules / templates / runs). The
      // canvas only lays the causal chain out so "which recipe produced which
      // run" is visible at a glance. No new request, no write, no dragging:
      // there is no dependency semantics yet, so faking edges would be a lie.
      const moduleById = new Map(modules.filter(item => item && item.id).map(item => [item.id, item]))
      const runsOfTemplate = templateIdValue => runs.filter(run => run && run.templateId === templateIdValue)
      const plainRuns = runs.filter(run => run && !run.templateId)
      const canvasRuns = (list, limit) => list.slice(0, 3).map(run => h('div', { className: 'wb-canvas-run', key: run.runId },
        h('span', { className: 'wb-run-dot', 'data-status': run.status, 'aria-hidden': true }),
        h('span', { className: 'wb-canvas-run-goal' }, run.goal || t('notSet')),
        h('span', { className: 'wb-canvas-run-meta' }, statusLabel(run.status) + ' · ' + formatClock(run.createdAt))))
      const canvasRow = template => {
        const used = (Array.isArray(template.moduleIds) ? template.moduleIds : []).map(id => {
          const module = moduleById.get(id)
          return module
            ? h('span', { className: 'wb-canvas-node', key: id, 'data-kind': module.kind },
              t(module.kind) + ' · ' + String(module.title || id))
            : h('span', { className: 'wb-canvas-node wb-canvas-missing', key: id }, t('canvasMissingModule') + ' · ' + id)
        })
        const related = runsOfTemplate(template.id)
        return h('div', { className: 'wb-canvas-row', key: template.id },
          h('div', { className: 'wb-canvas-col wb-canvas-nodes' },
            h('div', { className: 'wb-canvas-label' }, t('canvasModules')),
            used.length ? used : h('div', { className: 'wb-note' }, t('canvasNoModules'))),
          h('div', { className: 'wb-canvas-col wb-canvas-recipe' },
            h('div', { className: 'wb-canvas-label' }, t('canvasRecipe')),
            h('div', { className: 'wb-canvas-template' }, template.title),
            h('div', { className: 'wb-note' }, String(t('templateUses')).replace('{n}', String(Number(template.uses) || 0)))),
          h('div', { className: 'wb-canvas-col wb-canvas-runs' },
            h('div', { className: 'wb-canvas-label' }, t('canvasRuns')),
            related.length
              ? h('div', null, canvasRuns(related, 3),
                related.length > 3 && h('div', { className: 'wb-note' }, String(t('canvasMoreRuns')).replace('{n}', String(related.length - 3))))
              : h('div', { className: 'wb-note' }, t('canvasNoRuns'))))
      }
      const canvasView = h('section', { className: 'wb-card wb-canvas' },
        h('h2', null, t('canvasTitle')),
        h('p', { className: 'wb-hint' }, t('canvasHint')),
        templates.length
          ? templates.map(template => canvasRow(template))
          : h('div', { className: 'wb-note' }, t('canvasEmpty')),
        plainRuns.length
          ? h('div', { className: 'wb-canvas-row wb-canvas-plain' },
            h('div', { className: 'wb-canvas-col wb-canvas-nodes' },
              h('div', { className: 'wb-canvas-label' }, t('canvasLoose')),
              h('div', { className: 'wb-note' }, t('canvasLooseHint'))),
            h('div', { className: 'wb-canvas-col wb-canvas-recipe' }, h('div', { className: 'wb-canvas-label' }, t('canvasRecipe')), h('div', { className: 'wb-note' }, t('canvasNoTemplate'))),
            h('div', { className: 'wb-canvas-col wb-canvas-runs' },
              h('div', { className: 'wb-canvas-label' }, t('canvasRuns')),
              h('div', null, canvasRuns(plainRuns, 3),
                plainRuns.length > 3 && h('div', { className: 'wb-note' }, String(t('canvasMoreRuns')).replace('{n}', String(plainRuns.length - 3))))))
          : null)

const memoryCard = h('section', { className: 'wb-card wb-memory' },
        h('div', { className: 'wb-card-head' },
          h('h2', { style: { margin: 0 } }, t('memoryTitle')),
          memoryPayload?.name ? h('span', { className: 'wb-chip' }, String(memoryPayload.name)) : null),
        memoryPayload?.root ? h('div', { className: 'wb-note wb-mono' }, t('memoryRoot') + ' ' + String(memoryPayload.root)) : null,
        memory ? h('div', { style: { marginTop: 8 } },
          h('div', { className: 'wb-mainline' }, String(memory.mainline || t('noData'))),
          memory.stopped_at ? h('div', { className: 'wb-row' }, h('b', null, t('stopped') + ': '), String(memory.stopped_at)) : null,
          asList(memory.next).length
            ? h('div', { className: 'wb-row' }, h('b', null, t('next') + ':'),
              h('ul', null, asList(memory.next).map((item, index) => h('li', { key: index }, item))))
            : null,
          gapOpen ? h('div', { className: 'wb-note wb-warn-note' }, h('b', null, t('memoryGapOpen') + '：'), String(memory.gap?.note || memory.gapNote || '')) : null,
          memory.closedAt ? h('div', { className: 'wb-note' }, t('updated') + ' ' + formatClock(memory.closedAt)) : h('div', { className: 'wb-note' }, t('memoryEmpty')))
          : h('div', { className: 'wb-note' }, t('memoryEmpty')),
        h('div', { className: 'wb-actions', style: { justifyContent: 'flex-end' } },
          boundSessionId
            ? h('button', { className: 'wb-button', type: 'button', onClick: bindProject }, t('memoryActivate'))
            : h('span', { className: 'wb-note' }, t('sessionMissing'))))

      const channelChip = channel
        ? h('span', {
          className: 'wb-chip', 'data-channel': channel.channel,
          title: Array.isArray(channel.reasons) ? channel.reasons.join('\n') : '',
        }, channel.channel === 'sync' ? t('channelSync') : t('channelAsync'))
        : null

      const syncBox = h('section', { className: 'wb-card wb-sync' },
        h('h2', null, t('syncTitle')),
        h('div', { className: 'wb-field' },
          h('textarea', {
            id: 'wb-sync-text', value: syncText, placeholder: t('syncPlaceholder'),
            onChange: event => setSyncText(event.target.value),
          })),
        h('div', { className: 'wb-channel' },
          channelChip,
          channel && Array.isArray(channel.reasons) && channel.reasons.length
            ? h('span', { className: 'wb-note' }, String(channel.reasons[0]))
            : null),
        syncNotice ? h('div', { className: 'wb-note' }, syncNotice) : null,
        h('div', { className: 'wb-actions', style: { justifyContent: 'flex-end' } },
          h('button', {
            className: 'wb-button wb-button-primary', type: 'button', onClick: submitSync,
            disabled: syncBusy || !syncText.trim() || channel?.channel === 'async',
          }, syncBusy ? t('syncBusy') : t('syncGo'))))

      const liveCard = h('section', { className: 'wb-card wb-live' },
        h('div', { className: 'wb-card-head' },
          h('h2', { style: { margin: 0 } }, t('liveTitle')),
          h('span', { className: 'wb-chip', 'data-status': sessionActive ? 'running' : 'idle' }, sessionActive ? t('liveRunning') : t('liveIdle'))),
        boundSessionId
          ? h('div', { className: 'wb-note wb-mono' }, boundSessionId)
          : h('div', { className: 'wb-note' }, t('sessionMissing')),
        liveState
          ? h('div', { className: 'wb-metrics' },
            h('div', null, h('b', null, String(liveState.steps)), ' ' + t('steps')),
            h('div', null, h('b', null, String(liveState.toolCalls)), ' ' + t('toolCalls')),
            liveState.waiting ? h('div', { className: 'wb-chip wb-warn' }, t('waiting')) : null)
          : null,
        liveState && liveState.lastText
          ? h('details', { className: 'wb-prompt' }, h('summary', null, t('rawReply')), h('pre', { className: 'wb-report-raw' }, String(liveState.lastText)))
          : null)

      const closeForm = h('section', { className: 'wb-card wb-close' },
        h('h2', null, t('closeTitle')),
        closeNotice ? h('div', { className: 'wb-note' }, closeNotice) : null,
        h('div', { className: 'wb-field' },
          h('label', { htmlFor: 'wb-close-next' }, t('closeNext')),
          h('textarea', {
            id: 'wb-close-next', value: closeDraft.next, placeholder: t('next'),
            onChange: event => setCloseDraft({ ...closeDraft, next: event.target.value }),
          })),
        h('div', { className: 'wb-field' },
          h('label', { htmlFor: 'wb-close-outcome' }, t('closeOutcome')),
          h('select', {
            id: 'wb-close-outcome', value: closeDraft.outcome,
            onChange: event => setCloseDraft({ ...closeDraft, outcome: event.target.value }),
          },
            h('option', { value: 'green' }, t('outcomeGreen')),
            h('option', { value: 'yellow' }, t('outcomeYellow')),
            h('option', { value: 'red' }, t('outcomeRed')))),
        h('div', { className: 'wb-field' },
          h('label', { htmlFor: 'wb-close-title' }, t('closeDecisionTitle')),
          h('input', {
            id: 'wb-close-title', value: closeDraft.title,
            onChange: event => setCloseDraft({ ...closeDraft, title: event.target.value }),
          })),
        h('div', { className: 'wb-field' },
          h('label', { htmlFor: 'wb-close-decision' }, t('closeDecision')),
          h('textarea', {
            id: 'wb-close-decision', value: closeDraft.decision, placeholder: t('closeDecisionPlaceholder'),
            onChange: event => setCloseDraft({ ...closeDraft, decision: event.target.value }),
          })),
        h('div', { className: 'wb-actions', style: { justifyContent: 'flex-end' } },
          h('button', {
            className: 'wb-button wb-button-primary', type: 'button', onClick: submitClose,
            disabled: closeBusy || !closeDraft.next.trim(),
          }, closeBusy ? t('closeBusy') : t('closeSubmit'))))

      const attachBody = h('div', null,
        memoryCard,
        syncBox,
        channel?.channel === 'async'
          ? h('div', null, taskView)
          : h('details', { className: 'wb-prompt wb-details' }, h('summary', null, t('moreLongJobs')), taskView),
        h('details', { className: 'wb-prompt wb-details' }, h('summary', null, t('continuity')), continuity))

      const workBody = h('div', null,
        liveCard,
        runCard,
        h('details', { className: 'wb-prompt wb-details' }, h('summary', null, t('moreCanvas')), canvasView))

      const closeBody = h('div', null,
        closeForm,
        historyView,
        h('details', { className: 'wb-prompt wb-details' }, h('summary', null, t('memoryDecisions')), decisionsView))

      let body
      if (error) {
        body = h('section', { className: 'wb-card wb-error-card', role: 'alert' },
          h('p', null, t('error')),
          h('button', { className: 'wb-button', type: 'button', onClick: load }, t('retry')))
      } else if (!data) {
        body = h('section', { className: 'wb-card' }, h('div', { className: 'wb-empty' }, t('loading')))
      } else if (activeMoment === 'work') {
        body = workBody
      } else if (activeMoment === 'close') {
        body = closeBody
      } else {
        body = attachBody
      }

      return h('div', { className: 'wb-page' }, h('style', null, CSS),
        h('div', { className: 'wb-wrap' }, bar, moments, momentNotice ? h('div', { className: 'wb-note' }, momentNotice) : null, body))
    }

    // The workbench is a right-column tab, not a main panel: it belongs to the
    // conversation it is attached to and must never replace the chat column.
    const WORKBENCH_TYPE = 'dsh-workbench/workbench'
    const WORKBENCH_KIND = 'workbench'

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dshWorkbench', { en, zh }), 'dsh-workbench locales')
        const t = ctx.locale.bind('dshWorkbench')
        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: WORKBENCH_TYPE,
          kind: WORKBENCH_KIND,
          priority: 'extension',
          title: () => t('title'),
          guide: [{
            id: 'workbench',
            order: 30,
            title: () => t('title'),
            description: () => t('guideDescription'),
          }],
        }), 'dsh-workbench: tab type')
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: WORKBENCH_TYPE,
          locale: 'dshWorkbench',
          // The slot tells a session-scoped body which session it renders, so
          // sync work knows where it belongs without guessing from the URL.
          inject: sessionId => ({ sessionId }),
        }, props => h(WorkbenchPanel, { ...props, t }))), 'dsh-workbench: tab body')
        return () => {}
      },
    }
  },
})