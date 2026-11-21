import { drawIsland } from './island.js'
import { icon, descriptions } from './plants.js'
const button = document.querySelector('#gbtn'),
  guide = document.querySelector('#guide'),
  grows = document.querySelector('#grows')
const card = document.querySelector('#card'),
  hint = document.querySelector('#hint')
let data, expanded
function el(tag, text, cls) {
  const node = document.createElement(tag)
  if (text != null) node.textContent = text
  if (cls) node.className = cls
  return node
}
const rpc = async (path, body) => {
  const r = await fetch(
    path,
    body
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {},
  )
  if (!r.ok) throw Error('Garden could not read your island.')
  return r.json()
}
function send(action, body) {
  if (parent !== window) {
    parent.postMessage({ garden: action, body }, location.origin)
    return
  }
  if (action === 'draft') {
    sessionStorage.setItem('garden.draft', JSON.stringify(body))
    location.assign('/')
  } else if (action === 'open') location.assign(body.href)
}
function link(row) {
  switch (row.kind) {
    case 'agent':
      return '/panel?kind=profile&id=' + encodeURIComponent(row.id)
    case 'copse':
      return '/'
    case 'bed':
      return '/files/spaces/' + encodeURIComponent(row.id)
    case 'project':
      return (
        '/files/vault/' + row.id.split('/').map(encodeURIComponent).join('/')
      )
    case 'chat':
      return '/threads/' + encodeURIComponent(row.id)
    case 'app':
      return '/apps?url=' + encodeURIComponent(row.id)
    case 'change':
      return (
        '/?modal=settings&section=plugins&provider=' +
        encodeURIComponent(row.id)
      )
    case 'flower':
      return '/files/vault'
    case 'market':
    case 'idea':
    case 'code':
      return row.url
    default:
      return null
  }
}
function showCard(row) {
  card.classList.toggle('on', !!row)
  if (!row) return
  card.querySelector('b').textContent = row.name
  card.querySelector('span').textContent = {
    agent: 'Your agent grows this tree by keeping things in Files.',
    bed: 'An agent used to grow here. Their bed stays in your garden.',
    project: 'Your project grows a new branch as you add files to its folder.',
    app: 'An app you made. Fruit appears when you open it in Apps.',
    flower:
      'Your files bloom here. The older flowers grow together in the meadow.',
    chat: 'A chat with your agents. Its shrub fills out as you talk.',
    copse:
      'Your earlier chats grow together here. You can still open them in Chats.',
    change: 'This pond marks a plugin or theme made for your Loam.',
    market: 'You shared this in the Market. The first bird is here because your own Loam uses it.',
    idea: row.shipped
      ? 'The makers shipped a change you reported. Its hive now has bees.'
      : 'You brought an idea or issue to the makers. Bees arrive when it ships.',
    code: 'This lantern shines for code you helped add to Loam.',
  }[row.kind]
  const href = link(row),
    a = card.querySelector('a')
  a.hidden = !href
  if (href) {
    a.href = href
    a.onclick = (e) => {
      e.preventDefault()
      send('open', { href })
    }
  }
}
function drawGuide() {
  grows.replaceChildren()
  for (const [label, has] of [
    ['In your garden', true],
    ['Not here yet', false],
  ]) {
    const kinds = Object.keys(descriptions).filter(
      (k) => Boolean(data.counts[k]) === has && (k !== 'bed' || has),
    )
    if (!kinds.length) continue
    grows.append(el('h3', label))
    for (const k of kinds) {
      const [name, rule] = descriptions[k],
        description =
          rule +
          (data.unknown.includes(k) ? ' A public record is unavailable.' : ''),
        open = expanded === k,
        row = el(
          'button',
          null,
          'row' + (has ? '' : ' no') + (open ? ' open' : ''),
        )
      row.setAttribute('aria-expanded', String(open))
      row.append(icon(k))
      const copy = el('div'),
        title = el('b', name)
      if (has) title.append(el('i', data.counts[k].toLocaleString()))
      copy.append(title, el('span', description))
      row.append(copy)
      row.onclick = () => {
        expanded = open ? null : k
        drawGuide()
        grows.querySelector('[data-kind="' + k + '"]').focus()
      }
      row.dataset.kind = k
      grows.append(row)
      const idea = data.ideas[k]
      if (idea) {
        const bar = el('div', null, 'ideabar'),
          pill = el('button', null, 'idea'),
          dismiss = el('button', '×', 'dismiss')
        pill.append(
          el('em', idea.agent[0].toUpperCase()),
          document.createTextNode(idea.label),
          el('u', '›'),
        )
        pill.title = 'Start a draft with ' + idea.agent
        pill.onclick = () =>
          send('draft', { agent: idea.agent, text: idea.draft })
        dismiss.setAttribute('aria-label', 'Dismiss idea for ' + name)
        dismiss.onclick = async () => {
          data = await rpc('dismiss', { kind: k })
          drawGuide()
          send('refresh', {})
        }
        bar.append(pill, dismiss)
        grows.append(bar)
      }
    }
  }
}
function toggle(open) {
  document.body.classList.toggle('guide-open', open)
  guide.classList.toggle('on', open)
  guide.inert = !open
  button.setAttribute('aria-expanded', String(open))
  if (open) {
    drawGuide()
    showCard(null)
    document.querySelector('#gx').focus()
  } else button.focus()
}
button.onclick = async () => {
  if (!data) return
  toggle(true)
  try {
    const next = await rpc('state')
    if (
      guide.classList.contains('on') &&
      JSON.stringify(data.ideas) !== JSON.stringify(next.ideas)
    ) {
      data = next
      drawGuide()
    }
  } catch {}
}
document.querySelector('#gx').onclick = () => toggle(false)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    toggle(false)
    showCard(null)
  }
})
function mode() {
  try {
    if (parent !== window && parent.document.documentElement.dataset.theme)
      return parent.document.documentElement.dataset.theme === 'dark'
  } catch {}
  return matchMedia('(prefers-color-scheme:dark)').matches
}
const dark = mode()
document.documentElement.classList.toggle('dark', dark)
if (parent !== window) {
  try {
    new MutationObserver(() => {
      if (dark !== mode()) location.reload()
    }).observe(parent.document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  } catch {}
}
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {
  if (dark !== mode()) location.reload()
})
try {
  data = await rpc('state')
  try {
    drawIsland(data, showCard, dark)
    hint.textContent = 'Drag to turn · pinch or scroll to zoom · tap to explore'
  } catch (e) {
    console.error(e)
    hint.textContent = 'Open What grows here to explore your garden.'
    toggle(true)
  }
  await rpc('seen', { revision: data.revision })
  send('refresh', {})
} catch (e) {
  hint.textContent = e.message
  const retry = el('button', 'Try again')
  retry.onclick = () => location.reload()
  hint.style.pointerEvents = 'auto'
  hint.append(' ', retry)
}
