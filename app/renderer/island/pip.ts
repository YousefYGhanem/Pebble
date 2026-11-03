import type { Mood } from '../../shared/pip'

// Pip, drawn in code: a soft pebble with a dark visor, two eyes that show the agent's colour, and a small gem on top.
// Every colour comes from the theme (pipBody, pipVisor, and the status colours), so a theme restyles him completely.
// size = the body's height in px; everything else scales from it.

export interface PipLook {
  x: number
  y: number
  size: number
  mood: Mood
  /** eyes and gem: the colour of what the agent does */
  color: string
  body: string
  visor: string
  /** 0 = eyes closed … 1 = open (hello, goodbye, blinking) */
  open: number
  /** one eye closed (a wink) */
  wink?: boolean
  /** where the eyes look, -1 … 1 */
  lookX?: number
  lookY?: number
  /** seconds, for moods that move (dizzy, dancing) */
  t: number
  /** jelly squash: >0 wider and lower */
  squash?: number
  outfit?: string | null
  /** your own outfit (an SVG from the outfits folder) */
  outfitImage?: HTMLImageElement
}

const HEART = '#ff5c8a'

export function drawPip(ctx: CanvasRenderingContext2D, p: PipLook) {
  const s = p.size, w = s * 1.3, h = s
  ctx.save()
  ctx.translate(p.x, p.y)
  if (p.mood === 'dancing') { ctx.translate(0, Math.sin(p.t * Math.PI * 4) * s * 0.06); ctx.rotate(Math.sin(p.t * Math.PI * 2) * 0.08) }
  const k = p.squash ?? 0
  ctx.scale(1 + k, 1 - k)

  // body: a pebble, rounder on top than at the bottom
  ctx.fillStyle = p.body
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, [h * 0.56, h * 0.56, h * 0.42, h * 0.42])
  ctx.fill()

  // visor
  const vw = w * 0.78, vh = h * 0.46, vy = -h * 0.06
  ctx.fillStyle = p.visor
  ctx.beginPath()
  ctx.roundRect(-vw / 2, vy - vh / 2, vw, vh, vh * 0.45)
  ctx.fill()

  eyes(ctx, p, w, vy, vh)
  brows(ctx, p, w, vy, vh)
  if (p.mood === 'sleepy') zzz(ctx, s, w, h)

  if (p.outfitImage) drawImageOutfit(ctx, p.outfitImage, w, h)
  else if (p.outfit) OUTFIT_DRAW[p.outfit]?.(ctx, s, w, h)
  else gem(ctx, p.color, s, h)
  ctx.restore()
}

function eyes(ctx: CanvasRenderingContext2D, p: PipLook, w: number, vy: number, vh: number) {
  const s = p.size, ew = s * 0.13
  const lx = (p.lookX ?? 0) * s * 0.05, ly = (p.lookY ?? 0) * s * 0.04
  ctx.fillStyle = ctx.strokeStyle = p.color
  ctx.lineWidth = Math.max(1.2, s * 0.07)
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    const cx = side * w * 0.17 + lx, cy = vy + ly
    switch (p.mood) {
      case 'happy':
      case 'dancing': // ^ ^
        ctx.beginPath(); ctx.moveTo(cx - ew * 0.8, cy + vh * 0.12); ctx.quadraticCurveTo(cx, cy - vh * 0.42, cx + ew * 0.8, cy + vh * 0.12); ctx.stroke()
        break
      case 'love':
        heart(ctx, cx, cy, s * 0.17, HEART)
        break
      case 'sleepy': // closed
        ctx.beginPath(); ctx.moveTo(cx - ew * 0.7, cy + vh * 0.05); ctx.lineTo(cx + ew * 0.7, cy + vh * 0.05); ctx.stroke()
        break
      case 'sad': // x x
        ctx.beginPath()
        ctx.moveTo(cx - ew * 0.6, cy - ew * 0.6); ctx.lineTo(cx + ew * 0.6, cy + ew * 0.6)
        ctx.moveTo(cx + ew * 0.6, cy - ew * 0.6); ctx.lineTo(cx - ew * 0.6, cy + ew * 0.6)
        ctx.stroke()
        break
      case 'dizzy': spiral(ctx, cx, cy, ew * 0.95, p.t * 6 * side); break
      default: {
        const tall = { focused: 0.62, grumpy: 0.7, alert: 1.15, curious: 1.1 }[p.mood as string] ?? 1
        const closed = p.wink && side === 1 ? 0 : 1
        const eh = Math.max(ctx.lineWidth * 0.8, s * 0.26 * tall * p.open * closed)
        const down = p.mood === 'focused' ? vh * 0.08 : 0
        ctx.beginPath(); ctx.roundRect(cx - ew / 2, cy - eh / 2 + down, ew, eh, ew / 2); ctx.fill()
      }
    }
  }
}

/** Raised brows when asking; slanted inward when grumpy. Drawn on the body, above the visor. */
function brows(ctx: CanvasRenderingContext2D, p: PipLook, w: number, vy: number, vh: number) {
  if (p.mood !== 'alert' && p.mood !== 'grumpy') return
  const s = p.size, y = vy - vh / 2 - s * 0.08
  ctx.strokeStyle = p.visor
  ctx.lineWidth = Math.max(1.2, s * 0.06)
  for (const side of [-1, 1]) {
    const cx = side * w * 0.17
    ctx.beginPath()
    if (p.mood === 'alert') { ctx.moveTo(cx - s * 0.08, y + s * 0.01); ctx.quadraticCurveTo(cx, y - s * 0.06, cx + s * 0.08, y + s * 0.01) }
    else { ctx.moveTo(cx - side * s * 0.1, y - s * 0.04); ctx.lineTo(cx + side * s * 0.06, y + s * 0.03) } // inner end lower
    ctx.stroke()
  }
}

