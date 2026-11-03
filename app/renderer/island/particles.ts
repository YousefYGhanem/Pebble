import { heart } from './pip'

// Confetti (a long task finished, an achievement) and hearts (you answered from the island), drawn on the island's
// canvas. They fall out of the island into the see-through part of the window; clicks still go through there.

interface Particle { x: number; y: number; vx: number; vy: number; rot: number; vr: number; color: string; life: number; kind: 'confetti' | 'heart' }

const COLORS = ['#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#7c5cff', '#ffffff']
const parts: Particle[] = []

export function confetti(x: number, y: number, count = 70) {
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (0.15 + Math.random() * 0.7) // a fan pointing down
    const v = 140 + Math.random() * 260
    parts.push({ x, y, vx: Math.cos(a) * v * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(a) * v * 0.6 - 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, color: COLORS[i % COLORS.length]!, life: 1.6 + Math.random() * 0.6, kind: 'confetti' })
  }
}

export function hearts(x: number, y: number, count = 3) {
  for (let i = 0; i < count; i++) parts.push({ x: x + (i - 1) * 8, y, vx: (Math.random() - 0.5) * 20, vy: 35 + i * 12, rot: 0, vr: 0, color: '#ff5c8a', life: 1.3, kind: 'heart' })
}

export const particlesAlive = () => parts.length > 0

export function stepParticles(ctx: CanvasRenderingContext2D, dt: number) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]!
    p.life -= dt
    if (p.life <= 0) { parts.splice(i, 1); continue }
    if (p.kind === 'confetti') { p.vy += 520 * dt; p.vx *= 1 - 1.2 * dt }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.vr * dt
    ctx.save()
    ctx.globalAlpha = Math.min(1, p.life * 2)
    if (p.kind === 'heart') heart(ctx, p.x, p.y, 9, p.color)
    else {
      ctx.translate(p.x, p.y); ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-3, -1.5, 6, 3)
    }
    ctx.restore()
  }
}
