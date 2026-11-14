// Small Svelte actions for the page's motion. All of them do nothing extra under prefers-reduced-motion
// or on touch screens; the one that measures on scroll (glow) does it once per frame, for elements on screen only.

const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
export const reducedMotion = () => query?.matches ?? false
const finePointer = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches

/** Calls back whenever the element enters or leaves the viewport (margin grows the box). */
export function inView(node: Element, opts: { onchange: (visible: boolean) => void; margin?: string; threshold?: number }) {
  const io = new IntersectionObserver(([e]) => opts.onchange(e!.isIntersecting), { rootMargin: opts.margin ?? '0px', threshold: opts.threshold ?? 0 })
  io.observe(node)
  return { destroy: () => io.disconnect() }
}

/** Adds .in once the element scrolls into view (the CSS in global.css does the rest). */
const revealer = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealer!.unobserve(e.target) }
    }, { rootMargin: '0px 0px -8% 0px' })
  : null
export function reveal(node: HTMLElement, delay = 0) {
  node.classList.add('reveal')
  if (delay) node.style.setProperty('--delay', `${delay}ms`)
  if (revealer) revealer.observe(node)
  else node.classList.add('in')
  return { destroy: () => revealer?.unobserve(node) }
}

/**
 * Glowing Effect (21st.dev, Aceternity), without framer-motion: adds a .glow-edge layer whose arc turns toward the
 * pointer while it is near. One pointer listener for every glowing element; the rAF loop runs only while an arc is
 * still easing, and only elements on screen are measured.
 */
type Glow = { node: HTMLElement; edge: HTMLElement; angle: number; target: number; visible: boolean }
const glows = new Set<Glow>()
const glowIO = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(entries => { for (const e of entries) for (const g of glows) if (g.node === e.target) g.visible = e.isIntersecting })
  : null
let glowFrame = 0, px = -1e4, py = -1e4
function glowStep() {
  glowFrame = 0
  let moving = false
  for (const g of glows) {
    if (!g.visible) continue
    const r = g.node.getBoundingClientRect(), near = 64
    const active = px > r.left - near && px < r.right + near && py > r.top - near && py < r.bottom + near
    g.edge.style.setProperty('--active', active ? '1' : '0')
    if (!active) continue
    const target = (180 * Math.atan2(py - (r.top + r.height / 2), px - (r.left + r.width / 2))) / Math.PI + 90
    // the short way round, like the original
    g.target = g.angle + ((((target - g.angle + 180) % 360) + 360) % 360) - 180
    // ease toward it (the original's [0.16, 1, 0.3, 1] over 2 s feels like this lerp)
    g.angle += (g.target - g.angle) * 0.08
    if (Math.abs(g.target - g.angle) > 0.1) moving = true
    g.edge.style.setProperty('--start', g.angle.toFixed(2))
  }
  if (moving) glowFrame = requestAnimationFrame(glowStep)
}
const glowKick = () => { if (!glowFrame) glowFrame = requestAnimationFrame(glowStep) }
if (typeof window !== 'undefined') {
  addEventListener('pointermove', e => { if (e.pointerType !== 'touch') { px = e.clientX; py = e.clientY; glowKick() } }, { passive: true })
  addEventListener('scroll', () => { if (glows.size) glowKick() }, { passive: true })
}
export function glow(node: HTMLElement, opts: { spread?: number; width?: number } = {}) {
  if (!finePointer() || reducedMotion()) return
  const edge = document.createElement('span')
  edge.className = 'glow-edge'
  edge.setAttribute('aria-hidden', 'true')
  if (opts.spread) edge.style.setProperty('--spread', String(opts.spread))
  if (opts.width) edge.style.setProperty('--bw', `${opts.width}px`)
  node.prepend(edge)
  const g: Glow = { node, edge, angle: 0, target: 0, visible: false }
  glows.add(g)
  glowIO?.observe(node)
  return { destroy() { glows.delete(g); glowIO?.unobserve(node); edge.remove() } }
}

/** Sets --mx/--my (px) and --rx/--ry (-1…1) on the element for a light that follows the pointer and a slight tilt. */
export function spotlight(node: HTMLElement) {
  if (!finePointer()) return
  const move = (e: PointerEvent) => {
    const r = node.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top
    node.style.setProperty('--mx', `${x}px`)
    node.style.setProperty('--my', `${y}px`)
    node.style.setProperty('--rx', (x / r.width * 2 - 1).toFixed(3))
    node.style.setProperty('--ry', (y / r.height * 2 - 1).toFixed(3))
  }
  const leave = () => { node.style.setProperty('--rx', '0'); node.style.setProperty('--ry', '0') }
  node.addEventListener('pointermove', move)
  node.addEventListener('pointerleave', leave)
  return { destroy() { node.removeEventListener('pointermove', move); node.removeEventListener('pointerleave', leave) } }
}
