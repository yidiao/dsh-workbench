window.__ModuleLoader__.load({
  id: 'dsh-workbench',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // v2.0.0 —— 工作台是 DSH 上的项目层。
    //   标签只有三个：主页（项目）、配置、每个启用项目一张可关闭的画布 tab。
    //   任务/历史/工作区已按用户决定删除：输入在画布的输入节点里打字，
    //   旧循环折叠成一行，收工是画布页上的一个对话框。
    //   规矩不变：汇报不是原文；绿 = 校验器过且产物在盘；文字一行。

    const EN = {
      title: 'Workbench', subtitle: 'Projects · Methods · Loops',
      home: 'Home', config: 'Config',
      loadError: 'The host answered oddly.', oldHost: 'Still the old host — restart DSH to load v2.', network: 'Cannot reach the host.', retry: 'Retry', loading: 'Loading…',
      projects: 'Projects', newProject: 'New project', createProject: 'Create',
      projName: 'Name', projRoot: 'Root folder (absolute path)',
      openCanvas: 'Open canvas', enable: 'Enable', disable: 'Disable', archive: 'Archive', restore: 'Restore',
      enabledTag: 'enabled', disabledTag: 'off', archivedTag: 'archived',
      recent: 'Recent loops', noRuns: 'No loops yet.',
      cfgModels: 'Models & roles', roleT1: 'Tier 1 · judge', roleT2: 'Tier 2 · refine', roleT3: 'Tier 3 · batch',
      roleUnbound: 'unbound', saveBind: 'Save roles', modelsUnavailable: 'Model catalog unavailable.',
      healthNone: 'no runs yet',
      cfgMethods: 'Method library', methodCap: 'Only exec methods run and can go green.',
      methodNew: 'New method', methodEdit: 'Edit', methodDelete: 'Delete', methodSave: 'Save method',
      methodName: 'Name', methodKind: 'Kind', methodExec: 'Executor', methodContains: 'Verifier requires text',
      methodInUse: 'Still on a canvas — remove nodes first.',
      kindInput: 'input', kindCommand: 'command', kindExec: 'exec', kindObserve: 'observe', kindOutput: 'output',
      builtin: 'builtin', user: 'user', ai: 'ai',
      cfgPhrases: 'Common phrases', phraseAdd: 'Add', phraseCap: 'One click inserts into the canvas input.',
      cfgTokens: 'Design tokens', tokenRadius: 'Card radius', tokenGap: 'Card gap', tokenAccent: 'Accent', tokenSave: 'Save',
      cfgExec: 'Execution', execEnabled: 'enabled', execDisabled: 'off',
      runBtn: 'Run loop', reverify: 'Re-verify', tidy: 'Tidy', closeOut: 'Close out',
      addMethod: 'Method',
      stats: 'methods · edges', invalidGraph: 'Graph refused:',
      needInput: 'Type the goal in the input node first.',
      ranOk: 'Loop done.', ranFail: 'Loop failed.', verifyDone: 'Re-verified.',
      inputPlaceholder: 'What should this loop do?',
      inputHint: 'Enter runs the loop', insertPhrase: 'Insert',
      idle: 'not run', gray: 'no executor', green: 'verified · artifact on disk', red: 'failed',
      ready: 'ready',
      outEmpty: 'Run the loop; the report lands here.',
      outConclusion: 'Conclusion', outArtifacts: 'Artifacts',
      rawReply: 'Output text',
      closeTitle: 'Close out', closeNext: 'Next first step', closeDecision: 'Decision (why, what it costs)',
      closeOutcome: 'Outcome', closeSubmit: 'Write close-out', closeDone: 'Close-out written.', closeNeedNext: 'Next step is required.',
      colourG: 'green', colourY: 'yellow', colourR: 'red', colourNone: 'not recorded',
      loopOf: 'Loop', cancel: 'Cancel', confirmDelete: 'Delete?',
      emptyCanvas: 'Empty canvas. Add a method node.',
      dragHint: 'Drag a card; positions are remembered.',
    }
    const ZH = {
      title: '工作台', subtitle: '项目 · 方法 · 循环',
      home: '主页', config: '配置',
      loadError: '宿主返回异常。', oldHost: '宿主还是旧版：重启 DSH 加载 v2。', network: '连不上宿主。', retry: '重试', loading: '加载中…',
      projects: '项目', newProject: '新建项目', createProject: '创建',
      projName: '名称', projRoot: '根目录（绝对路径）',
      openCanvas: '打开画布', enable: '启用', disable: '停用', archive: '归档', restore: '恢复',
      enabledTag: '启用中', disabledTag: '未启用', archivedTag: '已归档',
      recent: '最近循环', noRuns: '还没有循环。',
      cfgModels: '模型与角色', roleT1: '一档 · 判断', roleT2: '二档 · 嚼需求', roleT3: '三档 · 批处理',
      roleUnbound: '未绑定', saveBind: '保存角色', modelsUnavailable: '模型目录不可用。',
      healthNone: '还没有循环记录',
      cfgMethods: '方法库', methodCap: '只有执行型真跑且能变绿。',
      methodNew: '新方法', methodEdit: '编辑', methodDelete: '删除', methodSave: '保存方法',
      methodName: '名称', methodKind: '类型', methodExec: '执行器', methodContains: '校验器须包含',
      methodInUse: '画布上还有节点，先删节点。',
      kindInput: '输入', kindCommand: '指令', kindExec: '执行', kindObserve: '观测', kindOutput: '输出',
      builtin: '内置', user: '用户', ai: 'AI 提炼',
      cfgPhrases: '常用语句', phraseAdd: '添加', phraseCap: '点一下就插进画布输入框。',
      cfgTokens: '设计令牌', tokenRadius: '卡片圆角', tokenGap: '卡片间距', tokenAccent: '主色', tokenSave: '保存',
      cfgExec: '执行配置', execEnabled: '已启用', execDisabled: '未启用',
      runBtn: '跑一遍', reverify: '重验产物', tidy: '整理', closeOut: '收工',
      addMethod: '方法',
      stats: '方法 · 边', invalidGraph: '图被拒绝：',
      needInput: '先在输入节点里写这一轮要做什么。',
      ranOk: '循环完成。', ranFail: '循环失败。', verifyDone: '已重验。',
      inputPlaceholder: '这一轮要做什么？',
      inputHint: 'Enter 直接跑', insertPhrase: '插入',
      idle: '没跑', gray: '无执行器', green: '校验过 · 产物在盘', red: '失败',
      ready: '就绪',
      outEmpty: '跑完后在这里看渲染后的汇报。',
      outConclusion: '结论', outArtifacts: '产物',
      rawReply: '输出原文',
      closeTitle: '收工', closeNext: '下次第一步', closeDecision: '判断（为什么、代价）',
      closeOutcome: '结论颜色', closeSubmit: '写入收工', closeDone: '已收工。', closeNeedNext: '必须写下一步。',
      colourG: '绿', colourY: '黄', colourR: '红', colourNone: '未记录',
      loopOf: '第', cancel: '取消', confirmDelete: '确认删除？',
      emptyCanvas: '空画布。先「＋方法」加一个节点。',
      dragHint: '拖卡片移动，位置会记住。',
    }

    const API = '/dsh-workbench/api'

    const CSS = `
.wbx{--wbx-accent:var(--wbx-accent-user,var(--dsw-alias-brand-primary,#4f8cff));
  --wbx-radius:var(--wbx-radius-user,14px);--wbx-gap:var(--wbx-gap-user,16px);
  box-sizing:border-box;height:100%;overflow-y:auto;overflow-x:hidden;
  padding:14px 14px 32px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit}
.wbx *,.wbx *:before,.wbx *:after{box-sizing:border-box}
.wbx-wrap{max-width:1080px;margin:0 auto}
.wbx-head{display:flex;align-items:center;gap:9px;padding:2px 2px 10px}
.wbx-dot{width:8px;height:8px;border-radius:50%;background:var(--wbx-accent);flex:none}
.wbx-title{font-size:16px;font-weight:600}
.wbx-sub{color:var(--dsw-alias-label-tertiary);font-size:12px}
.wbx-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 2px}
.wbx-tab{appearance:none;border:none;background:transparent;color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:13px;height:32px;padding:0 13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;
  border-radius:9px 9px 0 0;border-bottom:2px solid transparent}
.wbx-tab:hover{color:var(--dsw-alias-label-primary)}
.wbx-tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--wbx-accent);
  background:color-mix(in srgb,var(--wbx-accent) 9%,transparent)}
.wbx-tab-x{width:17px;height:17px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;
  color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1}
.wbx-tab-x:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.wbx-grid{display:grid;gap:var(--wbx-gap);margin-top:var(--wbx-gap)}
.wbx-grid-2{grid-template-columns:1fr 1fr}
.wbx-grid-3{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
@media(max-width:820px){.wbx-grid-2{grid-template-columns:1fr}}
.wbx-card{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--wbx-radius);
  background:var(--dsw-alias-bg-layer-1);padding:14px 16px}
.wbx-card-h{display:flex;align-items:center;gap:9px;margin:0 0 4px}
.wbx-card-t{font-size:14px;font-weight:600;margin:0}
.wbx-cap{color:var(--dsw-alias-label-tertiary);font-size:11.5px;margin:0 0 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wbx-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid var(--dsw-alias-border-l2);min-width:0}
.wbx-row:first-of-type{border-top:none}
.wbx-grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wbx-chip{display:inline-flex;align-items:center;gap:6px;height:21px;padding:0 8px;border-radius:11px;flex:none;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}
.wbx-chip-ok{color:var(--dsw-alias-state-success-primary);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent)}
.wbx-chip-warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 13%,transparent)}
.wbx-chip-bad{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}
.wbx-btn{appearance:none;font:inherit;font-size:12.5px;height:29px;padding:0 12px;border-radius:8px;cursor:pointer;flex:none;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wbx-btn:hover{border-color:var(--dsw-alias-border-l3)}
.wbx-btn:disabled{opacity:.45;cursor:default}
.wbx-btn-primary{background:var(--wbx-accent);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
.wbx-btn-sm{height:25px;padding:0 9px;font-size:11.5px}
.wbx-btn-ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}
.wbx-btn-ghost:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.wbx-input,.wbx-select,.wbx-area{font:inherit;font-size:12.5px;color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:7px 9px;outline:none;min-width:0}
.wbx-input:focus,.wbx-select:focus,.wbx-area:focus{border-color:var(--wbx-accent);
  box-shadow:0 0 0 2px color-mix(in srgb,var(--wbx-accent) 16%,transparent)}
.wbx-area{width:100%;resize:vertical;line-height:1.5}
.wbx-label{display:block;font-size:11px;color:var(--dsw-alias-label-secondary);margin:9px 0 4px}
.wbx-note{color:var(--dsw-alias-label-secondary);font-size:12px}
.wbx-mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;word-break:break-all}
.wbx-notice{margin:12px 2px 0;padding:8px 12px;border-radius:9px;font-size:12.5px;
  border:1px solid color-mix(in srgb,var(--wbx-accent) 40%,transparent);
  background:color-mix(in srgb,var(--wbx-accent) 9%,transparent)}
.wbx-notice-bad{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);
  background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);
  color:var(--dsw-alias-state-error-primary)}
.wbx-proj-line{color:var(--dsw-alias-label-secondary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wbx-proj-root{color:var(--dsw-alias-label-tertiary);font-size:11px;font-family:ui-monospace,Consolas,monospace;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wbx-cv-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.wbx-cv-tools .wbx-spacer{flex:1}
.wbx-cv-stat{color:var(--dsw-alias-label-tertiary);font-size:11.5px;white-space:nowrap}
.wbx-canvas{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--wbx-radius);
  background:var(--dsw-alias-bg-base);min-height:460px;overflow:auto}
.wbx-canvas-inner{position:relative;transform-origin:0 0}
.wbx-canvas-grid{position:absolute;inset:0;background-image:radial-gradient(var(--dsw-alias-border-l2) 1px,transparent 1px);
  background-size:22px 22px;opacity:.5;pointer-events:none}
.wbx-cv-edges{position:absolute;top:0;left:0;pointer-events:none}
.wbx-cv-edge{stroke:var(--dsw-alias-label-tertiary);stroke-width:1.5;fill:none}
.wbx-cv-edge-bad{stroke:var(--dsw-alias-state-error-primary);stroke-dasharray:5 5}
.wbx-cv-edge-label{font-size:10px;fill:var(--dsw-alias-label-tertiary)}
.wbx-node{position:absolute;width:280px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--wbx-radius);
  background:var(--dsw-alias-bg-layer-1);box-shadow:0 6px 18px rgba(0,0,0,.14);user-select:none}
.wbx-node-ok{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 50%,transparent)}
.wbx-node-bad{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,transparent)}
.wbx-node-h{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);cursor:grab}
.wbx-node-t{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wbx-node-b{padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.wbx-node-folded{width:240px;cursor:pointer}
.wbx-node-folded .wbx-node-b{display:none}
.wbx-st{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;color:var(--dsw-alias-label-secondary);
  background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:5px 9px;width:fit-content}
.wbx-st-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary);flex:none}
.wbx-st-ok{color:var(--dsw-alias-state-success-primary)}
.wbx-st-ok .wbx-st-dot{background:var(--dsw-alias-state-success-primary)}
.wbx-st-bad{color:var(--dsw-alias-state-error-primary)}
.wbx-st-bad .wbx-st-dot{background:var(--dsw-alias-state-error-primary)}
.wbx-pop{position:absolute;z-index:9;top:36px;left:0;min-width:240px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:11px;background:var(--dsw-alias-bg-layer-2);box-shadow:0 14px 34px rgba(0,0,0,.35);padding:5px}
.wbx-pop .wbx-row{cursor:pointer;border-radius:8px;padding:8px 10px}
.wbx-pop .wbx-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wbx-file{font-family:ui-monospace,Consolas,monospace;font-size:11px;background:var(--dsw-alias-bg-layer-2);
  border-radius:6px;padding:2px 7px;color:var(--dsw-alias-label-secondary);display:inline-block;margin:0 6px 6px 0}
.wbx-dialog{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}
.wbx-dialog-card{width:min(430px,92%);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--wbx-radius);
  background:var(--dsw-alias-bg-layer-1);padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.wbx-details summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px;padding:6px 0}
.wbx-kbd{border:1px solid var(--dsw-alias-border-l2);border-bottom-width:2px;border-radius:5px;padding:0 5px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
`

    const api = (path, options) => fetch(API + path, { credentials: 'same-origin', cache: 'no-store', ...options })
    const apiGet = path => api(path).then(res => {
      // A 404 on the API means the running host predates v2 — say so instead of
      // pretending the network broke.
      if (res.status === 404) return { ok: false, error: '__old_host__' }
      return res.json()
    }).catch(() => null)
    const apiPost = (path, body) => api(path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}),
    }).then(res => res.json()).catch(() => null)

    const timeFmt = value => {
      const ms = Number(value)
      if (!ms) return ''
      const date = new Date(ms)
      const pad = n => String(n).padStart(2, '0')
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    const firstLine = text => String(text || '').split('\n').find(Boolean) || ''
    const baseName = path => String(path || '').replace(/\\/g, '/').split('/').pop()

    const stateClass = runtime => {
      if (runtime.status === 'green') return 'wbx-st wbx-st-ok'
      if (runtime.status === 'red') return 'wbx-st wbx-st-bad'
      return 'wbx-st'
    }
    const stateText = (t, runtime) => {
      if (runtime.status === 'green') return t('green')
      if (runtime.status === 'red') return runtime.note || t('red')
      if (runtime.status === 'gray') return t('gray')
      if (runtime.status === 'ready') return t('ready')
      return t('idle')
    }

    function RunCard({ t, run }) {
      const colourClass = run.colour === 'green' ? 'wbx-chip wbx-chip-ok'
        : run.colour === 'yellow' ? 'wbx-chip wbx-chip-warn'
        : run.colour === 'red' ? 'wbx-chip wbx-chip-bad' : 'wbx-chip'
      const colourText = run.colour === 'green' ? t('colourG')
        : run.colour === 'yellow' ? t('colourY') : run.colour === 'red' ? t('colourR') : t('colourNone')
      return h('div', { className: 'wbx-card' },
        h('div', { className: 'wbx-card-h' },
          h('span', { className: colourClass }, colourText),
          h('span', { className: 'wbx-chip' }, `${t('loopOf')} ${run.loop || '—'}`),
          h('span', { className: 'wbx-grow' }),
          h('span', { className: 'wbx-note' }, timeFmt(run.endedAt))),
        h('p', { className: 'wbx-proj-line', style: { margin: '6px 0' } }, run.goal),
        run.outputFirstLine ? h('p', { className: 'wbx-note', style: { margin: '0 0 6px' } }, run.outputFirstLine) : null,
        h('div', { className: 'wbx-note' },
          `${run.counts?.green || 0} ✓ · ${run.counts?.gray || 0} ○ · ${run.counts?.red || 0} ✗ · ${run.artifactCount} 件产物`))
    }

    function HomePage({ t, data, actions }) {
      const [creating, setCreating] = React.useState(false)
      const [name, setName] = React.useState('')
      const [root, setRoot] = React.useState('')
      const projects = data.projects || []
      const runs = data.runs || []
      return h('div', null,
        h('div', { className: 'wbx-card-h', style: { margin: '10px 2px 0' } },
          h('h2', { className: 'wbx-card-t' }, t('projects')),
          h('span', { className: 'wbx-note' }, String(projects.filter(p => p.enabled && !p.archived).length) + ' 启用'),
          h('span', { style: { flex: 1 } }),
          h('button', { className: 'wbx-btn wbx-btn-primary', type: 'button', onClick: () => setCreating(!creating) }, t('newProject'))),
        creating ? h('div', { className: 'wbx-card', style: { marginTop: '10px' } },
          h('label', { className: 'wbx-label' }, t('projName')),
          h('input', { className: 'wbx-input', style: { width: '100%' }, value: name, onChange: e => setName(e.target.value) }),
          h('label', { className: 'wbx-label' }, t('projRoot')),
          h('input', { className: 'wbx-input', style: { width: '100%' }, value: root, placeholder: 'D:/AI Pj/…', onChange: e => setRoot(e.target.value) }),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' } },
            h('button', { className: 'wbx-btn', type: 'button', onClick: () => setCreating(false) }, t('cancel')),
            h('button', {
              className: 'wbx-btn wbx-btn-primary', type: 'button',
              disabled: !name.trim() || !root.trim(),
              onClick: () => actions.createProject(name, root).then(ok => { if (ok) { setCreating(false); setName(''); setRoot('') } }),
            }, t('createProject')))) : null,
        h('div', { className: 'wbx-grid wbx-grid-3' },
          projects.map(project => {
            const chip = project.archived ? 'wbx-chip'
              : project.enabled ? 'wbx-chip wbx-chip-ok' : 'wbx-chip'
            const chipText = project.archived ? t('archivedTag') : project.enabled ? t('enabledTag') : t('disabledTag')
            return h('div', { className: 'wbx-card', key: project.key, style: project.archived ? { opacity: .6 } : null },
              h('div', { className: 'wbx-card-h' },
                h('span', { className: 'wbx-node-t', style: { fontSize: '13.5px' } }, project.name),
                h('span', { style: { flex: 1 } }),
                h('span', { className: chip }, chipText)),
              h('div', { className: 'wbx-proj-root' }, project.root),
              project.mainline ? h('div', { className: 'wbx-proj-line', style: { marginTop: '5px' } }, project.mainline) : null,
              h('div', { style: { display: 'flex', gap: '8px', margin: '10px 0 0', flexWrap: 'wrap' } },
                h('button', {
                  className: 'wbx-btn wbx-btn-primary wbx-btn-sm', type: 'button',
                  disabled: project.archived || !project.enabled, onClick: () => actions.openCanvas(project.key),
                }, t('openCanvas')),
                !project.archived ? h('button', { className: 'wbx-btn wbx-btn-sm', type: 'button', onClick: () => actions.toggleEnable(project) },
                  project.enabled ? t('disable') : t('enable')) : null,
                h('button', { className: 'wbx-btn wbx-btn-sm', type: 'button', onClick: () => actions.toggleArchive(project) },
                  project.archived ? t('restore') : t('archive'))))
          })),
        h('div', { className: 'wbx-card-h', style: { margin: '20px 2px 0' } },
          h('h2', { className: 'wbx-card-t' }, t('recent')),
          h('span', { className: 'wbx-note' }, data.memory?.name || '')),
        runs.length
          ? h('div', { className: 'wbx-grid wbx-grid-3' }, runs.slice(0, 6).map(run => h(RunCard, { key: run.runId, t, run })))
          : h('div', { className: 'wbx-card', style: { marginTop: '10px' } }, h('span', { className: 'wbx-note' }, t('noRuns'))))
    }

    function ConfigPage({ t, data, actions }) {
      const activeProject = (data.projects || []).find(item => item.key === data.active)
      const [roles, setRoles] = React.useState({ t1: '', t2: '', t3: '' })
      React.useEffect(() => {
        setRoles({
          t1: activeProject?.roles?.t1 || '', t2: activeProject?.roles?.t2 || '', t3: activeProject?.roles?.t3 || '',
        })
      }, [data.active])
      const [phrases, setPhrases] = React.useState([])
      React.useEffect(() => { setPhrases([...(data.globals?.phrases || [])]) }, [data.globals])
      const [phraseDraft, setPhraseDraft] = React.useState('')
      const [tokens, setTokens] = React.useState({})
      React.useEffect(() => { setTokens({ ...(data.globals?.tokens || {}) }) }, [data.globals])
      const [methodForm, setMethodForm] = React.useState(null)

      const modelOptions = []
      for (const group of (data.models?.groups || [])) {
        for (const entry of (group.models || [])) modelOptions.push({ value: `${group.id}/${entry.id}`, label: `${group.id}/${entry.id}` })
      }
      const roleSelect = (tier, label) => h('div', { className: 'wbx-row' },
        h('span', { className: 'wbx-grow' }, label),
        h('select', { className: 'wbx-select', value: roles[tier] || '', onChange: e => setRoles({ ...roles, [tier]: e.target.value }) },
          h('option', { value: '' }, t('roleUnbound')),
          modelOptions.map(option => h('option', { key: option.value, value: option.value }, option.label))))

      const kindLabels = { input: t('kindInput'), command: t('kindCommand'), exec: t('kindExec'), observe: t('kindObserve'), output: t('kindOutput') }
      const ownerLabels = { builtin: t('builtin'), user: t('user'), ai: t('ai') }

      return h('div', { className: 'wbx-grid wbx-grid-2', style: { marginTop: '12px' } },
        h('section', { className: 'wbx-card', style: { gridColumn: '1 / -1' } },
          h('div', { className: 'wbx-card-h' }, h('h2', { className: 'wbx-card-t' }, t('cfgModels'))),
          h('p', { className: 'wbx-cap' }, '角色绑定模型，角色不是模型 · 健康度来自循环记录'),
          !data.models?.available ? h('p', { className: 'wbx-note' }, t('modelsUnavailable')) : null,
          roleSelect('t1', t('roleT1')), roleSelect('t2', t('roleT2')), roleSelect('t3', t('roleT3')),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' } },
            h('button', { className: 'wbx-btn wbx-btn-primary', type: 'button', onClick: () => actions.saveRoles(roles) }, t('saveBind'))),
          h('div', { className: 'wbx-note', style: { marginTop: '8px' } },
            Object.entries(data.modelHealth || {}).length
              ? Object.entries(data.modelHealth).map(([model, info]) => `${model}: ${info.lastStatus}`).join(' · ')
              : t('healthNone'))),
        h('section', { className: 'wbx-card' },
          h('div', { className: 'wbx-card-h' },
            h('h2', { className: 'wbx-card-t' }, t('cfgMethods')),
            h('span', { style: { flex: 1 } }),
            h('button', {
              className: 'wbx-btn wbx-btn-sm', type: 'button',
              onClick: () => setMethodForm({ name: '', kind: 'exec', executor: 'text', contains: '' }),
            }, t('methodNew'))),
          h('p', { className: 'wbx-cap' }, t('methodCap')),
          (data.methods || []).map(method => h('div', { className: 'wbx-row', key: method.id },
            h('span', { className: 'wbx-grow' }, method.name),
            h('span', { className: 'wbx-chip' }, kindLabels[method.kind] || method.kind),
            h('span', { className: 'wbx-chip' }, ownerLabels[method.owner] || method.owner),
            method.owner !== 'builtin' ? h('button', {
              className: 'wbx-btn wbx-btn-sm wbx-btn-ghost', type: 'button',
              onClick: () => setMethodForm({
                id: method.id, name: method.name, kind: method.kind,
                executor: method.executor.kind || 'text', contains: method.verifier?.contains || '',
              }),
            }, t('methodEdit')) : null,
            method.owner !== 'builtin' ? h('button', {
              className: 'wbx-btn wbx-btn-sm wbx-btn-ghost', type: 'button',
              onClick: () => actions.deleteMethod(method),
            }, t('methodDelete')) : null)),
          methodForm ? h('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l2)', marginTop: '8px', paddingTop: '4px' } },
            h('label', { className: 'wbx-label' }, t('methodName')),
            h('input', { className: 'wbx-input', style: { width: '100%' }, value: methodForm.name, onChange: e => setMethodForm({ ...methodForm, name: e.target.value }) }),
            h('label', { className: 'wbx-label' }, t('methodKind')),
            h('select', { className: 'wbx-select', style: { width: '100%' }, value: methodForm.kind, onChange: e => setMethodForm({ ...methodForm, kind: e.target.value }) },
              Object.entries(kindLabels).map(([value, label]) => h('option', { key: value, value }, label))),
            methodForm.kind === 'exec' ? h('div', null,
              h('label', { className: 'wbx-label' }, t('methodExec')),
              h('select', { className: 'wbx-select', style: { width: '100%' }, value: methodForm.executor, onChange: e => setMethodForm({ ...methodForm, executor: e.target.value }) },
                (data.canvas?.executors || []).map(exec => h('option', { key: exec.kind, value: exec.kind, disabled: !exec.available }, exec.label))),
              h('label', { className: 'wbx-label' }, t('methodContains')),
              h('input', { className: 'wbx-input', style: { width: '100%' }, value: methodForm.contains, onChange: e => setMethodForm({ ...methodForm, contains: e.target.value }) })) : null,
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' } },
              h('button', { className: 'wbx-btn', type: 'button', onClick: () => setMethodForm(null) }, t('cancel')),
              h('button', {
                className: 'wbx-btn wbx-btn-primary', type: 'button', disabled: !methodForm.name.trim(),
                onClick: () => actions.saveMethod(methodForm).then(ok => { if (ok) setMethodForm(null) }),
              }, t('methodSave')))) : null),
        h('section', { className: 'wbx-card' },
          h('div', { className: 'wbx-card-h' }, h('h2', { className: 'wbx-card-t' }, t('cfgPhrases'))),
          h('p', { className: 'wbx-cap' }, t('phraseCap')),
          phrases.map((phrase, index) => h('div', { className: 'wbx-row', key: index },
            h('span', { className: 'wbx-grow' }, phrase),
            h('button', {
              className: 'wbx-btn wbx-btn-sm wbx-btn-ghost', type: 'button',
              onClick: () => setPhrases(phrases.filter((_, i) => i !== index)),
            }, '✕'))),
          h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } },
            h('input', { className: 'wbx-input', style: { flex: 1 }, value: phraseDraft, onChange: e => setPhraseDraft(e.target.value) }),
            h('button', {
              className: 'wbx-btn', type: 'button', disabled: !phraseDraft.trim(),
              onClick: () => { setPhrases([...phrases, phraseDraft.trim()]); setPhraseDraft('') },
            }, t('phraseAdd'))),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' } },
            h('button', { className: 'wbx-btn wbx-btn-primary', type: 'button', onClick: () => actions.saveGlobals({ phrases }) }, t('tokenSave')))),
        h('section', { className: 'wbx-card' },
          h('div', { className: 'wbx-card-h' }, h('h2', { className: 'wbx-card-t' }, t('cfgTokens'))),
          h('p', { className: 'wbx-cap' }, '改动全局生效，无需改代码'),
          h('div', { className: 'wbx-row' },
            h('span', { className: 'wbx-grow' }, t('tokenRadius')),
            h('input', { className: 'wbx-input', type: 'number', min: 6, max: 20, style: { width: '76px' }, value: tokens.radius ?? 14, onChange: e => setTokens({ ...tokens, radius: Number(e.target.value) }) })),
          h('div', { className: 'wbx-row' },
            h('span', { className: 'wbx-grow' }, t('tokenGap')),
            h('input', { className: 'wbx-input', type: 'number', min: 8, max: 32, style: { width: '76px' }, value: tokens.gap ?? 16, onChange: e => setTokens({ ...tokens, gap: Number(e.target.value) }) })),
          h('div', { className: 'wbx-row' },
            h('span', { className: 'wbx-grow' }, t('tokenAccent')),
            h('input', { className: 'wbx-input', type: 'color', style: { width: '46px', height: '29px', padding: '2px' }, value: tokens.accent || '#4f8cff', onChange: e => setTokens({ ...tokens, accent: e.target.value }) })),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' } },
            h('button', { className: 'wbx-btn wbx-btn-primary', type: 'button', onClick: () => actions.saveGlobals({ tokens }) }, t('tokenSave')))),
        h('section', { className: 'wbx-card', style: { gridColumn: '1 / -1' } },
          h('div', { className: 'wbx-card-h' }, h('h2', { className: 'wbx-card-t' }, t('cfgExec'))),
          h('p', { className: 'wbx-mono' }, `${data.execution?.enabled ? t('execEnabled') : t('execDisabled')} · ${data.execution?.cwd || '—'}`)))
    }

    function NodeCard({ t, node, run, draft, onDraft, actions, onDragStart, folded, onFold }) {
      const runtime = node.runtime || {}
      if (folded) {
        return h('div', { className: 'wbx-node wbx-node-folded', style: { left: node.position.x, top: node.position.y }, onClick: onFold },
          h('div', { className: 'wbx-node-h' },
            h('span', { className: 'wbx-node-t' }, runtime.title),
            h('span', { className: 'wbx-chip' }, `${t('loopOf')} ${node.loop}`),
            h('span', { style: { flex: 1 } }),
            h('span', { className: 'wbx-note' }, firstLine(run?.goal || ''))))
      }
      const isInput = runtime.kind === 'input'
      const isExec = runtime.kind === 'exec'
      const isOutput = runtime.kind === 'output'
      const nodeClass = 'wbx-node' + (runtime.status === 'green' ? ' wbx-node-ok' : runtime.status === 'red' ? ' wbx-node-bad' : '')
      return h('div', { className: nodeClass, style: { left: node.position.x, top: node.position.y } },
        h('div', { className: 'wbx-node-h', onMouseDown: event => onDragStart(event, node) },
          h('span', { className: 'wbx-node-t' }, runtime.title),
          h('span', { className: 'wbx-chip' }, runtime.kindLabel),
          h('span', { style: { flex: 1 } }),
          h('span', { className: stateClass(runtime) }, h('span', { className: 'wbx-st-dot' }))),
        h('div', { className: 'wbx-node-b' },
          isInput ? h('div', null,
            h('textarea', {
              className: 'wbx-area', rows: 4, placeholder: t('inputPlaceholder'),
              value: draft ?? (node.params?.content || ''),
              onChange: e => onDraft(e.target.value),
              onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); actions.runLoop() } },
              onBlur: () => actions.saveInput(node, draft),
            }),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
              (actions.phrases || []).slice(0, 2).map((phrase, index) => h('button', {
                key: index, className: 'wbx-chip', type: 'button', style: { cursor: 'pointer', maxWidth: '110px', overflow: 'hidden' },
                title: phrase, onClick: () => onDraft(((draft ?? (node.params?.content || '')) + '\n' + phrase).trim()),
              }, t('insertPhrase'))),
              h('span', { style: { flex: 1 } }),
              h('span', { className: 'wbx-note' }, h('span', { className: 'wbx-kbd' }, 'Enter'), ' ' + t('inputHint')))) : null,
          isExec ? h('div', null,
            h('span', { className: stateClass(runtime) }, h('span', { className: 'wbx-st-dot' }), stateText(t, runtime)),
            h('div', { className: 'wbx-note' }, runtime.executorLabel),
            runtime.executor === 'text' ? h('textarea', {
              className: 'wbx-area', rows: 2,
              placeholder: '{{input}} = 上游文字',
              defaultValue: node.params?.template || '',
              onBlur: e => actions.saveTemplate(node, e.target.value),
            }) : null) : null,
          isOutput ? h('div', null,
            run ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
              h('span', { className: 'wbx-cap', style: { margin: 0 } }, t('outConclusion')),
              h('div', { className: 'wbx-note', style: { whiteSpace: 'pre-wrap' } }, run.outputFirstLine || firstLine(run.output)),
              (run.artifacts || []).length ? h('div', null,
                h('span', { className: 'wbx-cap', style: { margin: 0 } }, t('outArtifacts')),
                h('div', null, run.artifacts.map(path => h('span', { className: 'wbx-file', key: path }, baseName(path))))) : null,
              h('details', { className: 'wbx-details' },
                h('summary', null, t('rawReply')),
                h('pre', { className: 'wbx-mono', style: { margin: '6px 0 0', maxHeight: '110px', overflow: 'auto' } },
                  String(run.output || '').slice(0, 1200))))
              : h('span', { className: 'wbx-note' }, t('outEmpty'))) : null,
          !isInput && !isExec && !isOutput ? h('span', { className: 'wbx-note' }, runtime.note) : null,
          runtime.issues?.length ? h('span', { className: 'wbx-note', style: { color: 'var(--dsw-alias-state-error-primary)' } }, runtime.issues.join('；')) : null))
    }

    function CloseDialog({ t, data, actions, onClose }) {
      const [next, setNext] = React.useState('')
      const [decision, setDecision] = React.useState('')
      const [outcome, setOutcome] = React.useState('')
      const latestRun = (data.runs || [])[0]
      const submit = () => {
        if (!next.trim()) { actions.notify(t('closeNeedNext'), true); return }
        actions.closeOut({ next, decision, outcome, runId: latestRun?.runId || '' }).then(ok => { if (ok) onClose() })
      }
      return h('div', { className: 'wbx-dialog-card' },
        h('div', { className: 'wbx-card-h' }, h('h2', { className: 'wbx-card-t' }, t('closeTitle'))),
        h('label', { className: 'wbx-label' }, t('closeNext')),
        h('textarea', { className: 'wbx-area', rows: 2, value: next, onChange: e => setNext(e.target.value) }),
        h('label', { className: 'wbx-label' }, t('closeDecision')),
        h('textarea', { className: 'wbx-area', rows: 3, value: decision, onChange: e => setDecision(e.target.value) }),
        h('label', { className: 'wbx-label' }, t('closeOutcome')),
        h('select', { className: 'wbx-select', style: { width: '100%' }, value: outcome, onChange: e => setOutcome(e.target.value) },
          h('option', { value: '' }, t('colourNone')),
          h('option', { value: 'green' }, t('colourG')),
          h('option', { value: 'yellow' }, t('colourY')),
          h('option', { value: 'red' }, t('colourR'))),
        h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' } },
          h('button', { className: 'wbx-btn', type: 'button', onClick: onClose }, t('cancel')),
          h('button', { className: 'wbx-btn wbx-btn-primary', type: 'button', onClick: submit }, t('closeSubmit'))))
    }

    function CanvasPage({ t, data, actions }) {
      const canvas = data.canvas || {}
      const runs = data.runs || []
      const [zoom, setZoom] = React.useState(canvas.view?.zoom || 1)
      const [localPos, setLocalPos] = React.useState({})
      const [expanded, setExpanded] = React.useState({})
      const [addPop, setAddPop] = React.useState(false)
      const [closeOpen, setCloseOpen] = React.useState(false)
      const localPosRef = React.useRef(localPos)
      localPosRef.current = localPos
      const dragRef = React.useRef(null)
      const posOf = node => localPos[node.id] || node.position || { x: 0, y: 0 }
      const bounds = (canvas.nodes || []).reduce((acc, node) => {
        const pos = posOf(node)
        return { w: Math.max(acc.w, pos.x + 300), h: Math.max(acc.h, pos.y + 280) }
      }, { w: 620, h: 460 })
      const maxLoop = canvas.maxLoop || 1
      const runByLoop = new Map(runs.map(run => [Number(run.loop) || 0, run]))
      const edgePath = edge => {
        const from = (canvas.nodes || []).find(node => node.id === edge.from?.node)
        const to = (canvas.nodes || []).find(node => node.id === edge.to?.node)
        if (!from || !to) return null
        const a = posOf(from)
        const b = posOf(to)
        const x1 = a.x + 280
        const y1 = a.y + 34
        const x2 = b.x
        const y2 = b.y + 34
        const mid = Math.max(40, Math.abs(x2 - x1) / 2)
        return { d: `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`, x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6 }
      }
      const onDragStart = (event, node) => {
        event.preventDefault()
        dragRef.current = { id: node.id, startX: event.clientX, startY: event.clientY, origin: posOf(node) }
        const onMove = moveEvent => {
          const drag = dragRef.current
          if (!drag) return
          setLocalPos(prev => ({
            ...prev,
            [drag.id]: {
              x: Math.max(0, Math.round(drag.origin.x + (moveEvent.clientX - drag.startX) / zoom)),
              y: Math.max(0, Math.round(drag.origin.y + (moveEvent.clientY - drag.startY) / zoom)),
            },
          }))
        }
        const onUp = () => {
          const drag = dragRef.current
          dragRef.current = null
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          const final = drag && localPosRef.current[drag.id]
          if (final) actions.savePositions({ [drag.id]: final })
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }
      const issues = canvas.validation?.issues || []
      return h('div', { style: { marginTop: '12px', position: 'relative' } },
        h('div', { className: 'wbx-cv-tools' },
          h('div', { style: { position: 'relative' } },
            h('button', { className: 'wbx-btn', type: 'button', onClick: () => setAddPop(!addPop) }, '＋' + t('addMethod')),
            addPop ? h('div', { className: 'wbx-pop' },
              (canvas.methods || []).map(method => h('div', {
                className: 'wbx-row', key: method.id, onClick: () => { setAddPop(false); actions.addNode(method.id) },
              },
                h('span', { className: 'wbx-grow' }, method.name),
                h('span', { className: 'wbx-chip' }, method.kindLabel)))) : null),
          h('button', { className: 'wbx-btn wbx-btn-primary', type: 'button', onClick: actions.runLoop }, '▶ ' + t('runBtn')),
          h('button', { className: 'wbx-btn', type: 'button', onClick: actions.reverify }, t('reverify')),
          h('button', { className: 'wbx-btn', type: 'button', onClick: () => setCloseOpen(true) }, t('closeOut')),
          h('span', { className: 'wbx-spacer' }),
          h('span', { className: 'wbx-cv-stat' }, `${(canvas.nodes || []).length} ${t('stats')} ${(canvas.edges || []).length}`),
          h('button', { className: 'wbx-btn wbx-btn-sm', type: 'button', onClick: () => actions.saveZoom(Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10)) }, '−'),
          h('button', { className: 'wbx-btn wbx-btn-sm', type: 'button', onClick: () => actions.saveZoom(Math.min(1.6, Math.round((zoom + 0.1) * 10) / 10)) }, '＋'),
          h('button', { className: 'wbx-btn wbx-btn-sm', type: 'button', onClick: () => { setLocalPos({}); actions.tidy() } }, t('tidy'))),
        issues.length ? h('div', { className: 'wbx-notice wbx-notice-bad' }, t('invalidGraph') + ' ' + issues.slice(0, 3).map(issue => issue.message).join('；')) : null,
        h('div', { className: 'wbx-canvas' },
          h('div', { className: 'wbx-canvas-inner', style: { width: bounds.w, height: bounds.h, transform: `scale(${zoom})` } },
            h('div', { className: 'wbx-canvas-grid' }),
            h('svg', { className: 'wbx-cv-edges', width: bounds.w, height: bounds.h },
              (canvas.edges || []).map(edge => {
                const path = edgePath(edge)
                if (!path) return null
                return h('g', { key: edge.id },
                  h('path', { d: path.d, className: 'wbx-cv-edge' + (edge.valid === false ? ' wbx-cv-edge-bad' : '') }),
                  h('text', { x: path.x, y: path.y, textAnchor: 'middle', className: 'wbx-cv-edge-label' }, 'text'))
              })),
            (canvas.nodes || []).map(node => {
              const loop = Number(node.loop) || 1
              const folded = loop < maxLoop && runByLoop.get(loop) && !expanded[loop]
              return h(NodeCard, {
                key: node.id, t, node: { ...node, position: posOf(node) }, run: runByLoop.get(loop),
                draft: actions.draftOf(node), onDraft: value => actions.setDraft(node, value),
                actions, onDragStart, folded, onFold: () => setExpanded({ ...expanded, [loop]: true }),
              })
            })),
          !(canvas.nodes || []).length ? h('div', { style: { padding: '40px', textAlign: 'center' } },
            h('span', { className: 'wbx-note' }, t('emptyCanvas'))) : null),
        h('div', { className: 'wbx-note', style: { margin: '8px 2px 0' } }, t('dragHint')),
        closeOpen ? h('div', { className: 'wbx-dialog', onClick: e => { if (e.target === e.currentTarget) setCloseOpen(false) } },
          h(CloseDialog, { t, data, actions, onClose: () => setCloseOpen(false) })) : null)
    }

    function WorkbenchPanel(props) {
      const t = props.t || (key => ZH[key] || EN[key] || key)
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState('')
      const [loading, setLoading] = React.useState(true)
      const [tab, setTab] = React.useState('home')
      const [openProjects, setOpenProjects] = React.useState([])
      const [notice, setNotice] = React.useState(null)
      const [drafts, setDrafts] = React.useState({})
      const [busy, setBusy] = React.useState(false)

      const load = React.useCallback(async () => {
        try {
          const res = await apiGet('/snapshot')
          if (!res) { setError('network'); setData(null) } else if (res.error === '__old_host__') { setError('oldHost'); setData(null) } else if (res.ok === false) { setError(res.error || 'loadError'); setData(null) } else { setData(res); setError('') }
        } finally { setLoading(false) }
      }, [])

      React.useEffect(() => { load() }, [load])

      const notify = (text, bad) => {
        setNotice({ text, bad: Boolean(bad) })
        window.setTimeout(() => setNotice(null), 4000)
      }

      const withBusy = async fn => {
        if (busy) return false
        setBusy(true)
        try { return await fn() } finally { setBusy(false) }
      }

      const mergeSnapshot = json => { if (json?.snapshot) setData(json.snapshot); return json?.ok === true }
      const mergeCanvas = json => {
        if (json?.snapshot) setData(json.snapshot)
        else if (json?.ok && json.canvas && data) setData({ ...data, canvas: json.canvas })
        return json?.ok === true
      }
      const digestOf = run => ({
        runId: run.runId, loop: run.loop, goal: run.goal, status: run.status, colour: run.colour || '',
        endedAt: run.endedAt, counts: run.counts, artifactCount: (run.artifacts || []).length,
        outputFirstLine: firstLine(run.output),
      })

      const actions = {
        notify,
        draftOf: node => drafts[node.id],
        setDraft: (node, value) => setDrafts({ ...drafts, [node.id]: value }),
        phrases: data?.globals?.phrases || [],
        openCanvas(key) {
          setOpenProjects(prev => (prev.includes(key) ? prev : [...prev, key]))
          setTab('p:' + key)
        },
        async createProject(name, root) {
          return withBusy(async () => {
            const json = await apiPost('/project', { op: 'create', name, root })
            if (!mergeSnapshot(json)) { notify(json?.error || t('loadError'), true); return false }
            const key = json.snapshot?.active
            if (key) { setOpenProjects(prev => (prev.includes(key) ? prev : [...prev, key])); setTab('p:' + key) }
            return true
          })
        },
        async toggleEnable(project) {
          return withBusy(async () => {
            const json = await apiPost('/project', { op: 'enable', key: project.key, enabled: !project.enabled })
            if (!mergeSnapshot(json)) { notify(json?.error || t('loadError'), true); return false }
            return true
          })
        },
        async toggleArchive(project) {
          return withBusy(async () => {
            const json = await apiPost('/project', { op: 'archive', key: project.key, archived: !project.archived })
            if (!mergeSnapshot(json)) { notify(json?.error || t('loadError'), true); return false }
            return true
          })
        },
        async saveRoles(roles) {
          return withBusy(async () => {
            const json = await apiPost('/project', { op: 'bind', key: data.active, roles })
            if (!mergeSnapshot(json)) { notify(json?.error || t('loadError'), true); return false }
            notify(t('saveBind') + ' ✓')
            return true
          })
        },
        async saveMethod(form) {
          return withBusy(async () => {
            const ports = form.kind === 'exec'
              ? { inputs: [{ name: 'in', type: 'text' }], outputs: [{ name: 'out', type: 'text' }] }
              : form.kind === 'output' ? { inputs: [{ name: 'in', type: 'text' }], outputs: [] }
              : form.kind === 'input' ? { inputs: [], outputs: [{ name: 'out', type: 'text' }] }
              : { inputs: [], outputs: [] }
            const json = await apiPost('/method', {
              op: 'save', key: data.active, id: form.id,
              name: form.name, kind: form.kind, owner: form.id ? undefined : 'user',
              ports,
              executor: form.kind === 'exec' ? { kind: form.executor, params: { content: '', template: '' } } : { kind: '', params: {} },
              verifier: form.kind === 'exec' ? { kind: form.contains ? 'file-contains' : 'file-exists', path: '', contains: form.contains || '' } : { kind: 'file-exists', path: '' },
            })
            if (!mergeCanvas(json)) { notify(json?.error || t('loadError'), true); return false }
            await load()
            notify(t('methodSave') + ' ✓')
            return true
          })
        },
        async deleteMethod(method) {
          if (!window.confirm(t('confirmDelete'))) return false
          return withBusy(async () => {
            const json = await apiPost('/method', { op: 'delete', key: data.active, id: method.id })
            if (!mergeCanvas(json)) {
              notify(json?.error === '画布上还有这个方法的节点，先删节点' ? t('methodInUse') : json?.error || t('loadError'), true)
              return false
            }
            await load()
            return true
          })
        },
        async saveGlobals(patch) {
          return withBusy(async () => {
            if (patch.tokens) {
              const root = document.getElementById('dsh-workbench-root')
              if (root) {
                root.style.setProperty('--wbx-radius-user', (patch.tokens.radius ?? 14) + 'px')
                root.style.setProperty('--wbx-gap-user', (patch.tokens.gap ?? 16) + 'px')
                if (patch.tokens.accent) root.style.setProperty('--wbx-accent-user', patch.tokens.accent)
              }
            }
            const json = await apiPost('/memory', { op: 'global', ...patch })
            if (!json?.ok) { notify(json?.error || t('loadError'), true); return false }
            await load()
            notify(t('tokenSave') + ' ✓')
            return true
          })
        },
        async addNode(methodId) {
          return withBusy(async () => {
            const json = await apiPost('/canvas', { op: 'node.add', key: data.active, methodId })
            if (!mergeCanvas(json)) { notify(json?.error || t('loadError'), true); return false }
            return true
          })
        },
        async saveInput(node, draft) {
          if (draft === undefined) return false
          const json = await apiPost('/canvas', { op: 'node.set', key: data.active, id: node.id, params: { content: draft } })
          setDrafts(prev => { const next = { ...prev }; delete next[node.id]; return next })
          return mergeCanvas(json)
        },
        async saveTemplate(node, template) {
          const json = await apiPost('/canvas', { op: 'node.set', key: data.active, id: node.id, params: { template } })
          return mergeCanvas(json)
        },
        async savePositions(positions) {
          const json = await apiPost('/canvas', { op: 'view', key: data.active, positions })
          return mergeCanvas(json)
        },
        async saveZoom(value) {
          setZoom(value)
          const json = await apiPost('/canvas', { op: 'view', key: data.active, zoom: value })
          return mergeCanvas(json)
        },
        async tidy() {
          return withBusy(async () => {
            const json = await apiPost('/canvas', { op: 'view', key: data.active, arrange: true })
            return mergeCanvas(json)
          })
        },
        async runLoop() {
          return withBusy(async () => {
            const canvas = data.canvas || {}
            const inputNode = (canvas.nodes || []).find(node => node.runtime?.kind === 'input' && Number(node.loop) === (canvas.maxLoop || 1))
            if (inputNode && drafts[inputNode.id] !== undefined) await actions.saveInput(inputNode, drafts[inputNode.id])
            const json = await apiPost('/run', { op: 'run', key: data.active, confirm: true })
            if (!json?.ok) {
              if (json?.code === 'empty-input') notify(t('needInput'), true)
              else if (json?.code === 'canvas-invalid') notify(t('invalidGraph') + ' ' + (json.validation?.issues?.[0]?.message || ''), true)
              else notify(json?.error || t('ranFail'), true)
              return false
            }
            if (json.canvas) setData({ ...data, canvas: json.canvas, runs: [digestOf(json.run), ...(data.runs || [])].slice(0, 10) })
            notify(json.run?.counts?.red ? t('ranFail') : t('ranOk'), Boolean(json.run?.counts?.red))
            return true
          })
        },
        async reverify() {
          return withBusy(async () => {
            const json = await apiPost('/run', { op: 'reverify', key: data.active })
            if (!mergeCanvas(json)) { notify(json?.error || t('loadError'), true); return false }
            notify(t('verifyDone'))
            return true
          })
        },
        async closeOut(form) {
          return withBusy(async () => {
            const json = await api('/memory', {
              method: 'PUT', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ op: 'close', key: data.active, next: form.next, decision: form.decision, outcome: form.outcome, runId: form.runId }),
            }).then(res => res.json()).catch(() => null)
            if (!json?.ok) { notify(json?.error || t('loadError'), true); return false }
            await load()
            notify(t('closeDone'))
            return true
          })
        },
      }

      let content
      if (error) {
        content = h('div', { className: 'wbx-card', style: { marginTop: '16px' }, role: 'alert' },
          h('p', { className: 'wbx-note' }, error === 'network' ? t('network') : error === 'oldHost' ? t('oldHost') : t('loadError') + ' ' + error),
          h('button', { className: 'wbx-btn', type: 'button', onClick: load }, t('retry')))
      } else if (loading || !data) {
        content = h('div', { className: 'wbx-card', style: { marginTop: '16px' } }, h('span', { className: 'wbx-note' }, t('loading')))
      } else if (tab === 'home') {
        content = h(HomePage, { t, data, actions })
      } else if (tab === 'config') {
        content = h(ConfigPage, { t, data, actions })
      } else {
        const key = tab.slice(2)
        const project = (data.projects || []).find(item => item.key === key)
        content = project ? h(CanvasPage, { t, data, actions }) : h('div', { className: 'wbx-card', style: { marginTop: '12px' } }, t('loadError'))
      }

      const tokens = data?.globals?.tokens || {}
      return h('div', {
        className: 'wbx', id: 'dsh-workbench-root',
        style: {
          ...(tokens.radius ? { '--wbx-radius-user': tokens.radius + 'px' } : {}),
          ...(tokens.gap ? { '--wbx-gap-user': tokens.gap + 'px' } : {}),
          ...(tokens.accent ? { '--wbx-accent-user': tokens.accent } : {}),
        },
      },
        h('style', null, CSS),
        h('div', { className: 'wbx-wrap' },
          h('div', { className: 'wbx-head' },
            h('span', { className: 'wbx-dot' }),
            h('span', { className: 'wbx-title' }, t('title')),
            h('span', { className: 'wbx-sub' }, t('subtitle'))),
          h('div', { className: 'wbx-tabs', role: 'tablist' },
            h('button', { className: 'wbx-tab', type: 'button', role: 'tab', 'aria-selected': tab === 'home', onClick: () => setTab('home') }, t('home')),
            h('button', { className: 'wbx-tab', type: 'button', role: 'tab', 'aria-selected': tab === 'config', onClick: () => setTab('config') }, t('config')),
            openProjects.map(key => {
              const project = (data?.projects || []).find(item => item.key === key)
              if (!project) return null
              return h('button', {
                className: 'wbx-tab', type: 'button', key: key, role: 'tab',
                'aria-selected': tab === 'p:' + key,
                onClick: () => setTab('p:' + key),
              }, project.name,
                h('span', {
                  className: 'wbx-tab-x', role: 'button', 'aria-label': '关闭画布',
                  onClick: event => {
                    event.stopPropagation()
                    setOpenProjects(prev => prev.filter(item => item !== key))
                    if (tab === 'p:' + key) setTab('home')
                  },
                }, '✕'))
            })),
          notice ? h('div', { className: 'wbx-notice' + (notice.bad ? ' wbx-notice-bad' : ''), 'aria-live': 'polite' }, notice.text) : null,
          content))
    }

    const PANEL_KEY = 'dsh-workbench'

    const panelIcon = ({ size, active }) => h('svg', {
      width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      'aria-hidden': true, style: { display: 'block', opacity: active ? 1 : 0.78 },
    },
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 4, stroke: 'currentColor', strokeWidth: 1.7 }),
      h('circle', { cx: 8, cy: 12, r: 1.6, fill: 'currentColor' }),
      h('circle', { cx: 16, cy: 12, r: 1.6, fill: 'currentColor' }),
      h('path', { d: 'M9.6 12h4.8', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }))

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dshWorkbench', { en: EN, zh: ZH }), 'dsh-workbench locales')
        const t = ctx.locale.bind('dshWorkbench')
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: PANEL_KEY, locale: 'dshWorkbench',
        }, props => h(WorkbenchPanel, { ...props, t })))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_KEY, order: 25, locale: 'dshWorkbench',
          label: () => t('title'),
        }, panelIcon))
        return () => {}
      },
    }
  },
})
