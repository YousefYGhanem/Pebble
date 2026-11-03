// The island's motion: one spring per dimension (width, height, radius), Apple-style. A new target steers the
// running spring and never restarts it, so opening while it closes carries on smoothly instead of jumping.
// Growing: response 0.42 s, damping 0.86 (a hint of overshoot). Shrinking: 0.34 s, damping 1 (settles without wobble).

export interface Rect { w: number; h: number; r: number }

export class Spring {
  velocity = 0
  constructor(public value: number, public target = value) {}

  /** Semi-implicit Euler in 240 Hz substeps (stable at any frame rate). */
  step(dt: number, response: number, damping: number) {
    const stiffness = (2 * Math.PI / response) ** 2
    const friction = 4 * Math.PI * damping / response
    const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps
    for (let i = 0; i < steps; i++) {
      this.velocity += (-stiffness * (this.value - this.target) - friction * this.velocity) * h
      this.value += this.velocity * h
    }
    if (this.settled) { this.value = this.target; this.velocity = 0 }
  }

  get settled() { return Math.abs(this.value - this.target) < 0.25 && Math.abs(this.velocity) < 0.5 }
}

export class RectSpring {
  readonly w: Spring
  readonly h: Spring
  readonly r: Spring
  /** where the current move started (for content fading, see progress()) */
  from: Rect

  constructor(start: Rect) {
    this.w = new Spring(start.w); this.h = new Spring(start.h); this.r = new Spring(start.r)
    this.from = { ...start }
  }

  get value(): Rect { return { w: this.w.value, h: this.h.value, r: this.r.value } }
  get target(): Rect { return { w: this.w.target, h: this.h.target, r: this.r.target } }
  get settled() { return this.w.settled && this.h.settled && this.r.settled }

  setTarget(t: Rect) {
    const cur = this.target
    if (cur.w === t.w && cur.h === t.h && cur.r === t.r) return
    this.from = this.value
    this.w.target = t.w; this.h.target = t.h; this.r.target = t.r
  }

  /** Jump without animation (reduced motion, first frame). */
  snap(t: Rect) {
    for (const [s, v] of [[this.w, t.w], [this.h, t.h], [this.r, t.r]] as const) { s.value = s.target = v; s.velocity = 0 }
    this.from = { ...t }
  }

  /** speed > 1 is faster (Settings → animation speed). */
  step(dt: number, speed = 1) {
    const growing = this.h.target > this.h.value || this.w.target > this.w.value
    const response = (growing ? 0.42 : 0.34) / speed, damping = growing ? 0.86 : 1
    this.w.step(dt, response, damping); this.h.step(dt, response, damping); this.r.step(dt, response, 1)
  }

  /** 0 at the start of the current move, 1 at its target (by the slower of width and height). */
  progress(): number {
    const p = (cur: number, from: number, to: number) => (Math.abs(to - from) < 0.5 ? 1 : 1 - Math.abs(to - cur) / Math.abs(to - from))
    return Math.max(0, Math.min(p(this.w.value, this.from.w, this.w.target), p(this.h.value, this.from.h, this.h.target)))
  }
}

/** Jelly: a kick adds a fading wobble on top of the spring. Returns the squash amount for time t (s) after the kick. */
export function jelly(t: number, amp = 0.06): number {
  if (t < 0 || t > 1.2) return 0
  return amp * Math.exp(-t / 0.22) * Math.sin(2 * Math.PI * 3.2 * t)
}

/** Content fades in late in a move: small content in the last 10 %, a page after 70 %. */
export function contentOpacity(progress: number, threshold: number): number {
  return Math.max(0, Math.min(1, (progress - threshold) / (1 - threshold)))
}
