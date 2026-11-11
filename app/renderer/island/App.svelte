<script lang="ts">
  import { untrack } from 'svelte'
  import type { Answer, IslandState } from '../../shared/ipc'
  import { AGENT_NAMES, recommended, risky, type Session, type Status } from '../../shared/state'
  import type { Scene } from '../../shared/island'
  import { applyTheme } from '../theme'
  import { locale, setLanguage, t } from '../i18n.svelte'
  import AgentsPage from './AgentsPage.svelte'
  import HomePage from './HomePage.svelte'
  import MusicPage from './MusicPage.svelte'
  import FilesPage from './FilesPage.svelte'
  import ClipboardPage from './ClipboardPage.svelte'
  import NotesPage from './NotesPage.svelte'
  import FocusPage from './FocusPage.svelte'
  import WidgetsPage from './WidgetsPage.svelte'
  import ChatPage from './ChatPage.svelte'
  import PageNav from './PageNav.svelte'
  import Wave from './Wave.svelte'
  import { fly } from 'svelte/transition'
  import { emitPeak } from './peak'
  import { PAGES, albumColor, clock, type Page } from './pages'
  import { focusLeft, lyricIndex, positionNow, type Action, type ExtrasState } from '../../shared/extras'
  import type { Widget } from '../../shared/connectors'
  import { chirp, type Chirp } from './sound'
  import { RectSpring, Spring, contentOpacity, jelly, type Rect } from './spring'
  import { modeFor, rank, sizeFor, type Mode } from './layout'
  import { drawIsland, drawSplitPill, islandPath } from './draw'
  import { dayStart, drawSkin, skinFor } from './skins'
  import Icon from './Icon.svelte'
  import StatusMark from './StatusMark.svelte'
  import { undo } from './undo.svelte'
  import { drawPip, HATS } from './pip'
  import { pipColors } from '../../shared/pip'
  import { confetti, hearts, particlesAlive, stepParticles } from './particles'
  import { moodFor, outfitFor, type Mood } from '../../shared/pip'
  import { sceneSetup } from './scenes'

  // ---------- state (Svelte) ----------
  let view = $state<IslandState | null>(null)
  let scene = $state<Scene | null>(null)
  let sceneSessions = $state<Session[]>([])
  let split = $state(false)
  let open = $state(false)
  let tucked = $state(false)
  // gone: after goodbye the island stays closed (quitting, or until the test scene says hello again)
  let phase = $state<'hello' | 'normal' | 'bye' | 'gone'>('hello')
  let now = $state(Date.now())
  let contentHeight = $state(0)
  let systemReduced = $state(matchMedia('(prefers-reduced-motion: reduce)').matches)
  let canvas = $state<HTMLCanvasElement>()
  let clip = $state<HTMLDivElement>()
  let content = $state<HTMLDivElement>()
  let selected = $state<string>() // the session shown on the Agents page
  let page = $state<Page>('home')
  let lastPage: Page = 'home'
  const started = dayStart() // living skins: how long today has been
  let dropping = $state(false) // a file is being dragged over the island
  let album = $state<string | null>(null) // the album's colour, "r, g, b"
  let sceneExtras = $state<Partial<ExtrasState>>({})
  let sceneWidgets = $state<Widget[] | null>(null)

  const sessions = $derived(scene ? sceneSessions : (view?.sessions ?? []))
  const shown = $derived(view ? rank(sessions, view.settings.features.doneSeconds, now) : [])
  const top = $derived<Session | undefined>(shown[0])
  const extras = $derived<ExtrasState | undefined>(view ? { ...view.extras, ...(scene ? sceneExtras : {}) } : undefined)
  const music = $derived(!!view?.settings.music.enabled && !!extras?.media?.playing)
  // ---------- peeks: a short line for a moment when something on the PC changes ----------
  let notice = $state<{ icon: string; text: string; n: number } | null>(null)
  let noticeN = 0
  function peek(icon: string, text: string) {
    if (scene || !view?.settings.features.peeks) return
    const n = ++noticeN
    notice = { icon, text, n }
    setTimeout(() => { if (notice?.n === n) notice = null }, 2800)
  }
  // a language code in your language's words ("ar-SA" → "Arabic")
  const languageName = (code: string) => { try { return new Intl.DisplayNames([locale()], { type: 'language' }).of(code.split('-')[0]!) ?? code } catch { return code } }
  const focusOn = $derived(!!extras?.focus)
  const busy = $derived(shown.find(x => x.status !== 'ready'))
  const widgets = $derived<Widget[]>(sceneWidgets ?? view?.widgets ?? [])
  /** a connector's live thing (a match, a call, an upload): it takes the small island while it lasts */
  const activity = $derived(widgets.find(w => w.kind === 'activity'))
  const chipText = (c: string) => widgets.find(w => `widget:${w.plugin}/${w.id}` === c)?.text ?? ''
  const mode = $derived<Mode>(phase === 'normal' ? modeFor({ tucked, open, sessions: shown, extra: music || focusOn || dropping || !!activity || !!notice }) : 'resting')
  /** what the medium island shows: a drop > music > an agent > a connector's live activity > the focus timer */
  const medium = $derived<'drop' | 'notice' | 'music' | 'agent' | 'activity' | 'focus'>(dropping ? 'drop' : notice ? 'notice' : music && !(busy && busy.status === 'error') ? 'music' : busy ? 'agent' : activity ? 'activity' : focusOn ? 'focus' : 'agent')
  const chips = $derived(view ? [view.settings.island.chips.left, view.settings.island.chips.right] : ['none', 'none'])
  const chipCount = $derived(chips.filter(c => c !== 'none').length)
  const lyric = $derived(extras?.lyrics && extras.media ? extras.lyrics[lyricIndex(extras.lyrics, positionNow(extras.media, now) + 250)]?.text ?? '' : '')
  let battery = $state<{ level: number; charging: boolean } | null>(null)
  const reduced = $derived(view ? (view.settings.motion.mode === 'system' ? systemReduced : view.settings.motion.mode === 'reduced') : false)
  const target = $derived.by(() => {
    if (!view) return { w: 0, h: 0, r: 0 }
    const t = sizeFor(mode, view.settings.island, contentHeight)
    const room = chips.reduce((n, c) => n + (c === 'none' ? 0 : c.startsWith('widget:') ? 110 : 52), 0)
    return mode === 'resting' && room ? { ...t, w: t.w + room } : t // room for the chips left and right of Pip
  })
  const asking = $derived(shown.find(x => x.ask))
  /** a question small enough to answer right in the compact card: one question, up to three options, one choice */
  const quick = $derived(asking?.ask?.kind === 'question' && asking.ask.questions.length === 1 && !asking.ask.questions[0]!.multiSelect && asking.ask.questions[0]!.options.length <= 3 ? asking.ask.questions[0] : undefined)

  // ---------- motion (plain objects, stepped every frame; Svelte never sees these) ----------
  const DOT: Rect = { w: 14, h: 0, r: 7 }
  const rect = new RectSpring(DOT)
  const top0 = new Spring(0) // the island's top: floating sits a little below the edge, tucked hugs it
  const splitW = new Spring(0)
  const eyes = new Spring(0) // 0 closed … 100 open
  const eyeDx = new Spring(0) // eyes relative to the island's centre / top
  const eyeY = new Spring(16)
  let kickAt = -1, running = false, last = 0, byeThen: (() => void) | null = null

  // ---------- Pip ----------
  const lookX = new Spring(0), lookY = new Spring(0) // eyes follow the mouse (×100)
  let pokes: number[] = [], lovedAt = 0, happyAt = 0, worriedAt = 0, pokedAt = 0, blinkAt = -1e9, wink = false
  let pipAt = { x: 0, y: 0, r: 0 } // where Pip is drawn now (for poking)
  const images = new Map<string, HTMLImageElement>() // your own outfits
  /** test mode can show any mood */
  const forced = $derived<Mood | null>(scene?.startsWith('pip-') ? (scene.slice(4) as Mood) : null)
  const outfit = $derived(view ? outfitFor(view.settings.pip.outfit, view.pip.done, new Date(now), view.pip.custom.map(c => c.id)) : null)
  const say = (c: Chirp) => { if (view?.settings.features.sound) chirp(c) }
  /** a short mood ends by itself: draw once more when it does */
  const later = (ms: number) => setTimeout(wake, ms)

  function scheduleBlink() {
    // tucked away, Pip is not drawn: no blinks to draw either
    setTimeout(() => { if (mode !== 'tucked') { blinkAt = performance.now(); wink = Math.random() < 1 / 6; wake() } scheduleBlink() }, 2000 + Math.random() * 4000)
  }
  scheduleBlink()

  function love(x = pipAt.x, y = pipAt.y + pipAt.r) { lovedAt = Date.now(); hearts(x, y); say('love'); wake(); later(2600) }

  function poke() {
    const t = Date.now()
    pokes = [...pokes.filter(p => t - p < 3000), t]
    pokedAt = t
    say(pokes.length >= 6 ? 'dizzy' : pokes.length >= 3 ? 'grumpy' : 'poke')
    kick()
    later(3100)
  }

  // ---------- targets follow the state ----------
  $effect(() => {
    if (!view) return
    const s = view.settings.island
    if (phase === 'hello' || phase === 'normal') rect.setTarget(target)
    top0.target = s.style === 'floating' && mode !== 'tucked' ? s.offsetTop : 0
    splitW.target = (split || (medium === 'music' && !!busy)) && phase === 'normal' && (mode === 'medium' || mode === 'resting') ? 36 : 0
    // open: in the top right corner (every page header keeps that room free: .pip-room)
    eyeDx.target = mode === 'medium' ? target.w / 2 - 26 : mode === 'ask' ? target.w / 2 - 30 : mode === 'open' ? target.w / 2 - 50 : 0
    eyeY.target = mode === 'ask' ? 20 : mode === 'open' ? 22 : target.h / 2
    if (reduced) for (const sp of [top0, splitW, eyeDx, eyeY]) { sp.value = sp.target; sp.velocity = 0 }
    if (reduced && phase === 'normal') rect.snap(target)
    void top?.status, view.theme // a colour change needs a frame too
    wake()
  })

  // ---------- events from main ----------
  let lastStatus: Record<string, Status> = {}
  // read out by screen readers (WCAG 4.1.3): what finished or stopped (polite), what needs you (an alert)
  let said = $state(''), alerted = $state('')

  function noticeChanges(list: Session[]) {
    for (const x of list) {
      const before = lastStatus[x.id]
      if (x.status === 'done' && before && before !== 'done') {
        said = t('i.sr.done', { project: x.project })
        happyAt = Date.now(); kick(); say('done'); later(3100)
        if (x.startedAt && Date.now() - x.startedAt > 120_000) confetti(innerWidth / 2, top0.value + rect.value.h) // a long task
      }
      if (x.ask && before !== 'question') { alerted = t('i.sr.asks', { project: x.project, text: x.ask.kind === 'permission' ? x.ask.summary : x.detail }); kick(); say('question') }
      if (x.status === 'error' && before && before !== 'error') said = t('i.sr.stopped', { project: x.project })
    }
    lastStatus = Object.fromEntries(list.map(x => [x.id, x.status]))
  }

  window.pebble.onState(s => {
    applyTheme(s.theme)
    setLanguage(s.settings.general.language, false)
    const first = !view
    if (view && s.pip.achievements.length > view.pip.achievements.length) { confetti(innerWidth / 2, top0.value + rect.value.h); say('achievement'); love() }
    for (const c of s.pip.custom) if (!images.has(c.id)) { const img = new Image(); img.onload = () => wake(); img.src = c.data; images.set(c.id, img) }
    view = s
    if (!scene) noticeChanges(s.sessions)
    if (first) startHello()
    // a focus timer ran out (not stopped by hand): Pip is happy and chimes
    if (prevFocus?.endsAt && !s.extras.focus && prevFocus.endsAt - Date.now() < 2000) { happyAt = Date.now(); kick(); say('done'); later(3100) }
    prevFocus = s.extras.focus
    // you are back after Pip fell asleep: he wakes up glad to see you
    if (prevSleepy && !s.pip.sleepy && !scene) { happyAt = Date.now(); kick(); say('hello'); later(3100) }
    prevSleepy = s.pip.sleepy
    // an update is ready: one peek (the Home page keeps the button)
    if (s.update && s.update !== lastUpdate) peek('download', t('i.peek.update', { version: s.update }))
    lastUpdate = s.update
    if (s.extras.art !== lastArt) { lastArt = s.extras.art; album = null; if (lastArt) albumColor(lastArt).then(c => (album = c)) }
  })
  let prevFocus: ExtrasState['focus'] = null, lastArt: string | null = null, prevSleepy = false, lastUpdate: string | null = null
  window.pebble.onPeak(emitPeak)
  ;(navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener(e: string, f: () => void): void }> }).getBattery?.().then(b => {
    const read = () => (battery = { level: Math.round(b.level * 100), charging: b.charging })
    read(); b.addEventListener('levelchange', read)
    // plugged in: a peek with the battery's level
    b.addEventListener('chargingchange', () => { read(); if (b.charging) peek('battery', t('i.peek.charging', { n: Math.round(b.level * 100) })) })
  }).catch(() => {})

  // opened or closed: the welcome tour ticks it off while you try
  $effect(() => { const on = mode === 'open'; if (!scene) window.pebble.opened(on) })
  // tucked away: every service rests (main), until the island comes back
  $effect(() => { const on = mode === 'tucked'; if (!scene) window.pebble.tucked(on) })

  // opening the island: the Agents page when an agent has something to show, else the page you were on
  $effect(() => {
    if (!open) return
    // decided once, when it opens (later session updates must not pull you away from the page you went to)
    page = untrack(() => shown.some(x => x.ask || x.status === 'running' || (x.status === 'done' && !x.seenAt) || x.status === 'error')) ? 'agents' : untrack(() => lastPage)
  })
  let pageDir = $state(1)
  let pagePrev: Page = 'home'
  $effect(() => {
    const i = PAGES.findIndex(p => p.id === page), j = PAGES.findIndex(p => p.id === pagePrev)
    pageDir = i >= j ? 1 : -1
    pagePrev = page
    lastPage = page
  })
  const act = (a: Action) => { if (!scene) window.pebble.act(a) }
  window.pebble.onExpand(id => { tucked = false; open = true; if (id) { selected = id; queueMicrotask(() => (page = 'agents')) } })
  // a shortcut opened a page (voice: start listening in the chat's message box)
  let listen = $state(0)
  window.pebble.onPage((p, l) => { tucked = false; open = true; lastPage = p as Page; queueMicrotask(() => (page = p as Page)); if (l) listen++ })
  let voice: HTMLAudioElement | undefined
  window.pebble.onWorry(() => { worriedAt = Date.now(); kick(); say('question'); later(4100) })
  window.pebble.onPlay(url => { voice?.pause(); voice = url ? new Audio(url) : undefined; void voice?.play() })
  window.pebble.onToggle(() => {
    if (tucked) { tucked = false; open = true } else open = !open
    if (open) focusFirst(); else window.pebble.release()
  })
  // the toggle shortcut gave the island the keyboard (main): start on the question if there is one, else the page row
  function focusFirst() {
    setTimeout(() => (clip?.querySelector<HTMLElement>('.ask button, .buttons button, [role=tab][tabindex="0"]'))?.focus(), 80)
  }
  // Esc closes the island and gives the keyboard back to the app you were in (a question stays unanswered)
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    open = false
    window.pebble.release()
  })
  window.pebble.onTuck(() => { tucked = !tucked; open = false })
  window.pebble.onNotice(n => {
    if (n.kind === 'device') peek('speaker', t('i.peek.device', { name: n.name }))
    else if (n.kind === 'caps') peek('keyboard', t(n.on ? 'i.peek.capsOn' : 'i.peek.capsOff'))
    else if (n.kind === 'keyboard') peek('keyboard', t('i.peek.keyboard', { lang: languageName(n.lang) }))
    else if (n.kind === 'mute') peek('speaker', t(n.on ? 'i.peek.muted' : 'i.peek.unmuted'))
    else if (n.kind === 'mic') peek(n.on ? 'micoff' : 'mic', t(n.on ? 'i.peek.micOff' : 'i.peek.micOn'))
  })
  // the network dropped, or came back
  addEventListener('offline', () => peek('wifi', t('i.peek.offline')))
  addEventListener('online', () => peek('wifi', t('i.peek.online')))
  window.pebble.onPeek(on => { tucked = on; open = false })
  window.pebble.onBye(() => startBye(() => window.pebble.byeDone()))
  window.pebble.onScene(s => {
    scene = s
    const setup = s ? sceneSetup(s) : { sessions: [] }
    sceneSessions = setup.sessions
    sceneExtras = setup.extras ?? {}
    sceneWidgets = setup.widgets ?? null
    dropping = !!setup.dropping
    open = !!setup.open; tucked = !!setup.tucked; split = !!setup.split
    if (setup.page) { const p = setup.page; lastPage = p; queueMicrotask(() => (page = p)) }
    lastStatus = {}
    if (phase === 'gone' && s !== 'bye') phase = 'normal' // another scene after the goodbye scene
    if (s === 'hello') startHello()
    if (s === 'bye') startBye(() => setTimeout(startHello, 600))
    if (s === 'jelly' || s === 'done' || s === 'ask') kick()
    if (s === 'done') say('done')
    if (s === 'pip-happy') { happyAt = Date.now(); confetti(innerWidth / 2, top0.value + rect.value.h); say('done') }
    if (s === 'pip-love') love()
    if (s === 'pip-dizzy' || s === 'pip-grumpy') kick()
    wake()
  })
  window.pebble.ready()
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => (systemReduced = e.matches))
  addEventListener('resize', wake) // another screen or scale
  setInterval(() => { now = Date.now(); if (extras?.focus?.endsAt) wake() }, 1000) // the focus ring moves on each second

  // ---------- hello, goodbye, jelly ----------
  // Hello: a dot comes out of the top edge, springs open into the resting pill, the eyes grow from a line, a wobble.
  function startHello() {
    phase = 'hello'
    rect.snap(DOT)
    eyes.value = eyes.target = 0
    say('hello')
    wake()
    setTimeout(kick, reduced ? 0 : 480)
    setTimeout(() => (phase = 'normal'), reduced ? 0 : 1100)
  }

  // Goodbye: the eyes close, then the island shrinks back into the edge; then (quitting) Pebble ends.
  function startBye(then: () => void) {
    if (reduced) { phase = 'gone'; rect.snap(DOT); wake(); then(); return }
    phase = 'bye'
    say('bye')
    byeThen = then
    open = false
    wake()
  }

  function kick() { if (!reduced) { kickAt = performance.now(); wake() } }

  // ---------- the frame loop: runs only while something moves (0 fps when the island rests) ----------
  // at most ~60 fps: a 144/240 Hz screen would otherwise draw (and the GPU compose) every motion 2-4 times as often
  const next = () => setTimeout(() => requestAnimationFrame(frame), 12)
  function wake() {
    if (running) return
    running = true
    last = 0
    requestAnimationFrame(frame)
  }

  function frame(t: number) {
    if (!view || !canvas) { running = false; return }
    const dt = last ? Math.min(1 / 20, (t - last) / 1000) : 1 / 60
    last = t
    const speed = view.settings.motion.speed

    eyes.target = phase === 'bye' || phase === 'gone' ? 0 : phase === 'hello' ? (rect.progress() > 0.85 ? 100 : 0) : 100
    if (phase === 'bye') {
      if (eyes.value < 5) rect.setTarget(DOT)
      if (rect.h.target === 0 && rect.h.value < 0.6) { const then = byeThen; byeThen = null; phase = 'gone'; rect.snap(DOT); then?.() }
    }
    rect.step(dt, speed)
    for (const [sp, response] of [[top0, 0.38], [splitW, 0.38], [eyes, 0.2], [eyeDx, 0.38], [eyeY, 0.38], [lookX, 0.25], [lookY, 0.25]] as const) sp.step(dt, response / speed, 1)
    if (kickAt >= 0 && t - kickAt > 1200) kickAt = -1

    let mood: Mood = 'idle'
    try { mood = draw(t, dt) } catch (err) { console.error('island frame:', err) } // one bad frame must never stop the island

    const moving = !rect.settled || [top0, splitW, eyes, eyeDx, eyeY, lookX, lookY].some(sp => !sp.settled)
    const blinking = t - blinkAt < 160
    const lively = mood === 'dizzy' || mood === 'dancing' || particlesAlive() // moods that move by themselves
    if (moving || blinking || lively || kickAt >= 0 || phase === 'hello' || phase === 'bye' || splitW.value > 0) next()
    else running = false
  }

  function draw(t: number, dt: number): Mood {
    const ctx = canvas!.getContext('2d')!
    const W = innerWidth, H = innerHeight, dpr = devicePixelRatio
    if (canvas!.width !== Math.round(W * dpr) || canvas!.height !== Math.round(H * dpr)) {
      canvas!.width = Math.round(W * dpr)
      canvas!.height = Math.round(H * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const s = view!.settings, tok = view!.theme.tokens
    const v = rect.value
    const k = kickAt >= 0 ? jelly((t - kickAt) / 1000) : 0 // squash and stretch
    const w = v.w * (1 + k), h = Math.max(0, v.h * (1 - k * 0.6))
    const box = { x: W / 2 - w / 2, y: top0.value, w, h, r: v.r }
    const status: Status = top?.status ?? 'ready'
    const colorOf = (st: Status) => ({ ready: tok.ready, running: tok.running, done: tok.done, error: tok.error, question: tok.question })[st]
    const line = status === 'ready' ? tok.muted : colorOf(status)
    const thin = h < 8 && mode === 'tucked'

    drawIsland(ctx, box, {
      notch: s.island.style === 'notch',
      fill: thin ? line : tok.background,
      alpha: thin ? 1 : 1 - s.island.seeThrough / 100,
      shadow: s.island.style === 'floating' && !thin
    })
    // tucked, the line's pattern says the state without its colour: dashed = stopped, dotted = needs you
    if (thin && (status === 'error' || status === 'question')) {
      const step = status === 'error' ? 14 : 7, gap = status === 'error' ? 5 : 3
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      for (let x = box.x + step; x < box.x + box.w - step; x += step) ctx.fillRect(x, box.y - 1, gap, box.h + 2)
      ctx.restore()
    }

    if (s.island.skins && !thin && mode === 'resting') {
      const d = new Date()
      drawSkin(ctx, box, s.island.style === 'notch', skinFor({ cpu: view!.extras.system.cpu, hour: d.getHours(), dayHours: (d.getTime() - started) / 3.6e6 }), reduced ? 0 : t)
    }

    // a file dragged over the island: it glows warm from the bottom, ready to catch it (animation #13)
    if (dropping && h > 8) {
      ctx.save()
      islandPath(ctx, box, s.island.style === 'notch')
      ctx.clip()
      const g = ctx.createLinearGradient(0, box.y + h, 0, box.y)
      g.addColorStop(0, 'rgba(255, 209, 102, 0.55)')
      g.addColorStop(1, 'rgba(255, 209, 102, 0)')
      ctx.fillStyle = g
      ctx.fillRect(box.x, box.y, w, h)
      ctx.restore()
    }

    if (splitW.value > 0.5) {
      const sh = Math.min(h, s.island.height)
      drawSplitPill(ctx, { x: box.x - 8 - splitW.value, y: box.y, w: splitW.value, h: sh, r: sh / 2 },
        { fill: tok.background, alpha: 1 - s.island.seeThrough / 100, color: status === 'done' ? tok.done : tok.running, t: t / 1600, done: status === 'done' })
    }

    const mood = forced ?? moodFor({ status, now: Date.now(), pokes, lovedAt, happyAt, worriedAt, sleepy: view!.pip.sleepy, playing: view!.pip.playing, hovering })
    const openness = eyes.value / 100
    if (openness > 0.02 && h > 14 && mode !== 'tucked') {
      const hat = !!outfit && (HATS.has(outfit) || images.has(outfit))
      // a hat needs room in the small island: Pip gets a little smaller and sits a little lower
      const size = Math.min(24, Math.max(10, h * 0.62)) * (hat && h < 44 ? 0.8 : 1)
      const x = W / 2 + eyeDx.value * (w / Math.max(1, rect.target.w))
      const y = box.y + Math.min(eyeY.value, h / 2) + (hat && h < 44 ? size * 0.22 : 0)
      const bt = (t - blinkAt) / 140
      const blink = bt >= 0 && bt < 1 && (mood === 'idle' || mood === 'curious' || mood === 'focused')
      drawPip(ctx, {
        x, y, size, mood, t: t / 1000, squash: k * 1.6,
        color: status === 'ready' ? tok.text : colorOf(status), ...pipColors(s.pip, tok),
        open: openness * (blink && !wink ? Math.abs(1 - 2 * bt) : 1), wink: blink && wink,
        lookX: lookX.value / 100, lookY: lookY.value / 100,
        outfit, outfitImage: outfit ? images.get(outfit) : undefined
      })
      pipAt = { x, y, r: size * 0.75 }
      // a focus timer runs: a ring round Pip that empties as the time passes (animation #18)
      const f = extras?.focus
      if (f && mode !== 'open') {
        const left = focusLeft(f, Date.now()) / f.seconds
        ctx.save()
        ctx.lineWidth = 2.2
        ctx.lineCap = 'round'
        ctx.strokeStyle = 'var(--surface3)'
        ctx.beginPath(); ctx.arc(x, y, size * 0.86, 0, Math.PI * 2); ctx.stroke()
        ctx.strokeStyle = tok.accent
        ctx.beginPath(); ctx.arc(x, y, size * 0.86, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke()
        ctx.restore()
      }
    }
    stepParticles(ctx, dt)

    // the page content rides along inside the island's current outline
    if (clip && content) {
      const r = Math.min(v.r, h / 2)
      clip.style.transform = `translate(${box.x}px, ${box.y}px)`
      clip.style.width = `${w}px`
      clip.style.height = `${h}px`
      clip.style.borderRadius = s.island.style === 'notch' ? `0 0 ${r}px ${r}px` : `${r}px`
      content.style.transform = `translateX(${(w - rect.target.w) / 2}px)`
      content.style.opacity = phase === 'normal' ? String(contentOpacity(rect.progress(), mode === 'open' ? 0.7 : 0.9)) : '0'
    }
    return mood
  }

  // ---------- mouse: only the island catches it; everything else goes to the apps below ----------
  let hovering = false
  let hoverTimer: ReturnType<typeof setTimeout> | undefined
  let leaveTimer: ReturnType<typeof setTimeout> | undefined

  function inside(x: number, y: number): boolean {
    const W = innerWidth, v = rect.value, pad = 6
    if (mode === 'tucked') return Math.abs(x - W / 2) < 90 && y < 12
    const left = W / 2 - v.w / 2
    const inMain = x >= left - pad && x <= left + v.w + pad && y <= top0.value + v.h + pad
    const inSplit = splitW.value > 4 && x >= left - 8 - splitW.value && x < left && y <= top0.value + Math.min(v.h, 40)
    return inMain || inSplit
  }

  // hover intent (NN/g: 0.3–0.5 s): the island opens once the pointer slows down over it, not as it passes on its way
  // to a tab or a title bar at the top edge
  let speed = 0, lastMove = { x: 0, y: 0, t: 0 }
  function openIfResting() {
    if (!hovering) return
    if (speed > 0.6) { hoverTimer = setTimeout(openIfResting, 120); return } // px/ms: still moving fast
    if (mode === 'resting' || mode === 'medium') open = true
  }
  /** tucked, the island lets clicks through to the window below (pointing at it still brings it back) */
  const catching = () => hovering && mode !== 'tucked'

  function setHover(on: boolean) {
    if (on === hovering) return
    hovering = on
    window.pebble.catchMouse(catching())
    clearTimeout(hoverTimer)
    if (on) {
      clearTimeout(leaveTimer)
      if (mode === 'tucked') hoverTimer = setTimeout(() => (tucked = false), 500)
      else if (view?.settings.island.openOn === 'hover' && (mode === 'resting' || mode === 'medium')) hoverTimer = setTimeout(openIfResting, 350)
    } else if (open) {
      leaveTimer = setTimeout(() => { if (!hovering && !shown.some(x => x.ask) && !typing()) open = false }, 700)
    }
  }

  // while you type a reply or an answer, the page stays open even when the mouse wanders off
  const typing = () => document.hasFocus() && /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '')

  // files dragged from Explorer: main lets the window catch the mouse while you drag over the island (drag watch)
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
  addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; if (!dropping) { dropping = true; kick() } })
  addEventListener('dragleave', e => { if (!e.relatedTarget) dropping = false })
  addEventListener('drop', e => {
    e.preventDefault()
    dropping = false
    const paths = window.pebble.pathsOf([...(e.dataTransfer?.files ?? [])])
    if (!paths.length) return
    act({ do: 'shelf.add', paths })
    kick(); say('love')
  })

  addEventListener('mousemove', e => {
    const now = performance.now(), dt = now - lastMove.t
    if (dt > 0) speed = dt > 200 ? 0 : Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / dt
    lastMove = { x: e.clientX, y: e.clientY, t: now }
    setHover(inside(e.clientX, e.clientY))
    const follow = view?.settings.pip.followMouse ?? false
    const lx = follow ? Math.max(-100, Math.min(100, (e.clientX - pipAt.x) / 1.5)) : 0
    const ly = follow ? Math.max(-100, Math.min(100, (e.clientY - pipAt.y) / 0.8)) : 0
    if (Math.abs(lx - lookX.target) > 2 || Math.abs(ly - lookY.target) > 2) { lookX.target = lx; lookY.target = ly; wake() }
  })
  document.addEventListener('mouseleave', () => { setHover(false); lookX.target = lookY.target = 0; wake() })
  // poking Pip (a click right on him) never opens or closes the island
  addEventListener('pointerdown', e => { if (e.button === 0 && pipAt.r && Math.hypot(e.clientX - pipAt.x, e.clientY - pipAt.y) < pipAt.r) poke() }, true)
  setInterval(() => window.pebble.catchMouse(catching()), 1000) // never stuck catching clicks

  function onClick() {
    if (Date.now() - pokedAt < 400) return
    if (mode === 'tucked') tucked = false
    else if (mode === 'resting' || mode === 'medium') open = true
  }
  function onRightClick(e: MouseEvent) {
    e.preventDefault()
    tucked = !tucked
    open = false
  }

  // ---------- tips: each shown once, in the moment it is useful (Settings → General brings them back) ----------
  let tip = $state<'ask' | 'tuck' | 'drop' | null>(null)
  $effect(() => {
    if (!view || scene || tip) return
    const seen = view.settings.general.tipsSeen
    const next = mode === 'ask' && !seen.includes('ask') ? 'ask' : mode === 'open' && page === 'files' && (extras?.shelf.length ?? 0) > 0 && !seen.includes('drop') ? 'drop' : mode === 'open' && !seen.includes('tuck') ? 'tuck' : null
    if (next) { tip = next; window.pebble.act({ do: 'tip.seen', id: next }) }
  })
  // a tip stays until its moment is over
  $effect(() => { if ((tip === 'ask' && mode !== 'ask') || ((tip === 'tuck' || tip === 'drop') && mode !== 'open')) tip = null })

  // the ask card grows under the mouse at the top edge: clicks in its first 0.6 s were aimed at something else
  let askShownAt = 0
  $effect(() => { if (asking?.ask) { void asking.id; askShownAt = performance.now() } })
  const armed = () => performance.now() - askShownAt > 600

  // In test mode the pretend sessions change here; real ones go to the main process.
  const patchScene = (id: string, p: Partial<Session>) => (sceneSessions = sceneSessions.map(x => (x.id === id ? { ...x, ...p } : x)))

  function answer(id: string, a: Answer) {
    if (!(a.kind === 'permission' && a.choice === 'deny')) love()
    if (!scene) { window.pebble.answer(id, a); return }
    const denied = (a.kind === 'permission' && a.choice === 'deny') || (a.kind === 'plan' && !a.approve)
    patchScene(id, { ask: undefined, status: denied ? 'error' : 'running', detail: denied ? 'Denied' : a.kind === 'question' ? `Answered: ${Object.values(a.answers).join(', ')}` : 'Allowed' })
  }
  function reply(id: string, text: string) {
    love()
    if (scene) patchScene(id, { replyable: false, status: 'running', prompt: text, detail: text, message: undefined })
    else window.pebble.reply(id, text)
  }
  function dismiss(id: string) {
    if (scene) sceneSessions = sceneSessions.filter(x => x.id !== id)
    else window.pebble.dismiss(id)
  }
  function seen(ids: string[]) {
    if (scene) for (const id of ids) patchScene(id, { seenAt: Date.now() })
    else window.pebble.seen(ids)
  }
  function jump(id: string) { if (!scene) window.pebble.jump(id) }
  function openOn(id: string) { selected = id; open = true }
