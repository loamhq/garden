import { icon, descriptions } from './plants.js'

const base = '/x/garden/'
function localDay(now) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}
export function lineVisible(data, now = new Date()) {
  if (!data?.line || data.closed === localDay(now)) return false
  if (data.preview_line) return true
  const start = Date.parse(data?.started)
  return (
    Number.isFinite(start) &&
    now >= start &&
    now - start < 14 * 86400000 &&
    !!(data.news || Object.keys(data.ideas).length)
  )
}
function islandIcon(data) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 64 64')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.setAttribute('aria-hidden', 'true')
  const part = (tag, attrs) => {
    const n = document.createElementNS(svg.namespaceURI, tag)
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
    svg.append(n)
  }
  part('image', {
    href: new URL('../assets/icon.svg', import.meta.url).href,
    width: 64,
    height: 64,
  })
  if (data?.new)
    part('path', {
      fill: 'var(--signal-crema, #bc5845)',
      stroke: 'var(--paper-page, #fff)',
      'stroke-width': 1.25,
      d: 'M41 14Q44 3 59 2Q57 14 41 14Z',
    })
  return svg
}
export async function activate(loam) {
  const { h, host } = loam.ui
  let data,
    dead = false,
    pending = false,
    requested = false
  const cacheKey = 'chats-line-v1'
  let mutation = 0
  function update(next) {
    data = next
    // Store only the fields that paint the band, without news text or idea drafts.
    const saved = lineVisible(next) ? {
      counts: next.counts, new: next.new, news: !!next.news, started: next.started,
      line: next.line, preview_line: next.preview_line, closed: next.closed,
      changed: next.changed, suggested: next.suggested,
      ideas: Object.fromEntries(Object.entries(next.ideas).map(([k, idea]) => [k, { agent: idea.agent }])),
    } : null
    loam.settings.set(cacheKey, saved)
    host.schedule()
  }
  async function refresh() {
    if (dead || document.hidden) return
    if (pending) {
      requested = true
      return
    }
    pending = true
    const before = mutation
    try {
      const r = await fetch(base + 'summary')
      if (r.ok) {
        const next = await r.json()
        if (!dead && before === mutation) update(next)
      }
    } catch {
    } finally {
      pending = false
      if (requested) {
        requested = false
        refresh()
      }
    }
  }
  const open = () => {
    loam.commands.run('section.open', { id: 'apps' })
    loam.commands.run('panel.open', { item: { kind: 'app', url: base } })
  }
  loam.places['apps.icon'].add({ id: 'island', render: () => islandIcon(data) })
  loam.places['thread.list.line'].add({
    id: 'growth',
    render: () => {
      if (!lineVisible(data)) return null
      const compact = new Intl.NumberFormat(undefined, {
        notation: 'compact',
        maximumFractionDigits: 1,
      })
      const chips = Object.entries(descriptions).flatMap(([kind, [name]]) => {
        const count = data.counts[kind]
        if (!count) return []
        const idea = data.suggested?.includes(kind) && data.ideas[kind]
        const label = [
          name + ': ' + count.toLocaleString(),
          idea ? idea.agent + ' has an idea' : '',
        ]
          .filter(Boolean)
          .join(', ')
        return [
          h(
            'span',
            {
              class:
                'garden-tally' +
                (data.changed?.includes(kind) ? ' changed' : ''),
              title: label,
            },
            h(
              'span',
              { class: 'garden-kind' },
              icon(kind),
              idea
                ? h('i', {
                    class: 'garden-agent',
                    text: idea.agent.slice(0, 1).toUpperCase(),
                  })
                : null,
            ),
            h('span', {
              text: count >= 1000 ? compact.format(count) : String(count),
            }),
          ),
        ]
      })
      return h(
        'div',
        { class: 'garden-line' },
        h(
          'button',
          {
            class: 'garden-news' + (chips.length > 4 ? ' dense' : ''),
            onclick: open,
            'aria-label':
              'Open Garden. ' + chips.map((chip) => chip.title).join('. '),
          },
          h('span', { class: 'garden-island' }, islandIcon(data)),
          h('span', { class: 'garden-tallies' }, ...chips),
        ),
        h('button', {
          class: 'garden-close',
          'aria-label': 'Hide Garden until tomorrow',
          text: '×',
          onclick: async () => {
            const r = await fetch(base + 'close', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ day: localDay(new Date()) }),
            })
            if (r.ok) {
              const next = await r.json()
              if (dead) return
              mutation++
              update(next)
            }
          },
        }),
      )
    },
  })
  loam.ui.styles.add('page/garden.css')
  const draft = (body) => {
    if (typeof body?.agent === 'string' && typeof body?.text === 'string')
      loam.commands.run('chat.draft', body)
  }
  const message = (e) => {
    if (
      e.origin !== location.origin ||
      ![...document.querySelectorAll('iframe')].some(
        (f) => f.contentWindow === e.source && new URL(f.src).pathname === base,
      )
    )
      return
    const { garden, body } = e.data || {}
    if (garden === 'draft') draft(body)
    if (garden === 'refresh') refresh()
    if (garden === 'open' && typeof body?.href === 'string') {
      const url = new URL(body.href, location.origin)
      if (
        url.origin === location.origin &&
        (/^\/(threads|files|x)\//.test(url.pathname) ||
          ['/panel', '/', '/apps'].includes(url.pathname))
      )
        location.assign(url.href)
      else if (url.protocol === 'https:')
        window.open(url.href, '_blank', 'noopener,noreferrer')
    }
  }
  try {
    const stored = sessionStorage.getItem('garden.draft')
    if (stored) {
      sessionStorage.removeItem('garden.draft')
      draft(JSON.parse(stored))
    }
  } catch {}
  const saved = loam.settings.get(cacheKey)
  if (saved?.counts && saved.ideas && lineVisible(saved)) {
    try {
      const r = await fetch(base + 'line-controls', { signal: AbortSignal.timeout(1500) })
      if (r.ok) update({ ...saved, ...await r.json() })
    } catch {}
  }
  window.addEventListener('message', message)
  window.addEventListener('focus', refresh)
  const timer = setInterval(refresh, 30000)
  refresh()
  return () => {
    dead = true
    clearInterval(timer)
    window.removeEventListener('message', message)
    window.removeEventListener('focus', refresh)
  }
}
