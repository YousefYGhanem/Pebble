// Screen time: how long each app was in front today (seconds), counted on this PC only.

export interface ScreenDay { day: string; apps: Record<string, number> }

export const freshScreen = (now: number): ScreenDay => ({ day: new Date(now).toDateString(), apps: {} })

/** Adds seconds to an app's time; a new day starts from nothing. */
export function countTime(st: ScreenDay, app: string, seconds: number, now: number): ScreenDay {
  const s = st.day === new Date(now).toDateString() ? st : freshScreen(now)
  if (!app || seconds <= 0) return s
  return { ...s, apps: { ...s.apps, [app]: (s.apps[app] ?? 0) + seconds } }
}

/** The apps you spent most time in today, longest first (at least a minute each). */
export function topApps(st: ScreenDay, n = 3): { name: string; seconds: number }[] {
  return Object.entries(st.apps).filter(([, s]) => s >= 60).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, seconds]) => ({ name, seconds: Math.round(seconds) }))
}

/** A process name as people know it ("code" → "Code"). */
export const appName = (process: string) => process ? process[0]!.toUpperCase() + process.slice(1) : ''
