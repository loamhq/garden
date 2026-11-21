const IC = {
  agent:
    '<path d="M17.5 34h3l-.4-12h-2.200z" fill="#7b5b3d"/><path d="M19 4l5 3 5 1 1 5 3 4-3 4-1 4-6 1-5 2-5-2-5-1-1-5-3-4 3-4 1-5 5-1z" fill="#5aa469"/><path d="M19 4l5 3 5 1 1 5-11 6z" fill="#74bd7c"/>',
  flower:
    '<path d="M19 35V19" stroke="#5aa469" stroke-width="2" fill="none"/><path d="M19 28c-4 0-6-2-7-5 4 0 6 2 7 5z" fill="#74bd7c"/><circle cx="19" cy="8" r="4.2" fill="#f2a65a"/><circle cx="12.500" cy="13" r="4.2" fill="#f6b877"/><circle cx="25.500" cy="13" r="4.2" fill="#f6b877"/><circle cx="15" cy="20" r="4.2" fill="#f2a65a"/><circle cx="23" cy="20" r="4.2" fill="#f2a65a"/><circle cx="19" cy="14.500" r="3.200" fill="#f6d55c"/>',
  chat: '<path d="M5 33c-3-6 0-11 4-12 0-5 5-8 10-6 4-3 10 0 10 5 4 1 6 7 3 13z" fill="#3f9c94"/><path d="M9 21c0-5 5-8 10-6 4-3 10 0 10 5-7-2-13-2-20 1z" fill="#5cb8ae"/><circle cx="13" cy="24" r="1.500" fill="#fff"/><circle cx="24" cy="21" r="1.500" fill="#fff"/><circle cx="19" cy="28" r="1.500" fill="#fff"/>',
  project:
    '<path d="M17.5 34h3l-.3-10 6-6-1.300-1.300-5 4.500V14h-2v8l-5-4.500L11.500 19l6 6z" fill="#5e4334"/><path d="M12 4l4 2 3 4-2 5-5 2-5-2-2-5 3-4z" fill="#e0a03c"/><path d="M26 6l4 2 3 4-2 5-5 1-4-3-1-5z" fill="#d9703c"/><path d="M19 2l3 2 1 4-4 3-4-3 1-4z" fill="#ecb85a"/>',
  app: '<path d="M17.5 34h3l-.4-10h-2.200z" fill="#7b5b3d"/><path d="M19 8c9-2 16 3 15 10-1 6-8 8-15 7-7 1-14-1-15-7C3 11 10 6 19 8z" fill="#4f9a5c"/><circle cx="11" cy="17" r="2.600" fill="#f08a3c"/><circle cx="20" cy="13" r="2.600" fill="#f08a3c"/><circle cx="27" cy="19" r="2.600" fill="#f08a3c"/><circle cx="17" cy="21" r="2.600" fill="#f08a3c"/>',
  change:
    '<path d="M4 24c0-5 7-8 15-8s15 3 15 8-7 8-15 8S4 29 4 24z" fill="#7fb4d8"/><path d="M10 23c2-3 6-4 10-4" stroke="#fff" stroke-width="1.500" fill="none" stroke-linecap="round"/><path d="M27 15l3-3 4 2-1 4z" fill="#9a9a94"/><path d="M4 18l3-2 3 2-1 3-4 0z" fill="#b0b0a8"/>',
  market:
    '<path d="M18 22h2v13h-2z" fill="#7b5b3d"/><path d="M11 12h16v12H11z" fill="#f3ead8"/><path d="M8 13L19 4l11 9z" fill="#c8553d"/><circle cx="19" cy="17" r="3" fill="#5e4334"/><path d="M27 8c2-2 5-1 5 1l2 1-2 1c0 2-3 3-5 1z" fill="#4d8fd6"/>',
  idea: '<path d="M18 28h2v7h-2z" fill="#7b5b3d"/><path d="M13 9h12c2 0 2 4 0 4h1c2 0 2 4 0 4h1c2 0 2 4 0 4h-1c2 0 2 4 0 4H12c-2 0-2-4 0-4h-1c-2 0-2-4 0-4h1c-2 0-2-4 0-4h1c-2 0-2-4 0-4z" fill="#e8b84a"/><ellipse cx="19" cy="22" rx="2.600" ry="2" fill="#5e4334"/><circle cx="31" cy="8" r="1.800" fill="#f6d55c"/><circle cx="6" cy="14" r="1.800" fill="#f6d55c"/>',
  code: '<path d="M12 31h14v3H12z" fill="#8c8c86"/><path d="M17 23h4v8h-4z" fill="#a3a39c"/><path d="M13 13h12v10H13z" fill="#b8b8b0"/><path d="M16 15h6v6h-6z" fill="#ffd27a"/><path d="M9 13L19 5l10 8z" fill="#8c8c86"/><path d="M17 3h4v3h-4z" fill="#a3a39c"/>',
}
IC.bed =
  '<ellipse cx="19" cy="24" rx="15" ry="8" fill="#896846"/><path d="m8 23 11-5m-5 9 13-6m-5 7 8-4" stroke="#b38a61" fill="none"/>'
export function icon(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 38 38')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = IC[kind]
  return svg
}
export const descriptions = {
  agent: [
    'Agents',
    'Each agent starts as a sprout and grows with its workspace.',
  ],
  bed: ['Cleared beds', 'A retired agent leaves a cleared bed.'],
  project: ['Projects', 'A maple adds limbs as its project folder grows.'],
  app: [
    'Apps',
    'Each app you make grows a fruit tree. Fruit grows as you open it in Apps and stays on the tree.',
  ],
  chat: [
    'Chats',
    'The twelve most recently active chats have shrubs. Earlier chats share a thicket. Long chats flower.',
  ],
  flower: [
    'Your files',
    'Each of your first 24 files grows a flower, then every five grow another. Older beds become meadow.',
  ],
  change: ['Changes to Loam', 'A plugin or theme made here adds a pond.'],
  market: [
    'Shared in the Market',
    'Each of your Market listings has a birdhouse. More birds arrive as downloads grow.',
  ],
  idea: [
    'Reports to the makers',
    'A reported issue grows a hive. A shipped label brings bees.',
  ],
  code: [
    'Contributions',
    'A lantern glows for merged pull requests. Further contributions add tiers.',
  ],
}
