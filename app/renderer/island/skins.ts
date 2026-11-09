// Living skins: the island's surface follows your day. A warm glow (with embers) while the processor works hard, frost
// when the PC idles, a spider web in a corner at night, and vines that grow along the bottom after a long day.
// Drawn inside the island's outline, after its fill; at rest the island draws no frames, so a skin holds still then.
import { islandPath, type Box } from './draw'

export interface Skin { fire: number; frost: number; web: boolean; vines: number }

/** 0–1 amounts from the processor load (%), the hour (0–23) and how long the day has been (hours since the first start today). */
export function skinFor(o: { cpu: number; hour: number; dayHours: number }): Skin {
  const clamp = (x: number) => Math.max(0, Math.min(1, x))
  return {
    fire: clamp((o.cpu - 70) / 25),
    frost: o.cpu <= 3 ? 0.6 : 0,
    web: o.hour >= 23 || o.hour < 5,
    vines: clamp((o.dayHours - 8) / 4)
  }
}

/** When "today" started for the island (its first start today), kept per viewer in localStorage. */
export function dayStart(now = new Date()): number {
  const today = now.toDateString()
  try {
    const saved = JSON.parse(localStorage.getItem('pebble.day') ?? 'null') as { day: string; at: number } | null
    if (saved?.day === today) return saved.at
    localStorage.setItem('pebble.day', JSON.stringify({ day: today, at: now.getTime() }))
  } catch {}
  return now.getTime()
}

/** a steady pseudo-random 0–1 per index (the same embers and sparkles every frame) */
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

export function drawSkin(ctx: CanvasRenderingContext2D, b: Box, notch: boolean, k: Skin, t: number) {
  if (b.w < 20 || b.h < 10 || (!k.fire && !k.frost && !k.web && !k.vines)) return
  ctx.save()
  islandPath(ctx, b, notch)
  ctx.clip()
  const s = t / 1000

  if (k.fire) {
    const flicker = 0.85 + 0.15 * Math.sin(s * 9) * Math.sin(s * 5.3)
    const g = ctx.createLinearGradient(0, b.y + b.h, 0, b.y + b.h * 0.2)
    g.addColorStop(0, `rgba(255, 90, 30, ${0.55 * k.fire * flicker})`)
    g.addColorStop(0.5, `rgba(255, 170, 40, ${0.22 * k.fire * flicker})`)
    g.addColorStop(1, 'rgba(255, 200, 80, 0)')
    ctx.fillStyle = g
    ctx.fillRect(b.x, b.y, b.w, b.h)
    for (let i = 0; i < Math.round(10 * k.fire); i++) { // embers rising and fading
      const life = (s * (0.4 + rnd(i) * 0.4) + rnd(i + 50)) % 1
      ctx.fillStyle = `rgba(255, ${150 + rnd(i + 9) * 80}, 60, ${(1 - life) * 0.9})`
      ctx.beginPath()
      ctx.arc(b.x + rnd(i + 3) * b.w + Math.sin(s * 3 + i) * 3, b.y + b.h - life * b.h * 0.9, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (k.frost) {
    for (const [x, dir] of [[b.x, 1], [b.x + b.w, -1]] as const) {
      const g = ctx.createRadialGradient(x, b.y + b.h, 0, x, b.y + b.h, Math.min(b.w * 0.4, 120))
      g.addColorStop(0, `rgba(190, 230, 255, ${0.3 * k.frost})`)
      g.addColorStop(1, 'rgba(190, 230, 255, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x - (dir > 0 ? 0 : b.w), b.y, b.w, b.h)
    }
    ctx.fillStyle = `rgba(230, 245, 255, ${0.7 * k.frost})`
    for (let i = 0; i < 14; i++) {
      const edge = rnd(i) < 0.5 ? b.x + rnd(i + 1) * 40 : b.x + b.w - rnd(i + 1) * 40
      ctx.fillRect(edge, b.y + b.h - rnd(i + 2) * b.h * 0.7, 1, 1)
    }
  }

  if (k.web) {
    // a small web hanging in the top-right corner
    const cx = b.x + b.w - 4, cy = b.y + (notch ? 2 : 4), r = Math.min(26, b.h * 0.8)
    ctx.strokeStyle = 'rgba(220, 220, 235, 0.28)'
    ctx.lineWidth = 0.6
    const spokes = 5
    ctx.beginPath()
    for (let i = 0; i <= spokes; i++) {
      const a = Math.PI / 2 + (i / spokes) * (Math.PI / 2)
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    for (let ring = 1; ring <= 3; ring++) {
      const rr = (r * ring) / 3.4
      for (let i = 0; i <= spokes; i++) {
        const a = Math.PI / 2 + (i / spokes) * (Math.PI / 2), p = { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr }
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.quadraticCurveTo(cx + Math.cos(a - 0.15) * rr * 0.85, cy + Math.sin(a - 0.15) * rr * 0.85, p.x, p.y)
      }
    }
    ctx.stroke()
  }

  if (k.vines) {
    // a vine creeping in from both lower corners, with leaves
    const reach = b.w * 0.45 * k.vines, base = b.y + b.h - 3
    ctx.strokeStyle = 'rgba(140, 160, 130, 0.6)' // a muted sage: green means done
    ctx.lineWidth = 1.4
    for (const dir of [1, -1]) {
      const x0 = dir > 0 ? b.x + 2 : b.x + b.w - 2
      ctx.beginPath()
      for (let d = 0; d <= reach; d += 2) ctx.lineTo(x0 + dir * d, base - Math.abs(Math.sin(d / 9)) * 4)
      ctx.stroke()
      ctx.fillStyle = 'rgba(150, 172, 138, 0.7)'
      for (let d = 10; d < reach; d += 14) {
        const x = x0 + dir * d, y = base - Math.abs(Math.sin(d / 9)) * 4
        ctx.beginPath()
        ctx.ellipse(x, y - 3, 1.8, 3.4, dir * 0.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.restore()
}
