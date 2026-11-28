import { useLayoutEffect, useRef } from 'react'
import { drawPip } from '../../../app/renderer/island/pip'
import type { Mood } from '../../../app/shared/pip'
import { clamp01 } from '../kit/time'
import { step } from '../kit/spring'
import { EYES, T } from './tokens'

// The real Pip (app/renderer/island/pip.ts: drawPip is a pure painter), driven by t only: his mood and eye colour at
// that moment, eyes opening (he wakes), blinks, a look, and a small jelly hop after each event. Painted at 2x.

export type PipScript = {
  moods: readonly (readonly [number, Mood])[]
  wake?: number
  blinks?: readonly number[]
  jelly?: readonly number[]
  /** where he looks, -1 … 1 */
  look?: (t: number) => { x: number; y: number }
  /** a wink at this time */
  wink?: number
}

export function moodAt(t: number, moods: PipScript['moods']): Mood {
  let mood = moods[0][1]
  for (const [at, m] of moods) if (t >= at) mood = m
  return mood
}

/** A short squash after each event: a damped wobble (0 at rest). */
function jellyAt(t: number, hops: readonly number[]) {
  let k = 0
  for (const at of hops) {
    const d = t - at
    if (d >= 0 && d < 0.9) k += 0.11 * Math.exp(-d * 6) * Math.cos(d * 22)
  }
  return k
}

function openAt(t: number, s: PipScript) {
  let open = s.wake === undefined ? 1 : step(t - s.wake, { stiffness: 260, damping: 20 })
  for (const at of s.blinks ?? []) { const d = Math.abs(t - at - 0.06); if (d < 0.09) open = Math.min(open, d / 0.09) }
  return clamp01(open)
}

export function Pip({ t, script, size, x, y, canvas = 420 }: { t: number; script: PipScript; size: number; x: number; y: number; canvas?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const mood = moodAt(t, script.moods)
  useLayoutEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    ctx.clearRect(0, 0, canvas, canvas)
    const look = script.look?.(t) ?? { x: 0, y: 0 }
    drawPip(ctx, {
      x: canvas / 2, y: canvas / 2, size, mood, color: EYES[mood], body: T.pipBody, visor: T.pipVisor,
      open: openAt(t, script), lookX: look.x, lookY: look.y, t, squash: jellyAt(t, script.jelly ?? []),
      wink: script.wink !== undefined && t > script.wink && t < script.wink + 0.45, outfit: null,
    })
  }, [t, mood, size, canvas, script])
  return <canvas ref={ref} width={canvas * 2} height={canvas * 2} style={{ position: 'absolute', left: x - canvas / 2, top: y - canvas / 2, width: canvas, height: canvas }} />
}