function gem(ctx: CanvasRenderingContext2D, color: string, s: number, h: number) {
  const g = s * 0.11, y = -h / 2 - g * 0.55
  ctx.fillStyle = color
  ctx.beginPath(); ctx.moveTo(0, y - g); ctx.lineTo(g * 0.8, y); ctx.lineTo(0, y + g); ctx.lineTo(-g * 0.8, y); ctx.closePath(); ctx.fill()
}

export function heart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const r = size / 2
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.9)
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.45)
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9)
  ctx.fill()
  ctx.restore()
}

function spiral(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, turn: number) {
  ctx.beginPath()
  for (let i = 0; i <= 40; i++) {
    const a = turn + (i / 40) * Math.PI * 4, rr = (i / 40) * r
    i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx, cy)
  }
  ctx.lineWidth = Math.max(1, r * 0.28)
  ctx.stroke()
}

function zzz(ctx: CanvasRenderingContext2D, s: number, w: number, h: number) {
  ctx.fillStyle = ctx.strokeStyle
  ctx.font = `700 ${Math.round(s * 0.34)}px ${getComputedStyle(document.body).fontFamily || 'sans-serif'}`
  ctx.fillText('z', w * 0.42, -h * 0.42)
  ctx.font = `700 ${Math.round(s * 0.24)}px sans-serif`
  ctx.fillText('z', w * 0.62, -h * 0.68)
}

// ---------- outfits: drawn from the top of the head (y = -h/2) ----------

function cone(ctx: CanvasRenderingContext2D, h: number, base: number, tall: number, tilt: number, fill: string) {
  const top = -h / 2
  ctx.fillStyle = fill
  ctx.beginPath(); ctx.moveTo(-base / 2, top + h * 0.06); ctx.lineTo(tilt, top - tall); ctx.lineTo(base / 2, top + h * 0.06); ctx.closePath(); ctx.fill()
}

const OUTFIT_DRAW: Record<string, (ctx: CanvasRenderingContext2D, s: number, w: number, h: number) => void> = {
  glasses(ctx, s, w) {
    ctx.strokeStyle = '#d9b65d'; ctx.lineWidth = Math.max(1, s * 0.045)
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * w * 0.17, -s * 0.06, s * 0.17, 0, Math.PI * 2); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(-w * 0.17 + s * 0.17, -s * 0.08); ctx.lineTo(w * 0.17 - s * 0.17, -s * 0.08); ctx.stroke()
  },
  cap(ctx, s, w, h) {
    const top = -h / 2 + s * 0.05
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath(); ctx.ellipse(0, top, w * 0.38, s * 0.26, 0, Math.PI, 0); ctx.fill()
    ctx.beginPath(); ctx.roundRect(w * 0.05, top - s * 0.04, w * 0.5, s * 0.09, s * 0.04); ctx.fill() // brim
  },
  headphones(ctx, s, w) {
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = Math.max(1.5, s * 0.08)
    ctx.beginPath(); ctx.arc(0, -s * 0.05, w * 0.52, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke()
    ctx.fillStyle = '#2b2b33'
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.roundRect(side * w * 0.5 - s * 0.09, -s * 0.2, s * 0.18, s * 0.34, s * 0.07); ctx.fill() }
  },
  crown(ctx, s, w, h) {
    const top = -h / 2 + s * 0.04, cw = w * 0.5, ch = s * 0.3
    ctx.fillStyle = '#f2c94c'
    ctx.beginPath()
    ctx.moveTo(-cw / 2, top); ctx.lineTo(-cw / 2, top - ch); ctx.lineTo(-cw / 4, top - ch * 0.45); ctx.lineTo(0, top - ch)
    ctx.lineTo(cw / 4, top - ch * 0.45); ctx.lineTo(cw / 2, top - ch); ctx.lineTo(cw / 2, top); ctx.closePath(); ctx.fill()
  },
  santa(ctx, s, w, h) {
    cone(ctx, h, w * 0.66, s * 0.62, w * 0.28, '#d93a3a')
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.roundRect(-w * 0.36, -h / 2 - s * 0.02, w * 0.72, s * 0.13, s * 0.06); ctx.fill()
    ctx.beginPath(); ctx.arc(w * 0.28, -h / 2 - s * 0.62, s * 0.08, 0, Math.PI * 2); ctx.fill()
  },
  witch(ctx, s, w, h) {
    ctx.fillStyle = '#5b3a8c'
    ctx.beginPath(); ctx.ellipse(0, -h / 2 + s * 0.04, w * 0.52, s * 0.07, 0, 0, Math.PI * 2); ctx.fill()
    cone(ctx, h, w * 0.5, s * 0.66, -w * 0.12, '#5b3a8c')
  },
  party(ctx, s, w, h) {
    cone(ctx, h, w * 0.44, s * 0.6, 0, '#7c5cff')
    ctx.fillStyle = '#f2c94c'
    ctx.beginPath(); ctx.arc(0, -h / 2 - s * 0.6, s * 0.08, 0, Math.PI * 2); ctx.fill()
  }
}

function drawImageOutfit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  if (!img.complete || !img.naturalWidth) return
  const ow = w * 1.05, oh = ow * (img.naturalHeight / img.naturalWidth)
  ctx.drawImage(img, -ow / 2, -h / 2 - oh * 0.75, ow, oh) // sits on the head, a little over the top
}

/** Outfits that sit on top of the head (they need room above Pip). Your own SVG outfits count as hats too. */
export const HATS = new Set(['cap', 'crown', 'santa', 'witch', 'party'])
