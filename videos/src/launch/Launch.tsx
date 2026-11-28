import { AbsoluteFill, Audio, Img, staticFile } from 'remotion'
import { clamp01, progress, useTime } from '../kit/time'
import { step } from '../kit/spring'
import { Island, islandAt } from '../pebble/Island'
import { Pip, type PipScript } from '../pebble/Pip'
import { Caption } from '../pebble/Caption'
import { Cursor } from '../pebble/Cursor'
import { PEEK_BOX, Peek } from '../pebble/Peek'
import { FONT, FONT_AR, FONT_TEXT, GROW, T } from '../pebble/tokens'
import { BATTERIES_GLOW, BLINKS, CAPTIONS, CLICK, CURSOR_IN, CURSOR_OUT, END, ISLAND, ISLAND_LEAVES, JELLY, MOODS, WAKE, b } from './cues'
import { PEEK, WORDS, type Lang } from './words'

// Pebble's launch film (4:5, 1080 x 1350): the island at the top of the screen changes shape through what Pebble does,
// Pip watches from below and reacts, a caption says it in one line, and the end card names it. See videos/BRAND.md.

const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)
const W = 1080
/** Film px per app px, by state: small states read big, full pages fit the frame (captures are 3x: crisp up to 3). */
const ZOOM: Record<string, number> = { resting: 2.6, working: 2.6, done: 2.6, music: 2.6, question: 2.2, peek: 2.4, 'page-music': 1.52, 'page-home': 1.52, 'page-pip': 1.52 }

export type LaunchProps = { lang: Lang; fps: number; debug?: boolean }

const SCRIPT: PipScript = {
  moods: MOODS,
  wake: WAKE,
  blinks: BLINKS,
  jelly: JELLY,
  wink: END.wink,
  look: t => (t < END.pip ? { x: 0, y: -0.8 } : { x: 0, y: 0 }), // up at the island, then at you
}

