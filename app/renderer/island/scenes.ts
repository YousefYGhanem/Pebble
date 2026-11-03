import type { Scene } from '../../shared/island'
import type { Session, Step } from '../../shared/state'
import type { ExtrasState } from '../../shared/extras'
import type { Page } from './pages'
import type { Widget } from '../../shared/connectors'

// Test mode (tray → Test mode): what each demo scene shows. Pretend sessions only live in the renderer;
// answering one changes it here and never reaches an agent.

export interface SceneSetup {
  sessions: Session[]
  open?: boolean
  tucked?: boolean
  split?: boolean
  /** pretend music, files, notes… */
  extras?: Partial<ExtrasState>
  page?: Page
  dropping?: boolean
  widgets?: Widget[]
}

const COVER = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b6b"/><stop offset="1" stop-color="#6b5bff"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><circle cx="60" cy="60" r="26" fill="#fff" opacity=".85"/></svg>')

function demoExtras(now: number): Partial<ExtrasState> {
  return {
    media: { app: 'Spotify.exe', title: 'Paper Planes at Dawn', artist: 'The Quiet Maps', album: 'Low Orbit', playing: true, positionMs: 62_000, durationMs: 214_000, updatedAt: now, canSeek: true, canNext: true, canPrevious: true },
    art: COVER,
    lyrics: [{ t: 52_000, text: 'We folded every letter into wings' }, { t: 58_000, text: 'and let the morning carry what we meant' }, { t: 66_000, text: 'over rooftops, over everything' }],
    shelf: [
      { path: 'C:\\demo\\report.pdf', name: 'report.pdf', icon: '', size: 482_000, addedAt: now },
      { path: 'C:\\demo\\logo.png', name: 'logo.png', icon: COVER, size: 38_000, addedAt: now },
      { path: 'C:\\demo\\notes.txt', name: 'notes.txt', icon: '', size: 2_100, addedAt: now }
    ],
    clipboard: [
      { id: 3, text: 'npm run build && npm run capture', at: now - 40_000 },
      { id: 2, text: 'https://lrclib.net/docs', at: now - 600_000 },
      { id: 1, text: 'Thanks! I will have a look tomorrow morning and get back to you.', at: now - 3_600_000 }
    ],
    notes: [{ id: 'n1', text: 'Release checklist\n- sign the installer\n- update the changelog', at: now }, { id: 'n2', text: 'Ideas: a calmer goodbye', at: now - 86_400_000 }],
    system: { cpu: 23, ram: 61 },
    radios: { wifi: true, bluetooth: false }
  }
}

