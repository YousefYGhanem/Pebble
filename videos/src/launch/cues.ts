// The launch film's beat sheet: 13 bars at 120 BPM (a beat 0.5 s, a bar 2 s), 26 s. Scenes never hold a literal time:
// every moment is b(bar, beat, fraction) on this grid, so a new track only changes GRID.
import { at, type Grid } from '../kit/time'

export const GRID: Grid = { bpm: 120, firstBeat: 0, pickupBeats: 0, beatsPerBar: 4 }
export const b = (bar: number, beat = 1, fraction = 0) => at(GRID, bar, beat, fraction)
export const BARS = 13
export const DURATION = b(BARS + 1) // 26 s

/** The island's states, in order (a capture in public/ui, or 'peek': the connect peek drawn in code). */
export const ISLAND: readonly (readonly [time: number, state: string])[] = [
  [0, 'resting'],
  [b(2), 'working'], // an agent works
  [b(3), 'question'], // it asks
  [b(4, 3), 'done'], // answered: done
  [b(5), 'music'], // a song starts
  [b(5, 3), 'page-music'], // the Music page
  [b(7), 'page-home'], // Home: the batteries row
  [b(8, 2), 'peek'], // headphones connect
  [b(9), 'page-pip'], // Pip's page
  [b(11), 'resting'], // home again
]
/** The island rises away for the end card. */
export const ISLAND_LEAVES = b(11, 3)

/** The click on "Stripe": the cursor lands, presses, lets go. */
export const CLICK = b(4)
export const CURSOR_IN = b(3, 2)
export const CURSOR_OUT = b(4, 2)
/** The batteries row lights up on Home. */
export const BATTERIES_GLOW = b(7, 2)

/** Pip's moods: [time, mood]. */
export const MOODS = [
  [0, 'sleepy'],
  [b(1, 2), 'idle'], // he wakes
  [b(2), 'focused'],
  [b(3), 'alert'],
  [b(4), 'love'], // you answered
  [b(4, 3), 'happy'],
  [b(5), 'dancing'],
  [b(7), 'curious'],
  [b(8, 2), 'happy'],
  [b(9), 'idle'],
  [b(11), 'love'],
  [b(12), 'happy'],
] as const
/** Pip opens his eyes (he sleeps at the start). */
export const WAKE = b(1, 2)
/** Little hops: something happened. */
export const JELLY = [b(2), b(3), b(4), b(4, 3), b(8, 2), b(11, 3)]
/** Blinks (eyes shut for a moment). */
export const BLINKS = [b(3, 3), b(6, 2), b(9, 3), b(10, 3), b(12, 3)]

/** Captions: [from, to, key]. */
export const CAPTIONS = [
  [b(1, 2), b(2), 'meet'],
  [b(2), b(3), 'agents'],
  [b(3), b(5), 'answer'],
  [b(5), b(7), 'music'],
  [b(7), b(9), 'batteries'],
  [b(9), b(11), 'pip'],
] as const
/** The end card: Pip comes to the centre, then the name, the line and the Store badge. */
export const END = { pip: b(11, 3), name: b(12), line: b(12, 2), badge: b(12, 3), wink: b(13) }
