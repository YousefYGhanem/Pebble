// Canvas drawing for the island: its outline and the split pill. Pip is drawn in pip.ts.

export interface Box { x: number; y: number; w: number; h: number; r: number }

/**
 * Notch: flows out of the top edge with two small inward curves ("ears"), round only at the bottom (like a MacBook
 * notch). Floating: a pill of its own, round all round (like the iPhone's Dynamic Island).
 */
export function islandPath(ctx: CanvasRenderingContext2D, b: Box, notch: boolean) {
  const r = Math.max(0, Math.min(b.r, b.h, b.w / 2))
  ctx.beginPath()
  if (!notch) { ctx.roundRect(b.x, b.y, b.w, b.h, Math.min(r, b.h / 2)); return }
  const ear = Math.max(0, Math.min(10, b.h / 3, b.w / 8))
  const { x, y, w, h } = b
  ctx.moveTo(x - ear, y)
  ctx.quadraticCurveTo(x, y, x, y + ear)
  ctx.lineTo(x, y + h - r)
  ctx.arcTo(x, y + h, x + r, y + h, r)
  ctx.lineTo(x + w - r, y + h)
  ctx.arcTo(x + w, y + h, x + w, y + h - r, r)
  ctx.lineTo(x + w, y + ear)
  ctx.quadraticCurveTo(x + w, y, x + w + ear, y)
  ctx.closePath()
}

export function drawIsland(ctx: CanvasRenderingContext2D, b: Box, o: { notch: boolean; fill: string; alpha: number; shadow: boolean }) {
  if (b.w < 1 || b.h < 0.5) return
  ctx.save()
  islandPath(ctx, b, o.notch)
  if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4 }
  ctx.globalAlpha = o.alpha
  ctx.fillStyle = o.fill
  ctx.fill()
  ctx.restore()
}

/**
 * The split pill: a second small island left of the main one, for a second activity (an agent while music plays).
 * While working a line runs round the inside (a dash as long as the whole way round, so it loops without a jump);
 * done: the line closes all the way round and a tick shows.
 */
export function drawSplitPill(ctx: CanvasRenderingContext2D, b: Box, o: { fill: string; alpha: number; color: string; t: number; done: boolean }) {
  if (b.w < 2) return
  ctx.save()
  ctx.globalAlpha = o.alpha
  ctx.fillStyle = o.fill
  ctx.beginPath()
  ctx.roundRect(b.x, b.y, b.w, b.h, b.h / 2)
  ctx.fill()
  ctx.globalAlpha = Math.min(1, b.w / 30)
  const inset = 5
  if (b.h - inset * 2 < 4 || b.w - inset * 2 < 4) { ctx.restore(); return } // too small for the ring (it is tucking away)
  ctx.beginPath()
  ctx.roundRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2, (b.h - inset * 2) / 2)
  ctx.strokeStyle = o.color
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  if (!o.done) {
    const length = 2 * (b.w - b.h) + Math.PI * (b.h - inset * 2) // about the way round
    ctx.setLineDash([length * 0.3, length * 0.7])
    ctx.lineDashOffset = -o.t * length * 0.9
  }
  ctx.stroke()
  if (o.done) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(cx - 5, cy)
    ctx.lineTo(cx - 1.5, cy + 3.5)
    ctx.lineTo(cx + 5, cy - 4)
    ctx.stroke()
  }
  ctx.restore()
}
