import { clamp01, progress } from '../kit/time'
import { FONT, FONT_AR, T } from './tokens'

// A caption that builds word by word (each word keeps its slot, so the line never re-centres while it builds) and
// leaves as one line. *word* is in the accent colour. Arabic runs right to left in its own face.
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)

export function Caption({ t, from, to, text, rtl, y, size = 66 }: { t: number; from: number; to: number; text: string; rtl: boolean; y: number; size?: number }) {
  if (t < from - 0.05 || t > to + 0.05) return null
  const words = text.split(' ')
  const leave = progress(t, to - 0.28, 0.26)
  let accent = false
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{
      position: 'absolute', left: 70, right: 70, top: y, textAlign: 'center',
      fontFamily: rtl ? FONT_AR : FONT, fontWeight: 700, fontSize: size, lineHeight: 1.16, letterSpacing: rtl ? 0 : -1.2,
      color: T.text, opacity: 1 - leave, translate: `0 ${-leave * 24}px`, filter: leave > 0 ? `blur(${leave * 8}px)` : undefined,
      textWrap: 'balance',
    }}>
      {words.map((raw, i) => {
        const start = raw.startsWith('*'), end = raw.endsWith('*')
        if (start) accent = true
        const word = raw.replace(/\*/g, '')
        const mine = accent
        if (end) accent = false
        const shown = ease(progress(t, from + i * 0.075, 0.32))
        return (
          <span key={i} style={{ display: 'inline-block', marginInlineEnd: '0.24em', opacity: shown, translate: `0 ${(1 - shown) * 28}px`, filter: shown < 1 ? `blur(${(1 - shown) * 10}px)` : undefined, color: mine ? T.lavender : T.text }}>
            {word}
          </span>
        )
      })}
    </div>
  )
}
