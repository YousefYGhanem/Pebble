<script module lang="ts">
  // One pointer and scroll listener for every Pip on the page.
  const pointer = { x: 0, y: 0, seen: false }
  const scroll = { at: 0, dir: 0, y: 0 }
  if (typeof window !== 'undefined') {
    addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true }, { passive: true })
    scroll.y = scrollY
    addEventListener('scroll', () => { scroll.dir = Math.sign(scrollY - scroll.y); scroll.y = scrollY; scroll.at = performance.now() }, { passive: true })
  }

  /** His eyes and gem take the colour of what goes on, like in the app. Cyan when nothing does. */
  const EYES: Record<string, string> = {
    idle: '#53e4ff', curious: '#53e4ff', sleepy: '#53e4ff', dizzy: '#53e4ff', focused: '#3b82f6', alert: '#f59e0b',
    grumpy: '#f59e0b', happy: '#22c55e', love: '#ff5c8a', dancing: '#b9a8ff', sad: '#ef4444'
  }
</script>

<script lang="ts">
  import { drawPip } from '../../../app/renderer/island/pip'
  import { pipColors } from '../../../app/shared/pip'
  import type { PipMood } from '../../content/types'
  import { reducedMotion } from '../lib/motion'

  // The real Pip (app/renderer/island/pip.ts), drawn only while he is on screen and the tab is visible.
  let { mood = 'idle', scale = 0.62, hello = false, colors, eyes }: {
    mood?: PipMood
    /** his body's height as a share of the canvas height */
    scale?: number
    /** open his eyes, wiggle and wink once (the page-load wave) */
    hello?: boolean
    colors?: { body: string; visor: string }
    eyes?: string
  } = $props()

  let canvas: HTMLCanvasElement
  let redraw = () => {}
  const lavender = pipColors({ look: 'lavender', body: '', visor: '' }, {})

  $effect(() => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let w = 0, h = 0, dpr = 1, raf = 0, visible = false
    const start = performance.now()
    let last = start, lx = 0, ly = 0, blinkAt = -1e9, nextBlink = start + 1800 + Math.random() * 3000
    let shownMood = '', moodAt = -1e9

    const draw = (now: number) => {
      if (!w || !h) return
      const still = reducedMotion()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = still ? 0 : (now - start) / 1000
      const since = (now - start) / 1000
      let m: PipMood = mood
      let open = 1, rot = 0, wink = false

      if (hello && !still) {
        if (since < 0.45) open = 0.05
        else if (since < 0.8) open = (since - 0.45) / 0.35
        if (since > 0.75 && since < 1.9) { m = 'happy'; rot = Math.sin((since - 0.75) * 14) * 0.16 * (1.9 - since) }
        wink = since > 1.95 && since < 2.25
      }
      if (m !== shownMood) { shownMood = m; moodAt = now }

      // eyes: toward the pointer, down or up while the page scrolls
      const r = canvas.getBoundingClientRect()
      let tx = pointer.seen ? (pointer.x - r.left - r.width / 2) / 320 : Math.sin(t * 0.6) * 0.35
      let ty = pointer.seen ? (pointer.y - r.top - r.height / 2) / 220 : 0
      if (now - scroll.at < 450) ty = scroll.dir
      tx = Math.max(-1, Math.min(1, tx)); ty = Math.max(-1, Math.min(1, ty))
      const k = still ? 1 : Math.min(1, dt * 9)
      lx += (tx - lx) * k; ly += (ty - ly) * k

      if (!still && now > nextBlink) { blinkAt = now; nextBlink = now + 2400 + Math.random() * 4200 }
      const b = (now - blinkAt) / 170
      if (b >= 0 && b <= 1) open = Math.min(open, 1 - Math.sin(Math.PI * b))

      const j = (now - moodAt) / 1000
      const squash = still ? 0 : 0.12 * Math.exp(-j * 7) * Math.cos(j * 24)
      const size = Math.min(h * scale, (w * 0.9) / 1.3)
      const bob = still || m === 'dancing' ? 0 : Math.sin(t * 2.2) * size * 0.025

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.translate(w / 2, h * 0.56 + bob)
      ctx.rotate(rot)
      const c = colors ?? lavender
      drawPip(ctx, { x: 0, y: 0, size, mood: m, color: eyes ?? EYES[m] ?? '#53e4ff', body: c.body, visor: c.visor, open, wink, lookX: lx, lookY: ly, t, squash })
    }

    const frame = (now: number) => { raf = requestAnimationFrame(frame); draw(now) }
    const sync = () => {
      // reduced motion: no loop at all, one drawing per change (the effect below)
      const run = visible && !document.hidden && !reducedMotion()
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame) }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0 }
    }
    const ro = new ResizeObserver(() => {
      dpr = Math.min(2, devicePixelRatio || 1)
      w = canvas.clientWidth; h = canvas.clientHeight
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      draw(performance.now())
    })
    const io = new IntersectionObserver(([e]) => { visible = e!.isIntersecting; sync() })
    redraw = () => draw(performance.now())
    ro.observe(canvas)
    io.observe(canvas)
    document.addEventListener('visibilitychange', sync)
    return () => { redraw = () => {}; ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', sync); cancelAnimationFrame(raf) }
  })
  $effect(() => { void mood; void colors; void eyes; redraw() })
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas { display: block; inline-size: 100%; block-size: 100%; }
</style>
