import type { Status } from './state'

// Pip's rules, shared by the main process (stats, unlocks) and the island (drawing). Pure, so they are testable.

/** Pip's colours: the theme's, one of the app icons' (build/icons), or your own (settings: pip.look) */
export const PIP_LOOKS = ['theme', 'lavender', 'cream', 'graphite', 'custom'] as const
export type PipLookId = (typeof PIP_LOOKS)[number]
const ICON_COLORS = { lavender: { body: '#e4dcff', visor: '#1c1730' }, cream: { body: '#f1e4cf', visor: '#1d1628' }, graphite: { body: '#4a4958', visor: '#08070e' } }
export function pipColors(p: { look: PipLookId; body: string; visor: string }, tok: { pipBody?: string; pipVisor?: string }) {
  if (p.look === 'custom') return { body: p.body, visor: p.visor }
  if (p.look !== 'theme') return ICON_COLORS[p.look]
  return { body: tok.pipBody ?? '#ece9f6', visor: tok.pipVisor ?? '#15151c' }
}

export type Mood = 'idle' | 'curious' | 'focused' | 'alert' | 'happy' | 'love' | 'sleepy' | 'dizzy' | 'grumpy' | 'dancing' | 'sad'
export const MOODS: Mood[] = ['idle', 'curious', 'focused', 'alert', 'happy', 'love', 'sleepy', 'dizzy', 'grumpy', 'dancing', 'sad']

export interface MoodInput {
  status: Status
  now: number
  /** times you poked Pip (clicked him) */
  pokes: number[]
  /** you answered or replied from the island */
  lovedAt: number
  /** a task just finished */
  happyAt: number
  /** no keyboard or mouse for a while (main process) */
  sleepy: boolean
  /** music plays on this PC */
  playing: boolean
  /** the mouse is on the island */
  hovering: boolean
  /** a CLI just passed 80% or 95% of its limit */
  worriedAt?: number
}

/** What Pip feels right now. Short reactions (pokes, love, happy) win over the agent's state, which wins over the rest. */
export function moodFor(i: MoodInput): Mood {
  const pokes = i.pokes.filter(t => i.now - t < 3000).length
  if (pokes >= 6) return 'dizzy'
  if (pokes >= 3) return 'grumpy'
  if (i.now - i.lovedAt < 2500) return 'love'
  if (i.now - i.happyAt < 3000) return 'happy'
  if (i.now - (i.worriedAt ?? 0) < 4000) return 'alert' // a usage limit is near
  if (i.status === 'error') return 'sad'
  if (i.status === 'question') return 'alert'
  if (i.status === 'running') return 'focused'
  if (i.playing) return 'dancing'
  if (i.hovering) return 'curious'
  if (i.sleepy) return 'sleepy'
  return 'idle'
}

// ---------- outfits ----------

export interface Outfit {
  id: string
  name: string
  /** unlocked after this many finished tasks */
  tasks?: number
  /** worn by itself in this season (month 1–12, day): from [m, d] to [m, d], inclusive */
  season?: [number, number, number, number]
}

export const OUTFITS: Outfit[] = [
  { id: 'glasses', name: 'Glasses', tasks: 10 },
  { id: 'cap', name: 'Cap', tasks: 25 },
  { id: 'headphones', name: 'Headphones', tasks: 50 },
  { id: 'crown', name: 'Crown', tasks: 100 },
  { id: 'witch', name: 'Witch hat', season: [10, 24, 10, 31] },
  { id: 'santa', name: 'Santa hat', season: [12, 1, 12, 26] },
  { id: 'party', name: 'Party hat', season: [12, 31, 1, 1] }
]

export function inSeason(o: Outfit, date: Date): boolean {
  if (!o.season) return false
  const [m1, d1, m2, d2] = o.season
  const v = (date.getMonth() + 1) * 100 + date.getDate(), from = m1 * 100 + d1, to = m2 * 100 + d2
  return from <= to ? v >= from && v <= to : v >= from || v <= to // a season can cross new year
}

/** Built-in outfits you can wear: earned by tasks, or in season now. */
export function wearable(done: number, date: Date): string[] {
  return OUTFITS.filter(o => (o.tasks !== undefined && done >= o.tasks) || inSeason(o, date)).map(o => o.id)
}

/**
 * The outfit to draw for the setting: 'none'; 'auto' = the outfit of the season, else nothing; or an id
 * (a built-in you may wear, or one of your own SVG files).
 */
export function outfitFor(setting: string, done: number, date: Date, custom: string[]): string | null {
  if (setting === 'none') return null
  if (setting === 'auto') return OUTFITS.find(o => inSeason(o, date))?.id ?? null
  if (custom.includes(setting)) return setting
  return wearable(done, date).includes(setting) ? setting : null
}

// ---------- achievements ----------

export interface PipStats { done: number; achievements: string[] }
export interface Finished { at: number; seconds: number }

export const ACHIEVEMENTS: { id: string; name: string; test: (s: PipStats, f: Finished) => boolean }[] = [
  { id: 'first', name: 'First task', test: s => s.done >= 1 },
  { id: 'ten', name: '10 tasks (Glasses)', test: s => s.done >= 10 },
  { id: 'twenty-five', name: '25 tasks (Cap)', test: s => s.done >= 25 },
  { id: 'fifty', name: '50 tasks (Headphones)', test: s => s.done >= 50 },
  { id: 'hundred', name: '100 tasks (Crown)', test: s => s.done >= 100 },
  { id: 'night-owl', name: 'Night owl: a task done between midnight and 5', test: (_, f) => new Date(f.at).getHours() < 5 },
  { id: 'quick', name: 'Quick one: done in 20 seconds', test: (_, f) => f.seconds > 0 && f.seconds <= 20 },
  { id: 'marathon', name: 'Marathon: one task over 30 minutes', test: (_, f) => f.seconds >= 1800 }
]

/** Counts a finished task; returns the new stats and the achievements it just earned. */
export function finishTask(stats: PipStats, f: Finished): { stats: PipStats; earned: string[] } {
  const next = { done: stats.done + 1, achievements: [...stats.achievements] }
  const earned = ACHIEVEMENTS.filter(a => !next.achievements.includes(a.id) && a.test(next, f)).map(a => a.id)
  next.achievements.push(...earned)
  return { stats: next, earned }
}