</script>

<canvas bind:this={canvas}></canvas>

{#if view}
  <div class="sr-only" role="status">{said}</div>
  <div class="sr-only" role="alert">{alerted}</div>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="clip" class:reduced bind:this={clip} role="region" aria-label={t('i.island.name')} onclick={onClick} oncontextmenu={onRightClick}
    title={mode === 'resting' || mode === 'medium' ? t('i.island.hint') : mode === 'tucked' ? t('i.island.tuckedHint') : undefined}>
    <div class="content mode-{mode}" class:micmuted={!!extras?.mic} bind:this={content} bind:offsetHeight={contentHeight} style:width="{target.w}px">
      {#if (mode === 'resting' || mode === 'medium') && extras?.mic}
        <!-- the microphone is muted for every app: a reminder while it is -->
        <div class="micoff" title={t('i.peek.micOff')} style:height="{mode === 'resting' ? view.settings.island.restingHeight : view.settings.island.height}px"><Icon name="micoff" size={12} /></div>
      {/if}
      {#if mode === 'resting' && chipCount}
        <!-- the resting island's chips, left and right of Pip -->
        <div class="chips" style:height="{view.settings.island.restingHeight}px">
          {#each chips as c, i (i)}
            <span class="chip" class:right={i === 1}>
              {#if c === 'time'}{new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '')}
              {:else if c === 'battery' && battery}<span class:low={battery.level <= 15 && !battery.charging} class:charging={battery.charging}>{battery.level}%</span>
              {:else if c === 'cpu'}{extras?.system.cpu ?? 0}%<small>{t('i.home.cpuChip')}</small>
              {:else if c === 'ram'}{extras?.system.ram ?? 0}%<small>{t('i.home.ramChip')}</small>
              {:else if c.startsWith('widget:')}<span class="wchip">{chipText(c)}</span>{/if}
            </span>
          {/each}
        </div>
      {:else if mode === 'medium' && medium === 'notice' && notice}
        <div class="line" role="status" style:height="{view.settings.island.height}px"><Icon name={notice.icon} size={14} /><span class="title">{notice.text}</span></div>
      {:else if mode === 'medium' && medium === 'drop'}
        <div class="line" style:height="{view.settings.island.height}px"><Icon name="files" size={14} /><span class="title">{t('i.island.dropHere')}</span></div>
      {:else if mode === 'medium' && medium === 'music' && extras?.media}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="line music-line" style:height="{view.settings.island.height}px" onclick={e => { e.stopPropagation(); page = 'music'; lastPage = 'music'; open = true }}>
          {#if extras.art}<img class="mini-cover" src={extras.art} alt="" />{:else}<Icon name="music" size={14} />{/if}
          <span class="title lyric">
            {#key lyric || extras.media.title}
              <span class="roll" in:fly={{ y: reduced ? 0 : 12, duration: reduced ? 0 : 260 }}>{lyric || extras.media.title}</span>
            {/key}
          </span>
          <Wave color={album ? `rgb(${album})` : 'var(--text)'} />
        </div>
      {:else if mode === 'medium' && medium === 'activity' && activity}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="line" style:height="{view.settings.island.height}px" onclick={e => { e.stopPropagation(); if (activity.link) act({ do: 'widget.open', plugin: activity.plugin, id: activity.id }); else { page = 'widgets'; open = true } }}>
          {#if activity.icon && !/^[a-z-]+$/.test(activity.icon)}<span>{activity.icon}</span>{:else}<Icon name={activity.icon ?? 'grid'} size={14} />{/if}
          <span class="title">{activity.title ? `${activity.title} · ` : ''}{activity.text}</span>
          {#if activity.since}<span class="count">{clock(now - activity.since)}</span>{/if}
          {#if activity.progress !== undefined}<span class="act-progress"><i style:width="{activity.progress}%"></i></span>{/if}
        </div>
      {:else if mode === 'medium' && medium === 'focus' && extras?.focus}
        <div class="line" style:height="{view.settings.island.height}px"><Icon name="focus" size={14} /><span class="title">{t('i.island.focus', { time: clock(focusLeft(extras.focus, now) * 1000), state: extras.focus.left !== undefined ? t('i.home.paused') : t('i.home.left') })}</span></div>
      {:else if mode === 'medium' && top}
        <div class="line" style:height="{view.settings.island.height}px">
          <StatusMark status={top.status} />
          <span class="title">{top.project} · {top.detail || top.status}</span>
          {#if shown.length > 1}<span class="count">+{shown.length - 1}</span>{/if}
        </div>
      {:else if mode === 'ask' && asking?.ask}
        {@const s = asking}
        {@const ask = asking.ask}
        {@const waitingCount = shown.filter(x => x.ask).length}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="ask" onclick={e => e.stopPropagation()}>
          {#if tip === 'ask'}<div class="who tipline">{t('i.tip.ask', { keys: view.settings.general.toggleShortcut.replace('Control', 'Ctrl') })}</div>{/if}
          <div class="who">{AGENT_NAMES[s.agent]}{#if waitingCount > 1} · {t('i.ask.queue', { n: 1, total: waitingCount })}{/if}</div>
          {#if ask.kind === 'permission'}
            <div class="ask-text">{t('i.ask.wantsToUse', { project: s.project, tool: ask.tool })}<div class="detail">{ask.summary}</div></div>
            <div class="buttons">
              <button class:likely={!risky(ask.tool)} onclick={() => armed() && answer(s.id, { kind: 'permission', choice: 'allow' })}>{t('i.ask.allow')}</button>
              <button onclick={() => armed() && answer(s.id, { kind: 'permission', choice: 'deny' })}>{t('i.ask.deny')}</button>
            </div>
          {:else if ask.kind === 'question' && quick}
            <div class="ask-text">{t('i.ask.asks', { project: s.project })}<div class="detail strong">{quick.question}</div></div>
            <div class="buttons">
              {#each quick.options as o, i (o.label)}
                <button class:likely={recommended(o.label)} title={o.description} onclick={() => armed() && answer(s.id, { kind: 'question', answers: { [quick.question]: o.label } })}>{o.label}</button>
              {/each}
              <button onclick={() => openOn(s.id)}>{t('i.ask.other')}</button>
            </div>
          {:else}
            <div class="ask-text">{t(ask.kind === 'plan' ? 'i.ask.planFor' : 'i.ask.questionsFor', { project: s.project })}<div class="detail">{s.prompt ?? ''}</div></div>
            <div class="buttons"><button class="likely" onclick={() => openOn(s.id)}>{t(ask.kind === 'plan' ? 'i.ask.reviewPlan' : 'i.ask.answer')}</button></div>
          {/if}
        </div>
      {:else if mode === 'open'}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="pages" onclick={e => e.stopPropagation()}>
          {#key page}
            <div in:fly={{ x: reduced ? 0 : 24 * pageDir, duration: reduced ? 0 : 240, opacity: 0.15 }}>
              {#if page === 'agents'}
                <AgentsPage sessions={shown} usage={view.usage} history={view.history} {now} bind:selected
                  onanswer={answer} onreply={reply} onjump={jump} ondismiss={dismiss} onseen={seen} />
              {:else if page === 'home' && extras}<HomePage sessions={shown} {extras} {widgets} day={view.day} update={view.update} {now} {act} go={p => (page = p)} />
              {:else if page === 'music' && extras}<MusicPage {extras} {now} {act} {reduced} color={album} />
              {:else if page === 'files' && extras}<FilesPage {extras} {now} {act} {reduced} />
              {:else if page === 'clipboard' && extras}<ClipboardPage {extras} {now} {act} enabled={view.settings.clipboard.enabled} />
              {:else if page === 'notes' && extras}<NotesPage notes={extras.notes} {now} {act} />
              {:else if page === 'focus' && extras}<FocusPage focus={extras.focus} done={extras.focusDone} {now} {act} />
              {:else if page === 'chat' && view.chat}<ChatPage chat={view.chat} {act} {listen} name={view.settings.pip.name} />
              {:else if page === 'widgets'}<WidgetsPage {widgets} connectors={view.connectors} {now} {act} />
              {/if}
            </div>
          {/key}
          {#if tip === 'tuck' || tip === 'drop'}<div class="tip" role="note">{t(`i.tip.${tip}`)}<button onclick={() => (tip = null)}>{t('i.tip.ok')}</button></div>{/if}
          {#if undo.text}<div class="undo" role="status">{undo.text}<button onclick={() => undo.take()}>{t('i.common.undo')}</button></div>{/if}
          <PageNav bind:page hidden={view.settings.island.hiddenPages} badges={{ agents: shown.some(x => x.ask || x.status === 'error') }} />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; }
  .clip { position: fixed; left: 0; top: 0; overflow: hidden; cursor: default; will-change: transform; }
  .content { position: absolute; left: 0; top: 0; }
  .reduced .content { transition: opacity 0.15s ease-out; }

  .micoff { position: absolute; inset-inline-start: 12px; top: 0; z-index: 1; display: flex; align-items: center; color: var(--error); }
  .content.micmuted .line { padding-inline-start: 30px; } /* room for the muted mic */
  .who { font-size: 0.78em; color: var(--muted); margin-bottom: 2px; }
  .who.tipline { color: var(--accent-text); }
  .tip { display: flex; align-items: center; gap: 12px; align-self: center; width: fit-content; margin: 0 auto 6px; padding: 5px 6px 5px 14px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent) 22%, transparent); font-size: 0.86em; }
  .tip button { padding: 3px 12px; }
  .undo { display: flex; align-items: center; gap: 12px; align-self: center; width: fit-content; margin: 0 auto 6px; padding: 5px 6px 5px 14px; border-radius: 999px; background: var(--surface2); font-size: 0.88em; }
  .undo button { padding: 3px 12px; }
  .line { display: flex; align-items: center; gap: 10px; padding: 0 56px 0 16px; }
  .title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .count { color: var(--muted); font-size: 0.85em; }


  .ask { padding: 12px 16px 14px; }
  .ask-text { padding-right: 52px; line-height: 1.35; }
  .detail { color: var(--muted); overflow-wrap: anywhere; max-height: 4.1em; overflow: hidden; }
  .detail.strong { color: var(--text); }
  .chips { display: flex; justify-content: space-between; align-items: center; padding: 0 14px; font-size: 0.92em; font-weight: 600; font-variant-numeric: tabular-nums; }
  .chip { min-width: 40px; display: inline-flex; align-items: baseline; gap: 3px; }
  .chip.right { justify-content: flex-end; }
  .chip small { font-size: 0.7em; color: var(--muted); font-weight: 500; }
  .chip .low { color: var(--error); }
  .chip .charging { color: var(--done); }
  .music-line { cursor: pointer; }
  .mini-cover { width: 22px; height: 22px; border-radius: 6px; object-fit: cover; flex: none; }
  .lyric { position: relative; height: 1.4em; overflow: hidden; }
  .wchip { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .act-progress { width: 60px; height: 4px; border-radius: 2px; background: var(--surface3); overflow: hidden; flex: none; }
  .act-progress i { display: block; height: 100%; background: var(--accent); }
  .roll { position: absolute; inset: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .buttons { display: flex; gap: 8px; margin-top: 10px; }
  .buttons button { flex: 1; }
</style>
