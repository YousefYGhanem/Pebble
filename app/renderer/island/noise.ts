// Background sound for a focus round, made here (no sound files, nothing to license): rain is pink noise, deep is brown
// noise, waves is brown noise that swells and ebbs every ~10 s. Its audio stream exists only while it plays.

export type NoiseKind = 'off' | 'rain' | 'deep' | 'waves'

let ctx: AudioContext | undefined
let playing: NoiseKind = 'off'

/** A few seconds of noise, looped: pink (rain) or brown (deep, waves). */
function buffer(c: AudioContext, kind: 'pink' | 'brown'): AudioBuffer {
  const b = c.createBuffer(1, c.sampleRate * 6, c.sampleRate), d = b.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 }
    else { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11 }
  }
  return b
}

/** Plays (or stops: 'off') the focus sound; calling it again with the same kind does nothing. */
export function playNoise(kind: NoiseKind) {
  if (kind === playing) return
  playing = kind
  void ctx?.close()
  ctx = undefined
  if (kind === 'off') return
  const c = (ctx = new AudioContext())
  const src = c.createBufferSource()
  src.buffer = buffer(c, kind === 'rain' ? 'pink' : 'brown')
  src.loop = true
  const gain = c.createGain()
  gain.gain.value = 0.16
  // a smooth start (no click)
  gain.gain.setValueAtTime(0, c.currentTime)
  gain.gain.linearRampToValueAtTime(0.16, c.currentTime + 1.5)
  if (kind === 'waves') {
    const lfo = c.createOscillator(), depth = c.createGain()
    lfo.frequency.value = 0.1
    depth.gain.value = 0.1
    lfo.connect(depth).connect(gain.gain)
    lfo.start()
  }
  src.connect(gain).connect(c.destination)
  src.start()
}
