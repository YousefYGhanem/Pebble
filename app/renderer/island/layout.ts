import type { Settings } from '../../shared/settings'
import type { Session, Status } from '../../shared/state'
import type { Rect } from './spring'

// Which size the island takes, and how big that is (notch, floating; resting, news, asking, open).
//   tucked  a thin line at the top edge, clicks go through
//   resting the eyes only (nothing going on)
//   medium  one line: what the busiest session does
//   ask     a session waits for Allow/Deny
//   open    the full page (sessions list)
export type Mode = 'tucked' | 'resting' | 'medium' | 'ask' | 'open'

const RANK: Record<Status, number> = { question: 4, error: 3, running: 2, done: 1, ready: 0 }

/** Busiest first. "done" stays until you have seen it, then counts as ready after doneSeconds. */
export function rank(sessions: Session[], doneSeconds: number, now: number): Session[] {
  return sessions
    .map(s => (s.status === 'done' && s.seenAt && now - s.seenAt > doneSeconds * 1000 ? { ...s, status: 'ready' as Status } : s))
    .sort((a, b) => RANK[b.status] - RANK[a.status] || b.at - a.at)
}

export function modeFor(o: { tucked: boolean; open: boolean; sessions: Session[]; extra?: boolean }): Mode {
  const waiting = o.sessions.some(s => s.ask)
  if (o.tucked && !waiting) return 'tucked' // a question always brings the island back
  if (o.open) return 'open'
  if (waiting) return 'ask'
  if (o.extra || o.sessions.some(s => s.status !== 'ready')) return 'medium' // extra: music, a focus timer, a drop
  return 'resting'
}

/** The tallest page; it fits the window (WINDOW_HEIGHT) with room for the floating offset and shadow. */
export const MAX_OPEN_HEIGHT = 420

/** contentHeight: the measured height of the ask card / open page. */
export function sizeFor(mode: Mode, island: Settings['island'], contentHeight: number): Rect {
  switch (mode) {
    case 'tucked': return { w: 120, h: 4, r: 2 }
    case 'resting': return { w: island.restingWidth, h: island.restingHeight, r: island.restingHeight / 2 }
    case 'medium': return { w: island.width, h: island.height, r: island.height / 2 }
    case 'ask': return { w: island.askWidth, h: Math.max(island.height, contentHeight), r: 22 }
    case 'open': return { w: island.openWidth, h: Math.min(MAX_OPEN_HEIGHT, Math.max(120, contentHeight)), r: 30 }
  }
}