export function Launch({ lang }: LaunchProps) {
  const t = useTime()
  const rtl = lang === 'ar'
  const words = WORDS[lang]

  // the island now (its size springs with its zoom), so Pip can float under it
  const island = islandAt(t, ISLAND, ZOOM, { peek: PEEK_BOX })
  const leave = ease(progress(t, ISLAND_LEAVES, 0.7))
  const toEnd = step(t - END.pip, GROW)

  // Pip: between the island and the caption, then the centre of the end card, bigger
  const pipY = (island.h + 990) / 2 * (1 - toEnd) + 470 * toEnd
  const pipSize = 176 + (214 - 176) * toEnd
  // he breathes: a slow bob over each bar (calm while asleep)
  const bob = Math.sin((t / 2) * Math.PI * 2) * (t < 0.75 ? 2 : 6)

  // the lamp over the top of the screen breathes a little on each beat
  const beat = t / 0.5, pulse = Math.exp(-(beat - Math.floor(beat)) * 5)
  const glow = 0.26 + 0.05 * pulse + 0.12 * toEnd

  const press = Math.max(0, 1 - Math.abs(t - CLICK) / 0.18)
  const pressed = clamp01((t - CLICK) / 0.06)
  const rowGlow = ease(progress(t, BATTERIES_GLOW, 0.4)) * (1 - progress(t, b(8, 2), 0.2))

  return (
    <AbsoluteFill style={{ background: T.night, overflow: 'hidden' }}>
      {/* the night: a lamp at the top (the site's hero), a faint cyan glow below */}
      <AbsoluteFill style={{ background: `radial-gradient(70% 42% at 50% 0%, rgba(124, 92, 255, ${glow}), transparent 70%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(60% 30% at 50% 100%, rgba(83, 228, 255, 0.07), transparent 70%)' }} />

      <Island
        t={t}
        keys={ISLAND}
        zoom={ZOOM}
        folder={rtl ? 'ui-ar' : 'ui'}
        top={leave * 260}
        custom={{ peek: { ...PEEK_BOX, render: z => <Peek title={PEEK[lang].title} sub={PEEK[lang].sub} level={90} rtl={rtl} scale={z / 2} /> } }}
        overlay={{
          // "Stripe", pressed: the island's likely button (accent) as you click it (measured: 198, 72.5, 101 x 29.5)
          question: z => (
            <div style={{
              position: 'absolute', left: 198 * z, top: 72.5 * z, width: 101 * z, height: 29.5 * z, borderRadius: 999,
              background: T.accent, opacity: pressed, scale: `${1 - press * 0.05}`,
              display: 'grid', placeItems: 'center', color: '#fff', fontFamily: FONT_TEXT, fontSize: 13 * z, fontWeight: 600,
            }}>Stripe</div>
          ),
          // Home: the batteries row lights up (measured: 90, 261, 644 x 30.5)
          'page-home': z => (
            <div style={{
              position: 'absolute', left: 90 * z, top: 261 * z, width: 644 * z, height: 30.5 * z, borderRadius: 15 * z,
              boxShadow: `0 0 0 ${2 * rowGlow}px ${T.lavender}, 0 0 ${28 * rowGlow}px rgba(185, 168, 255, ${0.45 * rowGlow})`,
            }} />
          ),
        }}
      />

      {/* his shadow on the night: smaller when he rises */}
      <div style={{
        position: 'absolute', left: W / 2 - pipSize * 0.55, top: pipY + pipSize * 0.72, width: pipSize * 1.1, height: pipSize * 0.16, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(124, 92, 255, 0.32), transparent)', scale: `${1 - bob * 0.012}`,
      }} />
      <Pip t={t} script={SCRIPT} size={pipSize} x={W / 2} y={pipY + bob} />

      <Cursor t={t} from={CURSOR_IN} to={b(4, 3)} arrive={CLICK - 0.02} click={CLICK} leave={CURSOR_OUT}
        start={{ x: 760, y: 900 }} end={{ x: 540 + (248.5 - 412) * ZOOM.question - 4, y: 87 * ZOOM.question - 4 }} />

      {CAPTIONS.map(([from, to, key]) => (
        <Caption key={key} t={t} from={from} to={to} text={words[key]} rtl={rtl} y={1010} size={72} />
      ))}

      <EndCard t={t} lang={lang} />
      {/* the music, composed for this grid (scripts/compose.py) */}
      <Audio src={staticFile('audio/launch.wav')} />
    </AbsoluteFill>
  )
}

function EndCard({ t, lang }: { t: number; lang: Lang }) {
  if (t < END.name - 0.1) return null
  const rtl = lang === 'ar'
  const rise = (at: number) => { const k = ease(progress(t, at, 0.55)); return { opacity: k, translate: `0 ${(1 - k) * 30}px`, filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined } }
  return (
    <AbsoluteFill dir={rtl ? 'rtl' : 'ltr'} style={{ alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: 610, fontFamily: FONT, fontWeight: 700, fontSize: 168, letterSpacing: -5, color: T.text, ...rise(END.name) }}>Pebble</div>
      <div style={{ position: 'absolute', top: 830, fontFamily: rtl ? FONT_AR : FONT_TEXT, fontSize: 38, color: T.muted, ...rise(END.line) }}>{WORDS[lang].line}</div>
      <div style={{ position: 'absolute', top: 925, ...rise(END.badge) }}>
        <Img src={staticFile(`brand/ms-store-${rtl ? 'ar' : 'en'}.svg`)} style={{ display: 'block', height: 112 }} />
      </div>
      <div style={{ position: 'absolute', top: 1070, fontFamily: rtl ? FONT_AR : FONT_TEXT, fontSize: 32, color: T.muted, ...rise(END.badge + 0.15) }}>{WORDS[lang].search}</div>
    </AbsoluteFill>
  )
}
