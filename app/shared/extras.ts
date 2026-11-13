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

export interface ClipItem { id: number; text: string; at: number; pinned?: boolean; /** a copied picture: a small JPEG preview (the picture itself stays in main) */ image?: string; size?: string }
export interface Note { id: string; text: string; at: number }
/** A task: an optional time (a reminder on the island), done, and every day again if it repeats. */
export interface Todo { id: string; text: string; at: number; done: boolean; doneAt?: number; due?: number; daily?: boolean }

export interface FocusTimer {
  /** total length, s */
  seconds: number
  /** running: when it ends (ms since 1970) */
  endsAt?: number
  /** paused: what was left, s */
  left?: number
  /** a break between rounds (not counted, and the focus guard rests) */
  break?: boolean
}

/** The last focus timer that ran out (not stopped): what to offer next, and the rounds done today. */
export interface FocusDone { at: number; wasBreak: boolean; /** the length of the last round, s */ round: number; today: number; day: string }

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
  focusDone: FocusDone | null
  todos: Todo[]
  /** Windows' power mode (null: not available) */
  power: 'efficiency' | 'balanced' | 'performance' | null
  /** the game strip shows (a full-screen game, Settings → Island → Game strip) */
  strip: boolean
  /** the default microphone is muted (null: there is none) */
  mic: boolean | null
  /** 0–100 */
  system: { cpu: number; ram: number }
  radios: { wifi?: boolean; bluetooth?: boolean } | null
  drop: Drop | null
  /** the speakers' volume (0–100), as Windows has it: the Music page's slider follows it */
  volume: { level: number; muted: boolean } | null
}

/** Everything the island can ask main to do with the extras (validated in main). */
export type Action =
  | { do: 'media'; action: 'toggle' | 'next' | 'previous' | 'seek'; positionMs?: number }
  | { do: 'volume'; volume?: number; muted?: boolean }
  | { do: 'shelf.add'; paths: string[] }
  | { do: 'shelf.open' | 'shelf.reveal' | 'shelf.remove' | 'shelf.drag'; path: string }
  | { do: 'shelf.clear' }
  | { do: 'clip.copy'; id: number }
  | { do: 'clip.clear' }
  | { do: 'clip.remove'; id: number }
  | { do: 'clip.pin'; id: number }
  | { do: 'update.install' }
  | { do: 'focus.sound'; sound: 'off' | 'rain' | 'deep' | 'waves' }
  | { do: 'mic.toggle' }
  | { do: 'power'; mode: 'efficiency' | 'balanced' | 'performance' }
  | { do: 'pebble.sounds' }
  | { do: 'todo.add'; text: string; due?: number; daily?: boolean }
  | { do: 'todo.toggle' | 'todo.remove'; id: string }
  | { do: 'todo.snooze'; id: string; minutes: number }
  | { do: 'tip.seen'; id: 'ask' | 'tuck' | 'drop' }
  | { do: 'notes.save'; notes: Note[] }
  | { do: 'focus.start'; seconds: number; break?: boolean }
  | { do: 'focus.pause' | 'focus.resume' | 'focus.stop' }
  | { do: 'radio'; kind: 'wifi' | 'bluetooth'; on: boolean }
  | { do: 'open'; what: 'wifi' | 'bluetooth' }
  | { do: 'drop.start' | 'drop.stop' | 'drop.allow' | 'drop.network' }
  | { do: 'settings.open'; tab?: 'connectors' }
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

/**
 * Copied text that looks like a key, token or password (one word, long, of mixed letters and digits, or a known
 * prefix): the clipboard page shows only its ends.
 */
export function looksSecret(text: string): boolean {
  const s = text.trim()
  if (s.length < 16 || /\s/.test(s)) return false
  if (/^(sk-|sk_|pk_|rk_|ghp_|gho_|ghs_|github_pat_|glpat-|xox[abpr]-|AKIA|AIza|eyJ)/.test(s)) return true
  return s.length >= 24 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) && !/[\\:.]/.test(s) // not a path, an address or a file name
}

/** "sk-a…3f9c": the ends of a secret, the rest hidden */
export const maskSecret = (s: string) => `${s.trim().slice(0, 4)}••••••${s.trim().slice(-4)}`

/** A focus timer ran out: a round counts toward today (a break does not), and its length is offered again. */
export function focusFinished(prev: FocusDone | null, f: FocusTimer, now: number): FocusDone {
  const d = new Date(now), day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  const before = prev?.day === day ? prev.today : 0
  return { at: now, wasBreak: !!f.break, round: f.break ? (prev?.round ?? 25 * 60) : f.seconds, today: before + (f.break ? 0 : 1), day }
}

/** The clipboard list: pinned ones first and always kept, then the newest others up to max. */
export function trimClips(list: ClipItem[], max: number): ClipItem[] {
  return [...list.filter(c => c.pinned), ...list.filter(c => !c.pinned).slice(0, max)]
}

/** A short notice the island shows for a moment (a "peek"): something on the PC just changed. */
export type Notice =
  | { kind: 'device'; name: string }
  | { kind: 'caps'; on: boolean }
  | { kind: 'keyboard'; lang: string }
  | { kind: 'mute'; on: boolean }
  | { kind: 'mic'; on: boolean }
  | { kind: 'todo'; id: string; text: string }
  | { kind: 'usage'; agent: string; window: 'fiveHour' | 'sevenDay' | 'spend'; level: number; when: string }

export interface PcState { muted: boolean; device: string; mic: boolean | null; caps: boolean; keyboard: string }

/** What changed between two readings of the PC, as notices (the first reading is only the baseline). */
export function noticesFor(prev: PcState | null, now: PcState): Notice[] {
  if (!prev) return []
  const out: Notice[] = []
  if (now.device && prev.device && now.device !== prev.device) out.push({ kind: 'device', name: now.device })
  if (now.caps !== prev.caps) out.push({ kind: 'caps', on: now.caps })
  if (now.keyboard && prev.keyboard && now.keyboard !== prev.keyboard) out.push({ kind: 'keyboard', lang: now.keyboard })
  if (now.muted !== prev.muted) out.push({ kind: 'mute', on: now.muted })
  if (now.mic !== null && prev.mic !== null && now.mic !== prev.mic) out.push({ kind: 'mic', on: now.mic })
  return out
}

// ---------- tasks ----------

const dayOf = (t: number) => new Date(t).toDateString()

/** Ticked or unticked; a daily task ticked moves on to its next day (and is open again). */
export function toggleTodo(t: Todo, now: number): Todo {
  if (t.done) return { ...t, done: false, doneAt: undefined }
  if (t.daily && t.due) {
    let due = t.due
    while (due <= now) due += 86_400_000
    return { ...t, done: false, doneAt: now, due }
  }
  return { ...t, done: true, doneAt: now }
}

/** The next reminder to give: the earliest open task with a time (null: none). */
export const nextDue = (list: Todo[]) => list.filter(t => !t.done && t.due).sort((a, b) => a.due! - b.due!)[0] ?? null

/** Today's tasks: the ones due today or ticked today, and how many are done ("4/5 done today"). */
export function todayProgress(list: Todo[], now: number): { done: number; total: number } {
  const today = dayOf(now)
  const mine = list.filter(t => (t.due && dayOf(t.due) === today) || (t.doneAt && dayOf(t.doneAt) === today) || (!t.due && !t.done))
  return { done: mine.filter(t => t.doneAt && dayOf(t.doneAt) === today).length, total: mine.length }
}
