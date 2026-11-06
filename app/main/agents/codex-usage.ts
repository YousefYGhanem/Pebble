import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Usage } from '../../shared/ipc'

// Codex's plan usage: every session file (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl) records "token_count" events
// with the account's rate limits, a 5-hour window and a weekly one (used_percent 0–100, resets_at in seconds).
// The newest one is the current usage.

const SESSIONS = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions')
const TAIL = 512 * 1024

type Window = { used_percent?: number; window_minutes?: number; resets_at?: number; resets_in_seconds?: number }

/** The usage in the last token_count event of these JSON lines that has rate limits, or null. */
export function usageFromLines(text: string, now = Date.now()): Usage | null {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i]!.includes('"rate_limits"')) continue
    let o: any
    try { o = JSON.parse(lines[i]!) } catch { continue }
    const rl = (o.payload ?? o.msg ?? o)?.rate_limits
    if (!rl) continue
    const windows = [rl.primary, rl.secondary].filter((w: Window | undefined): w is Window => typeof w?.used_percent === 'number')
    const at = (w: Window) => (w.resets_at ? w.resets_at * 1000 : w.resets_in_seconds ? now + w.resets_in_seconds * 1000 : 0)
    // the 5-hour window is the shorter one; the weekly one is about 10 080 minutes
    const byLength = windows.sort((a, b) => (a.window_minutes ?? 0) - (b.window_minutes ?? 0))
    const short = byLength.find(w => (w.window_minutes ?? 300) < 1440), long = byLength.find(w => (w.window_minutes ?? 0) >= 1440)
    if (!short && !long) continue
    return {
      fiveHour: short && { used: short.used_percent!, resetsAt: at(short) },
      sevenDay: long && { used: long.used_percent!, resetsAt: at(long) }
    }
  }
  return null
}

/** The newest session file (the last few days' folders), or null. */
function newest(): string | null {
  let best: { f: string; t: number } | null = null
  const day = (d: Date) => path.join(SESSIONS, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'))
  for (let i = 0; i < 8; i++) {
    const dir = day(new Date(Date.now() - i * 86400e3))
    let names: string[] = []
    try { names = fs.readdirSync(dir) } catch { continue }
    for (const n of names) if (n.endsWith('.jsonl')) {
      const f = path.join(dir, n)
      try { const t = fs.statSync(f).mtimeMs; if (!best || t > best.t) best = { f, t } } catch {}
    }
    if (best) break // the newest day with sessions
  }
  return best?.f ?? null
}

/** Codex's current plan usage, from its newest session file. */
export function readCodexUsage(): Usage | null {
  const f = newest()
  if (!f) return null
  try {
    const fd = fs.openSync(f, 'r')
    try {
      const size = fs.fstatSync(fd).size, start = Math.max(0, size - TAIL), buf = Buffer.alloc(size - start)
      fs.readSync(fd, buf, 0, buf.length, start)
      return usageFromLines(buf.toString('utf8'))
    } finally { fs.closeSync(fd) }
  } catch { return null }
}
