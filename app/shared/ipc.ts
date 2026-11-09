import type { Agent, Session } from './state'
import type { Days } from './today'
import type { Settings, Theme } from './settings'
import type { Scene } from './island'
import type { Action, ExtrasState } from './extras'
import type { ConnectorInfo, Widget } from './connectors'
import type { ChatState } from './chat'

// The contract between the island window and the main process. Channel names live here only.
export const CH = {
  ready: 'island:ready',
  state: 'island:state',
  expand: 'island:expand',
  toggle: 'island:toggle',
  tuck: 'island:tuck',
  scene: 'island:scene',
  bye: 'island:bye',
  byeDone: 'island:bye-done',
  catchMouse: 'island:catch-mouse',
  answer: 'island:answer',
  reply: 'island:reply',
  jump: 'island:jump',
  seen: 'island:seen',
  dismiss: 'island:dismiss',
  act: 'island:act',
  peak: 'island:peak',
  page: 'island:page',
  play: 'island:play',
  worry: 'island:worry',
  tucked: 'island:tucked',
  release: 'island:release',
  opened: 'island:opened',
  peek: 'island:peek'
} as const

/** Your decision on what a session asks. */
export type Answer =
  | { kind: 'permission'; choice: 'allow' | 'always' | 'deny' }
  | { kind: 'question'; answers: Record<string, string> }
  | { kind: 'plan'; approve: boolean; feedback?: string }

/**
 * A CLI's usage, account-wide. Plans with limits (Claude Code, Codex): the 5-hour session window and the week, used
 * 0–100. Pay-as-you-go (DeepSeek Harness): tokens of the current session and of the last 7 days.
 */
export interface Usage {
  fiveHour?: { used: number; resetsAt: number }
  sevenDay?: { used: number; resetsAt: number }
  tokens?: { session: number; week: number }
  at?: number
}

/** One finished turn, kept on this PC (last 40). */
export interface HistoryItem {
  at: number
  agent: Agent
  project: string
  cwd?: string
  prompt: string
  result: string
  files: number
  seconds: number
}

/** Pip's side of the state: earned things, your own outfits, and what the PC is doing. */
export interface PipState {
  done: number
  achievements: string[]
  /** your own outfits (outfits folder): id = file name without .svg, data = a data: URL */
  custom: { id: string; data: string }[]
  /** no keyboard or mouse for settings.pip.sleepAfterMinutes */
  sleepy: boolean
  /** music plays on this PC (Pip dances) */
  playing: boolean
}

export interface IslandState {
  sessions: Session[]
  settings: Settings
  theme: Theme
  /** by agent: claude, codex, dsh */
  usage: Partial<Record<Agent, Usage>>
  history: HistoryItem[]
  pip: PipState
  extras: ExtrasState
  widgets: Widget[]
  connectors: ConnectorInfo[]
  chat: ChatState
  /** what your agents did today and yesterday (the Home page's summary) */
  day: Days
}

/** What window.pebble offers the island renderer (app/preload/island.ts). */
export interface IslandApi {
  /** the page (re)loaded: send the current state now */
  ready(): void
  onState(fn: (s: IslandState) => void): void
  /** open the island, optionally on one session (a toast was clicked) */
  onExpand(fn: (sessionId?: string) => void): void
  /** open ↔ closed */
  onToggle(fn: () => void): void
  /** tucked ↔ back */
  onTuck(fn: () => void): void
  /** test mode: play a demo scene, or null to go back to the real sessions */
  onScene(fn: (scene: Scene | null) => void): void
  /** quitting: play goodbye, then call byeDone() */
  onBye(fn: () => void): void
  byeDone(): void
  /** true while the mouse is on the island: the window catches clicks; otherwise they go through */
  catchMouse(on: boolean): void
  answer(sessionId: string, answer: Answer): void
  reply(sessionId: string, text: string): void
  /** bring the terminal / editor that runs this session to the front */
  jump(sessionId: string): void
  /** you looked at these sessions (done fades after this) */
  seen(sessionIds: string[]): void
  dismiss(sessionId: string): void
  /** music, files, clipboard, notes, focus, radios, phone drop */
  act(action: Action): void
  /** the sound level, ~30 a second while music plays */
  onPeak(fn: (level: number) => void): void
  /** open on a page; listen: start voice typing in its message box */
  onPage(fn: (page: string, listen: boolean) => void): void
  /** play a sound (a data: URL), or stop with null */
  onPlay(fn: (url: string | null) => void): void
  /** a question during a full-screen game: show it as the tucked line (true), or that is over (false) */
  onPeek(fn: (on: boolean) => void): void
  /** the island opened (true) or closed: the welcome tour ticks off what you tried */
  opened(on: boolean): void
  /** Esc or closing by shortcut: give the keyboard back to the app that had it */
  release(): void
  /** the island is tucked away (true) or back: main lets every service rest meanwhile */
  tucked(on: boolean): void
  /** a usage limit is near: Pip looks worried */
  onWorry(fn: () => void): void
  /** where dropped files are on disk */
  pathsOf(files: File[]): string[]
}
