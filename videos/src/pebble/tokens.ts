// Pebble's look, as hex for anything that animates. Sources: themes/default.json (the island), site/src/global.css (the
// night around it), app/renderer/island/spring.ts (the island's motion), and pixels measured from the captures
// (scripts/sample-ui.cjs): the island's fill runs from #1d1d22 at its top edge to the theme background by ~35 px.
import type { SpringConfig } from '../kit/spring'

export const T = {
  night: '#08070d', // the site's page
  island: '#0d0d12', // themes/default.json background
  islandTop: '#1d1d22', // measured, the top edge of every capture
  rim: 'rgba(255, 255, 255, 0.14)',
  text: '#f4f4f6',
  muted: '#9b99ab',
  accent: '#7c5cff',
  lavender: '#b9a8ff',
  cyan: '#53e4ff',
  running: '#3b82f6',
  done: '#22c55e',
  question: '#f59e0b',
  love: '#ff5c8a',
  pipBody: '#ece9f6', // app/shared/pip.ts pipColors default
  pipVisor: '#15151c',
} as const

/** The island's springs (app/renderer/island/spring.ts): growing 0.42 s, damping 0.86; shrinking 0.34 s, damping 1. */
const fromResponse = (response: number, damping: number): SpringConfig => ({ stiffness: (2 * Math.PI / response) ** 2, damping: 4 * Math.PI * damping / response })
export const GROW = fromResponse(0.42, 0.86)
export const SHRINK = fromResponse(0.34, 1)

export const FONT = "'Segoe UI Variable Display', 'Segoe UI Variable', 'Segoe UI', sans-serif"
export const FONT_TEXT = "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', sans-serif"
export const FONT_AR = "'Segoe UI', Tahoma, sans-serif"

/** Pip's eyes take the colour of what goes on (site/src/components/PipCanvas.svelte) */
export const EYES = {
  idle: T.cyan, curious: T.cyan, sleepy: T.cyan, dizzy: T.cyan, focused: T.running, alert: T.question,
  grumpy: T.question, happy: T.done, love: T.love, dancing: T.lavender, sad: '#ef4444',
} as const