export function sceneSetup(scene: Scene, now = Date.now()): SceneSetup {
  const steps: Step[] = [
    { at: now - 70e3, kind: 'read', text: 'Read cart.js' },
    { at: now - 60e3, kind: 'search', text: 'Grep "total"' },
    { at: now - 40e3, kind: 'run', text: 'Bash: npm test' },
    { at: now - 20e3, kind: 'edit', text: 'Edit cart.js' }
  ]
  const base = (status: Session['status'], detail: string, extra: Partial<Session> = {}): Session => ({
    id: 'demo-' + status, agent: 'claude', project: 'webshop', cwd: 'C:\\code\\webshop', status, detail, at: now,
    prompt: 'fix the cart total when a coupon is used', startedAt: now - 83e3, steps, files: ['C:\\code\\webshop\\cart.js'],
    model: 'Opus 5.5', context: 38, windowPid: 1, ...extra
  })
  const working = base('running', 'Edit cart.js', {
    diff: { file: 'C:\\code\\webshop\\cart.js', line: 42, removed: ['  return items.reduce((t, i) => t + i.price, 0)'], added: ['  const sum = items.reduce((t, i) => t + i.price * i.qty, 0)', '  return coupon ? sum * (1 - coupon.off) : sum'] }
  })
  const done = base('done', 'Fixed: the total now applies the coupon after quantities.', {
    message: 'Fixed: the total now applies the coupon after quantities.\n\nI changed `cart.js` (total) and added two tests in `cart.test.js`. All 14 tests pass.'
  })
  const extras = demoExtras(now)
  switch (scene) {
    case 'music': return { sessions: [], extras }
    case 'music-agent': return { sessions: [working], extras }
    case 'focus': return { sessions: [], extras: { focus: { seconds: 1500, endsAt: now + 1_122_000 } } }
    case 'drop': return { sessions: [], dropping: true }
    case 'activity': return { sessions: [], widgets: [{ plugin: 'scores', id: 'live', kind: 'activity', title: 'Live', text: 'ARS 2–1 CHE · 67\'', icon: '⚽', at: now }] }
    case 'page-widgets': return { sessions: [], open: true, page: 'widgets', widgets: [
      { plugin: 'github', id: 'card', kind: 'card', title: 'GitHub', icon: 'agents', text: '2 reviews for you', tone: 'warn', lines: ['Review: Fix cart total', 'Review: Add Mollie', '7 unread notifications'], link: 'https://github.com', at: now },
      { plugin: 'weather', id: 'card', kind: 'card', title: 'Amsterdam', icon: '⛅', text: '14°', lines: ['Rain in the next hour'], at: now },
      { plugin: 'scores', id: 'card', kind: 'card', title: 'Scores', icon: '⚽', text: 'ARS 2–1 CHE', lines: ["67'"], tone: 'ok', at: now },
      { plugin: 'calendar', id: 'card', kind: 'card', title: 'Next', icon: 'focus', text: 'Design review', lines: ['in 25 min', 'Lunch with Sam'], at: now },
      { plugin: 'deepseek', id: 'card', kind: 'card', title: 'DeepSeek', icon: 'agents', text: '$4.12 left', tone: 'ok', at: now },
      { plugin: 'rss', id: 'card', kind: 'card', title: 'News', icon: 'notes', text: 'Electron 46 released', lines: ['Svelte 6 preview', 'Node 27 is out'], at: now }
    ] }
    case 'page-home': return { sessions: [working], extras: { ...extras, focus: { seconds: 1500, endsAt: now + 1_122_000 } }, open: true, page: 'home' }
    case 'page-music': return { sessions: [], extras, open: true, page: 'music' }
    case 'page-files': return { sessions: [], extras, open: true, page: 'files' }
    case 'page-phone': return { sessions: [], extras: { ...extras, drop: { url: 'http://192.168.1.20:51234/demo', qr: COVER, connected: false, received: 0, expiresAt: now + 3_400_000 } }, open: true, page: 'files' }
    case 'page-clipboard': return { sessions: [], extras, open: true, page: 'clipboard' }
    case 'page-notes': return { sessions: [], extras, open: true, page: 'notes' }
    case 'page-focus': return { sessions: [], extras: { focus: { seconds: 1500, endsAt: now + 1_122_000 } }, open: true, page: 'focus' }
    case 'working': return { sessions: [working] }
    case 'ask': return { sessions: [base('question', 'Bash: npm install stripe', { ask: { kind: 'permission', tool: 'Bash', summary: 'Bash: npm install stripe', input: { command: 'npm install stripe' }, canAlways: true } })] }
    case 'question': return {
      sessions: [base('question', 'Which payment provider?', {
        ask: { kind: 'question', input: {}, questions: [{ question: 'Which payment provider should checkout use?', header: 'Payments', options: [{ label: 'Stripe', description: 'Cards, iDEAL, Apple Pay' }, { label: 'Mollie', description: 'Popular in NL' }, { label: 'PayPal' }] }] }
      })]
    }
    case 'plan': return {
      open: true,
      sessions: [base('question', 'A plan is ready', {
        ask: { kind: 'plan', input: {}, plan: '## Fix the cart total\n\n1. Multiply by **quantity** in `total()`\n2. Apply the coupon *after* the sum\n3. Add tests:\n   - coupon + quantity\n   - no coupon\n\n```js\nconst sum = items.reduce(...)\n```' }
      })]
    }
    case 'done': return { sessions: [done] }
    case 'reply': return { open: true, sessions: [{ ...done, replyable: true }] }
    case 'error': return { sessions: [base('error', 'Stopped with an error: API overloaded')] }
    case 'open': return {
      open: true,
      sessions: [working, { ...done, id: 'demo-blog', project: 'blog' }, { ...base('running', 'Bash: npm test'), id: 'demo-api', project: 'api', agent: 'codex' }]
    }
    case 'split': return { sessions: [working], split: true }
    case 'tucked': return { sessions: [working], tucked: true }
    default: return { sessions: [] } // resting, hello, bye, jelly
  }
}
