import { clamp01 } from '../kit/time'

// The Windows arrow, gliding on an eased curve that arrives exactly at the click, then a small press.
const ease = (x: number) => { const k = clamp01(x); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2 }

export function Cursor({ t, from, to, arrive, click, leave, start, end }: {
  t: number; from: number; to: number; arrive: number; click: number; leave: number
  start: { x: number; y: number }; end: { x: number; y: number }
}) {
  if (t < from || t > to) return null
  const k = ease((t - from) / (arrive - from))
  const back = ease((t - leave) / (to - leave))
  // a slight arc: the path bows up as it travels
  const x = start.x + (end.x - start.x) * k + (start.x - end.x) * back * 0.6
  const y = start.y + (end.y - start.y) * k - Math.sin(k * Math.PI) * 60 + 260 * back
  const press = Math.max(0, 1 - Math.abs(t - click) / 0.12)
  const opacity = clamp01((t - from) / 0.15) * (1 - back)
  return (
    <svg width={34} height={48} viewBox="0 0 17 24" style={{ position: 'absolute', left: x, top: y, opacity, scale: `${1 - press * 0.14}`, transformOrigin: '0 0', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.45))' }}>
      <path d="M1 1v19.5l5-4.6 3.3 7.3 3-1.4-3.2-7.1H16L1 1Z" fill="#fff" stroke="#111" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  )
}
