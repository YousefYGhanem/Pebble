import type { Agent } from './state'
import type { Usage } from './ipc'

// Two things about your agents' day, pure so they are testable: the usage limits they just went past (alerts), and
// what they did today (the summary card on the island's Home page).

// ---------- usage alerts ----------

export type UsageWindow = 'fiveHour' | 'sevenDay' | 'spend'
// near (75), close (90), reached (100): a warning while there is still room to plan
export const ALERT_LEVELS = [75, 90, 100] as const

/** The limits a CLI just went past (only the highest, if a jump passed both). A new window starts below them again. */
export function usageAlerts(prev: Usage | undefined, next: Usage): { window: UsageWindow; level: number; resetsAt: number }[] {
  const out: { window: UsageWindow; level: number; resetsAt: number }[] = []
  for (const w of ['fiveHour', 'sevenDay', 'spend'] as const) {
    const a = prev?.[w], b = next[w]
    if (!a || !b) continue // the first report after a start is the baseline, not news
    const level = [...ALERT_LEVELS].reverse().find(l => a.used < l && b.used >= l)
    if (level) out.push({ window: w, level, resetsAt: b.resetsAt })
  }
  return out
}

// ---------- the day ----------

/** How much of a CLI's usage went today: % of the week (plans) or tokens (pay as you go). */
export interface Spent { unit: '%' | 'tokens'; base: number; prev: number; acc: number }

export interface Day {
  /** local date, YYYY-MM-DD */
  day: string
  tasks: number
  seconds: number
  files: number
  agents: Partial<Record<Agent, { tasks: number; seconds: number }>>
  spent: Partial<Record<Agent, Spent>>
}

export interface Days { today: Day; yesterday: Day | null }

export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const emptyDay = (t: number): Day => ({ day: dayKey(t), tasks: 0, seconds: 0, files: 0, agents: {}, spent: {} })

/** Today and yesterday as of `now` (a new day moves today to yesterday; an older one is forgotten). */
export function daysAt(d: Days, now: number): Days {
  const key = dayKey(now)
  if (d.today.day === key) return d
  const yesterday = dayKey(new Date(now).setHours(0, 0, 0, 0) - 1)
  return { today: emptyDay(now), yesterday: d.today.day === yesterday && d.today.tasks ? d.today : null }
}

/** A finished task. */
export function addTask(d: Days, now: number, t: { agent: Agent; seconds: number; files: number }): Days {
  const { today, yesterday } = daysAt(d, now)
  const a = today.agents[t.agent] ?? { tasks: 0, seconds: 0 }
  return { yesterday, today: { ...today, tasks: today.tasks + 1, seconds: today.seconds + t.seconds, files: today.files + t.files,
    agents: { ...today.agents, [t.agent]: { tasks: a.tasks + 1, seconds: a.seconds + t.seconds } } } }
}

/** A usage report: the first one of the day is the starting point; a window that resets mid-day keeps what went before. */
export function addUsage(d: Days, now: number, agent: Agent, u: Usage): Days {
  const unit = u.sevenDay ? '%' : u.tokens ? 'tokens' : null
  if (!unit) return d
  const v = unit === '%' ? u.sevenDay!.used : u.tokens!.week
  const { today, yesterday } = daysAt(d, now)
  const s = today.spent[agent]
  const next: Spent = !s || s.unit !== unit ? { unit, base: v, prev: v, acc: 0 }
    : v < s.prev ? { unit, base: 0, prev: v, acc: s.acc + s.prev - s.base }
    : { ...s, prev: v }
  return { yesterday, today: { ...today, spent: { ...today.spent, [agent]: next } } }
}

export const spentOf = (s: Spent) => Math.max(0, s.acc + s.prev - s.base)
