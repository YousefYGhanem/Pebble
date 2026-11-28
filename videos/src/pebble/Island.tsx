import type { ReactNode } from 'react'
import { Img, staticFile } from 'remotion'
import { clamp01, progress } from '../kit/time'
import { step } from '../kit/spring'
import { GROW, SHRINK, T } from './tokens'
import boxes from './ui-boxes.json'

// The island as it moves in the app: one shape whose width, height and radius follow the island's own springs
// (growing 0.42 s / 0.86, shrinking 0.34 s / 1), with each state's real capture (public/ui, 3x) fading in once the
// shape has moved, as the app fades its content. Each state also has a zoom (film px per app px), on the same spring,
// so a small pill reads big and a full page fits the frame. A pure function of t: the springs are summed in closed form.

/** Captures are 3x (--capture-scale=3): app px = capture px / CAP. */
export const CAP = 3
/** The notch's "ears" where it meets the top of the screen, in app px (measured: 8). */
const EAR = 8
/** The capture's width and centre, in app px. */
const CAPTURE = { w: 824, center: 412 }
type Box = { w: number; h: number }
export type Key = readonly [time: number, state: string]

/** The island's body size for a state, in app px. */
export function bodyOf(state: string, custom: Record<string, Box> = {}): Box {
  if (custom[state]) return custom[state]
  const box = (boxes as Record<string, { w: number; h: number }>)[state]
  if (!box) throw new Error(`no capture box for ${state}`)
  return { w: box.w / CAP - 2 * EAR, h: box.h / CAP }
}

/** A value that springs to each key's target, with the grow or shrink spring by direction (closed form). */
export function springTo(t: number, keys: readonly (readonly [number, number])[]) {
  let value = keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const delta = keys[i][1] - keys[i - 1][1]
    value += delta * step(t - keys[i][0], delta >= 0 ? GROW : SHRINK)
  }
  return value
}

/** The island's size on screen now, and its zoom: { w, h } in film px, z in film px per app px. */
export function islandAt(t: number, keys: readonly Key[], zoom: Record<string, number>, custom: Record<string, Box> = {}) {
  const z = springTo(t, keys.map(([at, s]) => [at, zoom[s] ?? 1.5] as const))
  const w = springTo(t, keys.map(([at, s]) => [at, bodyOf(s, custom).w * (zoom[s] ?? 1.5)] as const))
  const h = springTo(t, keys.map(([at, s]) => [at, bodyOf(s, custom).h * (zoom[s] ?? 1.5)] as const))
  return { w, h, z }
}

const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)

export function Island({ t, keys, zoom, folder = 'ui', top = 0, custom = {}, overlay = {} }: {
  t: number
  /** the captures' folder in public: 'ui', or 'ui-ar' (the island in Arabic; measured the same boxes) */
  folder?: string
  keys: readonly Key[]
  /** film px per app px, by state */
  zoom: Record<string, number>
  /** px above the frame's top edge (the island rises away at the end) */
  top?: number
  /** states drawn in code instead of a capture: their body size (app px), and what to draw at a zoom */
  custom?: Record<string, Box & { render: (z: number) => ReactNode }>
  /** drawn over a capture, in app px times z (a pressed button) */
  overlay?: Record<string, (z: number) => ReactNode>
}) {
  const { w, h, z } = islandAt(t, keys, zoom, custom)
  const r = Math.min(h / 2, 20 * z) // the theme's radius (20 px) at the bottom corners; a pill when it is short
  const ear = EAR * z

  return (
    <div style={{ position: 'absolute', left: 540 - w / 2, top: -top, width: w, height: h }}>
      {/* the ears: the notch flows into the top of the screen */}
      {[-1, 1].map(side => (
        <svg key={side} width={ear} height={ear} viewBox="0 0 16 16"
          style={{ position: 'absolute', top: 0, [side < 0 ? 'right' : 'left']: '100%', transform: side < 0 ? undefined : 'scaleX(-1)' }}>
          <path d="M0 0H16V16C16 7 9 0 0 0Z" fill={T.islandTop} />
        </svg>
      ))}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        borderRadius: `0 0 ${r}px ${r}px`,
        background: `linear-gradient(${T.islandTop}, ${T.island} ${17 * z}px)`,
        boxShadow: `0 ${16 * z}px ${44 * z}px rgba(0, 0, 0, 0.55), inset 0 0 0 1px ${T.rim}`,
      }}>
        {keys.map(([at, state], i) => {
          const next = keys[i + 1]?.[0] ?? Infinity
          // in after the shape has started moving; out quickly when the next state begins
          const shown = ease(progress(t, at + (i === 0 ? -1 : 0.08), 0.24)) * (1 - progress(t, next, 0.1))
          if (shown <= 0.001) return null
          const c = custom[state]
          return (
            <div key={i} style={{
              position: 'absolute', top: 0, left: w / 2 - CAPTURE.center * z, width: CAPTURE.w * z,
              opacity: shown, translate: `0 ${(1 - shown) * 10}px`, filter: shown < 1 ? `blur(${(1 - shown) * 6}px)` : undefined,
            }}>
              {c
                ? <div style={{ position: 'absolute', left: CAPTURE.center * z - (c.w * z) / 2, top: 0, width: c.w * z, height: c.h * z }}>{c.render(z)}</div>
                : <Img src={staticFile(`${folder}/${state}.png`)} style={{ display: 'block', width: '100%' }} />}
              {overlay[state]?.(z)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
