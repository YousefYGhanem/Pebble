// Small Svelte actions for the page's motion. All of them do nothing extra under prefers-reduced-motion
// or on touch screens, and none of them reads layout on scroll.

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

/** The element leans a little toward the pointer. */
export function magnetic(node: HTMLElement, strength = 0.28) {
  if (!finePointer()) return
  const move = (e: PointerEvent) => {
    if (reducedMotion()) return
    const r = node.getBoundingClientRect()
    node.style.translate = `${(e.clientX - r.left - r.width / 2) * strength}px ${(e.clientY - r.top - r.height / 2) * strength}px`
  }
  const leave = () => { node.style.translate = '' }
  node.addEventListener('pointermove', move)
  node.addEventListener('pointerleave', leave)
  return { destroy() { node.removeEventListener('pointermove', move); node.removeEventListener('pointerleave', leave) } }
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
