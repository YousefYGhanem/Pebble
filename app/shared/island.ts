import type { Settings } from './settings'

// The island window never resizes (resizing a window every frame stutters on Windows). It is one fixed, see-through
// area at the top of the screen; the island is drawn inside it and only the island itself catches the mouse.

/** Room around the biggest island: the split pill on the left, the shadow and jelly overshoot. */
export const MARGIN = 72
export const WINDOW_HEIGHT = 480
export const windowWidth = (island: Settings['island']) => Math.max(island.openWidth, island.askWidth, island.width) + 2 * MARGIN

/** Demo scenes for test mode (tray → Test mode): every state without a real session. */
export const SCENES = {
  resting: 'Resting',
  working: 'Working',
  ask: 'Asks permission',
  question: 'Asks a question',
  plan: 'Has a plan',
  reply: 'Done, waits for a reply',
  done: 'Done',
  error: 'Error',
  open: 'Open page',
  split: 'Split pill',
  tucked: 'Tucked',
  'pip-curious': 'Pip: curious',
  'pip-focused': 'Pip: focused',
  'pip-alert': 'Pip: asks you',
  'pip-happy': 'Pip: happy (+ confetti)',
  'pip-love': 'Pip: love (+ hearts)',
  'pip-sleepy': 'Pip: sleepy',
  'pip-dizzy': 'Pip: dizzy',
  'pip-grumpy': 'Pip: grumpy',
  'pip-dancing': 'Pip: dancing',
  'pip-sad': 'Pip: sad (error)',
  music: 'Music playing (wave + lyrics)',
  'music-agent': 'Music + an agent working (split)',
  focus: 'Focus timer running',
  drop: 'A file dragged over the island',
  'page-home': 'Page: Home',
  'page-music': 'Page: Music',
  'page-files': 'Page: Files',
  'page-phone': 'Page: Files → phone drop',
  'page-clipboard': 'Page: Clipboard',
  'page-notes': 'Page: Notes',
  'page-focus': 'Page: Focus',
  'page-widgets': 'Page: Widgets (connectors)',
  activity: 'A live activity (score)',
  hello: 'Hello (startup)',
  bye: 'Goodbye (without quitting)',
  jelly: 'Jelly kick'
} as const
export type Scene = keyof typeof SCENES
