window.__ModuleLoader__.load({
  id: 'dsh-workbench',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const en = {
      title: 'Workbench', subtitle: 'A persistent control room for long-running work.',
      eyebrow: 'PROJECT CONTINUITY', refresh: 'Refresh', loading: 'Loading workbench…',
      error: 'Could not read workbench files.', retry: 'Try again',
      mainline: 'Current line', stopped: 'Last checkpoint', next: 'Next actions', tasks: 'Task queue',
      redlines: 'Guardrails', decisions: 'Recent decisions', ledger: 'Ledger snapshot',
      noData: 'No data yet', noTasks: 'No active tasks.', noDecisions: 'No decisions recorded yet.',
      tokens: 'Tokens', green: 'Green cards', rework: 'Calls completed', updated: 'Updated',
      source: 'Live workspace files', readOnly: 'READ ONLY', ledgerRecent: 'Recent runs',
    }
    const zh = {
      title: '工作台', subtitle: '跨会话持续工作的控制台。',
      eyebrow: '项目接续', refresh: '刷新', loading: '正在读取工作台…',
      error: '无法读取工作台文件。', retry: '重试',
      mainline: '当前主线', stopped: '上次停在', next: '下一步', tasks: '任务队列',
      redlines: '红线', decisions: '近期决策', ledger: '账本快照',
      noData: '暂无数据', noTasks: '暂无进行中的任务。', noDecisions: '还没有记录决策。',
      tokens: 'Token', green: '绿卡数', rework: '已完成 / 总调用', updated: '更新时间',
      source: '实时工作区文件', readOnly: '只读', ledgerRecent: '最近运行',
    }

    const CSS = `
      .wb-page{box-sizing:border-box;min-height:100%;padding:32px clamp(20px,4vw,56px) 56px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:inherit}
      .wb-wrap{max-width:1120px;margin:0 auto}
      .wb-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:28px}
      .wb-kicker{font-size:11px;font-weight:700;letter-spacing:.18em;color:var(--dsw-alias-brand-primary);text-transform:uppercase}
      .wb-title{margin:8px 0 6px;font-size:clamp(28px,4vw,40px);line-height:1.1;letter-spacing:-.035em;font-weight:700}
      .wb-subtitle{margin:0;color:var(--dsw-alias-label-secondary);font-size:14px}
      .wb-actions{display:flex;align-items:center;gap:10px}
      .wb-badge{border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:5px 9px;color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:700;letter-spacing:.1em}
      .wb-button{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:9px 13px;font:inherit;font-size:13px;cursor:pointer}
      .wb-button:hover{border-color:var(--dsw-alias-brand-primary)}
      .wb-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(240px,.9fr);gap:16px}
      .wb-card{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);padding:20px 22px;box-shadow:0 4px 18px color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent)}
      .wb-card h2{margin:0 0 15px;font-size:13px;font-weight:700;letter-spacing:.04em;color:var(--dsw-alias-label-secondary)}
      .wb-main{grid-column:1/-1;position:relative;overflow:hidden;padding:26px 28px}
      .wb-main:after{content:'';position:absolute;inset:0 auto 0 0;width:3px;background:var(--dsw-alias-brand-primary)}
      .wb-mainline{font-size:clamp(19px,2.6vw,27px);line-height:1.45;font-weight:650;letter-spacing:-.02em;max-width:900px}
      .wb-stopped{margin-top:16px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6}
      .wb-list{list-style:none;padding:0;margin:0;display:grid;gap:10px}
      .wb-list li{display:flex;gap:11px;align-items:flex-start;font-size:14px;line-height:1.55}
      .wb-num{flex:0 0 22px;height:22px;display:grid;place-items:center;border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-brand-primary);font-size:11px;font-weight:700}
      .wb-guard{display:flex;gap:9px;align-items:flex-start;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
      .wb-guard:before{content:'•';color:var(--dsw-alias-state-warn-primary);font-weight:800}
      .wb-decisions{max-height:260px;overflow:auto;white-space:pre-wrap;font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-secondary)}
      .wb-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .wb-metric{border-radius:12px;background:var(--dsw-alias-bg-layer-2);padding:13px}
      .wb-metric strong{display:block;font-size:21px;line-height:1.2;font-weight:700}
      .wb-metric span{display:block;margin-top:5px;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-foot{display:flex;justify-content:space-between;gap:12px;margin-top:18px;color:var(--dsw-alias-label-secondary);font-size:11px}
      .wb-empty,.wb-error{padding:36px 20px;text-align:center;color:var(--dsw-alias-label-secondary)}
      .wb-error{color:var(--dsw-alias-state-error-primary)}
      @media(max-width:760px){.wb-page{padding:22px 16px 36px}.wb-top{flex-direction:column}.wb-actions{width:100%;justify-content:space-between}.wb-grid{grid-template-columns:1fr}.wb-main{grid-column:auto}.wb-metrics{grid-template-columns:1fr 1fr}}
    `

    function asList(value) {
      if (Array.isArray(value)) return value.filter(Boolean).map(String)
      if (typeof value === 'string') return value.split(/\r?\n|;/).map(x => x.replace(/^[-•\d.)\s]+/, '').trim()).filter(Boolean)
      return []
    }

    function WorkbenchPanel({ t }) {
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const load = React.useCallback(async () => {
        setBusy(true); setError(false)
        try {
          const response = await fetch('/dsh-workbench/api/state-v2', { cache: 'no-store', credentials: 'same-origin' })
          if (!response.ok) throw new Error('HTTP ' + response.status)
          const next = await response.json()
          if (!next || next.ok !== true) throw new Error('invalid response')
          setData(next)
        } catch { setError(true) } finally { setBusy(false) }
      }, [])
      React.useEffect(() => { load() }, [load])

      const state = data?.state || {}
      const next = asList(state.next)
      const redlines = asList(state.red_lines || state.redLines)
      const tasks = Array.isArray(data?.tasks) ? data.tasks : []
      const ledger = data?.ledger || {}
      const tokens = ledger.totalTokens ?? ledger.total_tokens ?? ledger.tokens ?? '—'
      const green = ledger.greenCards ?? ledger.green_cards ?? ledger.green ?? ledger.completed ?? '—'
      const rework = ledger.reworkRate ?? ledger.rework_rate ?? ledger.rework ?? (ledger.calls ? `${ledger.completed ?? 0}/${ledger.calls}` : '—')
      const recentRuns = Array.isArray(ledger.rows) ? ledger.rows.slice(-4).reverse() : []
      const decisions = data?.decisions?.trim()

      return h('div', { className: 'wb-page' },
        h('style', null, CSS),
        h('div', { className: 'wb-wrap' },
          h('header', { className: 'wb-top' },
            h('div', null,
              h('div', { className: 'wb-kicker' }, t('eyebrow')),
              h('h1', { className: 'wb-title' }, t('title')),
              h('p', { className: 'wb-subtitle' }, t('subtitle'))),
            h('div', { className: 'wb-actions' },
              h('span', { className: 'wb-badge' }, t('readOnly')),
              h('button', { className: 'wb-button', onClick: load, disabled: busy }, busy ? t('loading') : t('refresh')))),
          error ? h('section', { className: 'wb-card wb-error', role: 'alert' },
            h('p', null, t('error')),
            h('button', { className: 'wb-button', onClick: load }, t('retry'))) : !data ?
            h('section', { className: 'wb-card wb-empty', 'aria-live': 'polite' }, t('loading')) :
            h('div', { className: 'wb-grid' },
              h('section', { className: 'wb-card wb-main' },
                h('h2', null, t('mainline')),
                h('div', { className: 'wb-mainline' }, state.mainline || t('noData')),
                h('div', { className: 'wb-stopped' }, h('strong', null, t('stopped') + ' · '), state.stopped_at || state.stoppedAt || t('noData'))),
              h('section', { className: 'wb-card' },
                h('h2', null, t('next')),
                next.length ? h('ol', { className: 'wb-list' }, next.map((item, i) => h('li', { key: i }, h('span', { className: 'wb-num' }, String(i + 1)), h('span', null, item)))) : h('div', { className: 'wb-empty' }, t('noData'))),
              h('section', { className: 'wb-card' },
                h('h2', null, t('redlines')),
                redlines.length ? h('ul', { className: 'wb-list' }, redlines.map((item, i) => h('li', { className: 'wb-guard', key: i }, item))) : h('div', { className: 'wb-empty' }, t('noData'))),
              h('section', { className: 'wb-card' },
                h('h2', null, t('tasks')),
                tasks.length ? h('ul', { className: 'wb-list' }, tasks.map((item, i) => {
                  const value = typeof item === 'object' && item !== null
                    ? [item.id, item.status, item.goal || item.title || item.name || item.text].filter(Boolean).join(' · ')
                    : String(item)
                  return h('li', { className: 'wb-guard', key: i }, value)
                })) : h('div', { className: 'wb-empty' }, t('noTasks'))),
              h('section', { className: 'wb-card' },
                h('h2', null, t('ledger')),
                h('div', { className: 'wb-metrics' },
                  h('div', { className: 'wb-metric' }, h('strong', null, String(tokens)), h('span', null, t('tokens'))),
                  h('div', { className: 'wb-metric' }, h('strong', null, String(green)), h('span', null, t('green'))),
                  h('div', { className: 'wb-metric' }, h('strong', null, String(rework)), h('span', null, t('rework')))),
                recentRuns.length ? h('div', null,
                  h('h2', { style: { marginTop: 20 } }, t('ledgerRecent')),
                  h('ul', { className: 'wb-list' }, recentRuns.map((row, i) =>
                    h('li', { key: i },
                      h('span', { className: 'wb-num' }, String(row.id || '—')),
                      h('span', null, `${row.tier || ''} · ${row.model || ''} · ${row.total_tokens || 0} tokens · ${row.status || ''}`))))) : null),
              h('section', { className: 'wb-card' },
                h('h2', null, t('decisions')),
                h('div', { className: 'wb-decisions' }, decisions || t('noDecisions')))),
          data && h('footer', { className: 'wb-foot' },
            h('span', null, t('source')),
            h('span', null, t('updated') + ': ' + (data.fetchedAt || '—')))))
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
