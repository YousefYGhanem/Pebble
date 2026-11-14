import { reducedMotion } from '../lib/motion'

/**
 * A counter that steps every `ms` while its element is on screen, the tab is visible and nobody points at it or has
 * the keyboard in it (live demos loop with it).
 * Use: const tick = ticker(2000); <div use:tick.watch>{tick.n}</div>
 */
export function ticker(ms: number, slowerWhenReduced = 1.6) {
  const s = $state({ n: 0 })
  let visible = false, held = false, id = 0
  const sync = () => {
    clearInterval(id)
    if (visible && !held && !document.hidden) id = window.setInterval(() => s.n++, reducedMotion() ? ms * slowerWhenReduced : ms)
  }
  return {
    get n() { return s.n },
    set n(v: number) { s.n = v },
    watch(node: Element) {
      const io = new IntersectionObserver(([e]) => { visible = e!.isIntersecting; sync() })
      io.observe(node)
      // pointing at a demo or tabbing into it holds it still, so it can be read
      const hold = (e: Event) => { held = e.type === 'pointerenter' || e.type === 'focusin'; sync() }
      const HOLD = ['pointerenter', 'pointerleave', 'focusin', 'focusout']
      for (const t of HOLD) node.addEventListener(t, hold)
      document.addEventListener('visibilitychange', sync)
      return { destroy() { for (const t of HOLD) node.removeEventListener(t, hold); io.disconnect(); clearInterval(id); document.removeEventListener('visibilitychange', sync) } }
    },
    /** stop looping (the visitor took over) */
    stop() { visible = false; sync() }
  }
}
