// The extras next to the agents: music + lyrics, the file shelf, clipboard, notes, focus timer, PC stats, radios,
// phone drop. Main keeps them (app/main/extras); the island shows them and sends Actions back.

export interface Media {
  app: string
  title: string
  artist: string
  album: string
  playing: boolean
  positionMs: number
  durationMs: number
  /** when positionMs was measured (ms since 1970): the island moves the position on from there while playing */
  updatedAt: number
  canSeek: boolean
  canNext: boolean
  canPrevious: boolean
}

export interface LyricLine { t: number; text: string }

export interface ShelfFile {
  path: string
  name: string
  /** a data: URL: a thumbnail for images, else the file's icon */
  icon: string
  size: number
  addedAt: number
}

export interface ClipItem { id: number; text: string; at: number }
export interface Note { id: string; text: string; at: number }

export interface FocusTimer {
  /** total length, s */
  seconds: number
  /** running: when it ends (ms since 1970) */
  endsAt?: number
  /** paused: what was left, s */
  left?: number
}

export interface Drop {
  /** the address the phone opens (in the QR code) */
  url: string
  /** a QR code of url, as an SVG data: URL */
  qr: string
  /** the phone opened the page */
  connected: boolean
  /** why a phone may not get through: the network is set to Public, or the firewall has no rule for Pebble */
  blocked?: 'public' | 'firewall'
  /** files received from the phone this time */
  received: number
  expiresAt: number
}

export interface ExtrasState {
  media: Media | null
  /** the album art of media, as a data: URL */
  art: string | null
  /** timed lyrics of the song (null: none found or lyrics off) */
  lyrics: LyricLine[] | null
  shelf: ShelfFile[]
  clipboard: ClipItem[]
  notes: Note[]
  focus: FocusTimer | null
  /** 0–100 */
  system: { cpu: number; ram: number }
  radios: { wifi?: boolean; bluetooth?: boolean } | null
  drop: Drop | null
}

/** Everything the island can ask main to do with the extras (validated in main). */
export type Action =
  | { do: 'media'; action: 'toggle' | 'next' | 'previous' | 'seek'; positionMs?: number }
  | { do: 'volume'; volume: number }
  | { do: 'shelf.add'; paths: string[] }
  | { do: 'shelf.open' | 'shelf.reveal' | 'shelf.remove' | 'shelf.drag'; path: string }
  | { do: 'shelf.clear' }
  | { do: 'clip.copy'; id: number }
  | { do: 'clip.clear' }
  | { do: 'notes.save'; notes: Note[] }
  | { do: 'focus.start'; seconds: number }
  | { do: 'focus.pause' | 'focus.resume' | 'focus.stop' }
  | { do: 'radio'; kind: 'wifi' | 'bluetooth'; on: boolean }
  | { do: 'open'; what: 'wifi' | 'bluetooth' }
  | { do: 'drop.start' | 'drop.stop' | 'drop.allow' | 'drop.network' }
  | { do: 'settings.open' }
  | { do: 'chat.send'; text: string }
  | { do: 'chat.signIn' }
  | { do: 'chat.stop' | 'chat.clear' | 'chat.windows' | 'chat.dictate' }
  | { do: 'chat.look'; hwnd: number }
  | { do: 'chat.say'; at: number | null }
  | { do: 'word.check' | 'word.close' }
  | { do: 'word.apply'; picks: number[] }
  | { do: 'widget.open'; plugin: string; id: string }

/** The lyric line sung at positionMs (index into lines), or -1 before the first. */
export function lyricIndex(lines: LyricLine[], positionMs: number): number {
  let lo = 0, hi = lines.length - 1, found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid]!.t <= positionMs) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found
}

/** Where the song is now: the last measured position, moved on by the time since (while playing). */
export function positionNow(m: Media, now: number): number {
  return Math.min(m.durationMs || Infinity, m.positionMs + (m.playing ? Math.max(0, now - m.updatedAt) : 0))
}

/** Seconds left on the focus timer (0 when done). */
export function focusLeft(f: FocusTimer, now: number): number {
  if (f.left !== undefined) return f.left
  return Math.max(0, Math.round(((f.endsAt ?? now) - now) / 1000))
}
