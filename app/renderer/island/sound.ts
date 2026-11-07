let ctx: AudioContext | undefined

// Pip's voice: soft, round chirps, no words. Made with WebAudio (no sound files, nothing to license).
// Each note: a sine that slides in pitch with a quiet octave on top, a quick attack and a soft fade.
type Note = [from: number, to: number, start: number, length: number]

const CHIRPS: Record<string, Note[]> = {
  hello: [[520, 780, 0, 0.12], [780, 1040, 0.13, 0.14]],
  bye: [[880, 660, 0, 0.12], [660, 440, 0.13, 0.18]],
  done: [[660, 660, 0, 0.1], [880, 880, 0.11, 0.1], [1180, 1320, 0.22, 0.16]],
  question: [[700, 900, 0, 0.1], [900, 1150, 0.14, 0.14]],
  love: [[600, 900, 0, 0.16], [900, 1200, 0.15, 0.2]],
  poke: [[900, 1300, 0, 0.06]],
  grumpy: [[420, 320, 0, 0.16]],
  dizzy: [[1000, 500, 0, 0.12], [900, 450, 0.12, 0.12], [800, 400, 0.24, 0.16]],
  achievement: [[523, 523, 0, 0.1], [659, 659, 0.1, 0.1], [784, 784, 0.2, 0.1], [1047, 1100, 0.3, 0.26]]
}

export type Chirp = keyof typeof CHIRPS

let quiet: ReturnType<typeof setTimeout> | undefined

export function chirp(kind: Chirp, volume = 0.07) {
  ctx ??= new AudioContext()
  // an open AudioContext keeps a sound stream (and Chromium's audio process busy): closed a few seconds after the last chirp
  clearTimeout(quiet)
  quiet = setTimeout(() => { void ctx?.close(); ctx = undefined }, 4000)
  const t0 = ctx.currentTime + 0.01
  const jitter = kind === 'poke' ? 0.85 + Math.random() * 0.3 : 1 // pokes never sound exactly the same
  for (const [from, to, start, length] of CHIRPS[kind]!) {
    for (const [mult, gain] of [[1, volume], [2, volume * 0.25]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + start
      o.type = 'sine'
      o.frequency.setValueAtTime(from * mult * jitter, t)
      o.frequency.exponentialRampToValueAtTime(to * mult * jitter, t + length)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(gain, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + length)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + length + 0.02)
    }
  }
}
