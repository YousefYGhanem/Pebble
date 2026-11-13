import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Usage } from '../../shared/ipc'

// Claude's plan usage straight from Anthropic, with the sign-in Claude Code keeps on this PC (~/.claude/.credentials.json).
// The status line only reports usage from terminal sessions; this works for the Claude app's sessions too.
// Read-only: Pebble never refreshes or writes the sign-in (Claude Code does that when it runs in a terminal), so an
// expired sign-in is reported as such. The token goes only to api.anthropic.com. The address is not a published API: if
// it changes, Pebble falls back to the status line.

const URL = 'https://api.anthropic.com/api/oauth/usage'

interface Window { utilization?: number | null; resets_at?: string | null }
const NAMES: Record<string, string> = { opus: 'Opus', sonnet: 'Sonnet', oauth_apps: 'Apps' }

/** Anthropic's answer → Pebble's usage: the 5-hour session, the week, and any other weekly limit (Opus, Sonnet…). */
export function parsePlanUsage(j: Record<string, unknown>): Usage | null {
  const win = (w: unknown) => {
    const x = w as Window | null | undefined
    return x && typeof x.utilization === 'number' ? { used: x.utilization, resetsAt: x.resets_at ? Date.parse(x.resets_at) || 0 : 0 } : undefined
  }
  const fiveHour = win(j.five_hour), sevenDay = win(j.seven_day)
  const extra = Object.entries(j)
    .filter(([k]) => /^seven_day_\w+$/.test(k))
    .flatMap(([k, v]) => { const w = win(v); const name = k.slice('seven_day_'.length); return w ? [{ name: NAMES[name] ?? name, ...w }] : [] })
  if (!fiveHour && !sevenDay && !extra.length) return null
  return { fiveHour, sevenDay, ...(extra.length ? { extra } : {}) }
}

export type PlanUsage = { usage: Usage } | { problem: 'none' | 'expired' | 'failed' }

/** The plan usage now, or why there is none (no sign-in here, an expired one, or Anthropic did not answer). */
export async function fetchPlanUsage(file = path.join(os.homedir(), '.claude', '.credentials.json')): Promise<PlanUsage> {
  let token: string | undefined, expiresAt: number | undefined
  try {
    const o = JSON.parse(fs.readFileSync(file, 'utf8'))?.claudeAiOauth
    token = typeof o?.accessToken === 'string' ? o.accessToken : undefined
    expiresAt = typeof o?.expiresAt === 'number' ? o.expiresAt : undefined
  } catch { return { problem: 'none' } }
  if (!token) return { problem: 'none' }
  if (expiresAt && expiresAt < Date.now()) return { problem: 'expired' }
  try {
    const r = await fetch(URL, { headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'Pebble' }, signal: AbortSignal.timeout(10_000) })
    if (r.status === 401) return { problem: 'expired' }
    if (!r.ok) return { problem: 'failed' }
    const usage = parsePlanUsage(await r.json() as Record<string, unknown>)
    return usage ? { usage } : { problem: 'failed' }
  } catch { return { problem: 'failed' } }
}
