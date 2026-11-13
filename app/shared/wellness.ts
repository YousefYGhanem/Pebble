// Water and stand-up reminders, pure (tested): when to ask, within the hours you set, never while you are away.

export interface WellnessSettings { water: boolean; waterMinutes: number; stand: boolean; standMinutes: number; from: number; to: number }
export interface WellnessState { day: string; glasses: number; lastWater: number; sittingSince: number; seen?: number }

const AWAY = 5 * 60 // seconds without mouse or keyboard: you got up (that is a break, and nobody is there to remind)

export const freshWellness = (now: number): WellnessState => ({ day: new Date(now).toDateString(), glasses: 0, lastWater: now, sittingSince: now })

/** What to ask now (null: nothing), and the state after asking. idle: seconds since the last mouse or keyboard input. */
export function wellnessCheck(st: WellnessState, now: number, idle: number, c: WellnessSettings): { due: 'water' | 'stand' | null; st: WellnessState } {
  let s = { ...(st.day === new Date(now).toDateString() ? st : { ...st, day: new Date(now).toDateString(), glasses: 0 }), seen: now }
  // away (or asleep, or resting: no looks meanwhile): that was a break; water waits at least 15 minutes after it
  if (idle >= AWAY || now - (st.seen ?? now) >= AWAY * 1000) return { due: null, st: { ...s, sittingSince: now, lastWater: Math.max(s.lastWater, now - (c.waterMinutes - 15) * 60_000) } }
  const hour = new Date(now).getHours()
  if (hour < c.from || hour >= c.to) return { due: null, st: s }
  if (c.stand && now - s.sittingSince >= c.standMinutes * 60_000) return { due: 'stand', st: { ...s, sittingSince: now } }
  if (c.water && now - s.lastWater >= c.waterMinutes * 60_000) return { due: 'water', st: { ...s, lastWater: now } }
  return { due: null, st: s }
}

/** Your answer: done (a glass more), or later (asked again in 15 minutes). */
export function wellnessAnswer(st: WellnessState, what: 'water' | 'stand', done: boolean, now: number, c: WellnessSettings): WellnessState {
  if (what === 'water') return done ? { ...st, glasses: st.glasses + 1 } : { ...st, lastWater: now - (c.waterMinutes - 15) * 60_000 }
  return done ? st : { ...st, sittingSince: now - (c.standMinutes - 15) * 60_000 }
}
