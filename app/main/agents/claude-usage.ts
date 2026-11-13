import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Usage } from '../../shared/ipc'

// Claude's plan usage straight from Anthropic, with the sign-in Claude Code keeps on this PC (~/.claude/.credentials.json).
// The status line only reports usage from terminal sessions; this works for the Claude app's sessions too.
// An expired sign-in is renewed the way Claude Code does it (its refresh token, Claude Code's own public client id), and the
// new tokens go back into the same file at once, every other field kept: Claude Code then simply finds a fresh sign-in.
// The tokens go only to Anthropic. These addresses are not a published API: if they change, Pebble says the sign-in
// expired and falls back to the status line.

const URL = 'https://api.anthropic.com/api/oauth/usage'
const TOKEN_URLS = ['https://console.anthropic.com/v1/oauth/token', 'https://platform.claude.com/v1/oauth/token']
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e' // Claude Code's public OAuth client

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

/**
 * Renews the sign-in in `file` with its refresh token; true when the file now holds a fresh one. The file is written
 * atomically (a temporary file, then a rename) with every other field as it was; nothing is written unless Anthropic
 * gave new tokens. post: the network (tests pass their own).
 */
export async function renewSignIn(file: string, post: typeof fetch = fetch): Promise<boolean> {
  let all: Record<string, unknown>
  try { all = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return false }
  const o = all.claudeAiOauth as Record<string, unknown> | undefined
  if (typeof o?.refreshToken !== 'string') return false
  if (typeof o.refreshTokenExpiresAt === 'number' && o.refreshTokenExpiresAt < Date.now()) return false
  for (const url of TOKEN_URLS) {
    let r: Response
    try {
      r = await post(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Pebble' }, signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: o.refreshToken, client_id: CLIENT_ID }) })
    } catch { continue }
    if (r.status === 404) continue // the other address
    if (!r.ok) return false
    const j = await r.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number } | null
    if (!j?.access_token) return false
    // the file as it is now (Claude Code may have written in the meantime): only the sign-in's tokens change
    let now: Record<string, unknown>
    try { now = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { now = all }
    now.claudeAiOauth = { ...(now.claudeAiOauth as object), accessToken: j.access_token, ...(j.refresh_token ? { refreshToken: j.refresh_token } : {}),
      expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 }
    const tmp = `${file}.pebble-tmp`
    fs.writeFileSync(tmp, JSON.stringify(now), { mode: 0o600 })
    fs.renameSync(tmp, file)
    return true
  }
  return false
}

/** The plan usage now, or why there is none (no sign-in here, an expired one, or Anthropic did not answer). */
export async function fetchPlanUsage(file = path.join(os.homedir(), '.claude', '.credentials.json'), renewing = false): Promise<PlanUsage> {
  let token: string | undefined, expiresAt: number | undefined
  try {
    const o = JSON.parse(fs.readFileSync(file, 'utf8'))?.claudeAiOauth
    token = typeof o?.accessToken === 'string' ? o.accessToken : undefined
    expiresAt = typeof o?.expiresAt === 'number' ? o.expiresAt : undefined
  } catch { return { problem: 'none' } }
  if (!token) return { problem: 'none' }
  // expired (or nearly): renewed here, then read again
  if (expiresAt && expiresAt < Date.now() + 60_000) return renewing ? { problem: 'expired' } : (await renewSignIn(file)) ? fetchPlanUsage(file, true) : { problem: 'expired' }
  try {
    const r = await fetch(URL, { headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'Pebble' }, signal: AbortSignal.timeout(10_000) })
    if (r.status === 401) return { problem: 'expired' }
    if (!r.ok) return { problem: 'failed' }
    const usage = parsePlanUsage(await r.json() as Record<string, unknown>)
    return usage ? { usage } : { problem: 'failed' }
  } catch { return { problem: 'failed' } }
}
