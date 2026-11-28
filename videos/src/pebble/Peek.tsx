import { T, FONT_TEXT, FONT_AR } from './tokens'

// The connect peek (a twin of the island's notice: App.svelte's peek with a ring), drawn in capture px (2x) so it
// sits in the island like a capture: the device icon in a ring of its battery, its name, what happened, the level.
/** In app px (it draws at 2x, scaled by z / 2). */
export const PEEK_BOX = { w: 380, h: 48 }

export function Peek({ title, sub, level, rtl, scale }: { title: string; sub: string; level: number; rtl: boolean; scale: number }) {
  const ring = 30, c = 2 * Math.PI * ring
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      width: PEEK_BOX.w * 2, height: PEEK_BOX.h * 2, transform: `scale(${scale})`, transformOrigin: '0 0',
      display: 'flex', alignItems: 'center', gap: 22, padding: '0 34px', boxSizing: 'border-box', color: T.text,
      fontFamily: rtl ? FONT_AR : FONT_TEXT,
    }}>
      <svg width={70} height={70} viewBox="0 0 70 70" style={{ flex: 'none' }}>
        <circle cx={35} cy={35} r={ring} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={5} />
        <circle cx={35} cy={35} r={ring} fill="none" stroke={T.done} strokeWidth={5} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - level / 100)} transform="rotate(-90 35 35)" />
        {/* app/renderer/island/Icon.svelte: headset */}
        <g transform="translate(23 23)" fill="none" stroke={T.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15v-3a8 8 0 0 1 16 0v3 M4 15h3v5H4z M17 15h3v5h-3z" />
        </g>
      </svg>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
        <div style={{ fontSize: 28, fontWeight: 600, whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 24, color: T.muted, whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      <div dir="ltr" style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{level}%</div>
    </div>
  )
}
