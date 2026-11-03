import { execFile } from 'node:child_process'
import os from 'node:os'

export interface Check { name: string; ok: boolean; detail?: string }

export interface DiagnosticsInput {
  version: string
  port: number
  nativeExe: string
  agents: { name: string; available: boolean; connected: boolean }[]
  connectors: { name: string; enabled: boolean; running: boolean; problem?: string }[]
  chat: { provider: string; ready: boolean }
  /** when the browser extension last reported (0: never) */
  extensionSeen: number
  /** CLIs the chat can use: is the command on PATH? */
  cli: string[]
}

const run = (file: string, args: string[], timeout = 20000) => new Promise<{ code: number; out: string }>(resolve =>
  execFile(file, args, { timeout, windowsHide: true }, (err, out) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(out) })))

/** Settings → Advanced → Diagnostics: every part of Pebble, checked on this PC. Changes nothing, sends nothing. */
export async function diagnose(i: DiagnosticsInput): Promise<Check[]> {
  const checks: Check[] = [{ name: `Pebble ${i.version}`, ok: true, detail: `Electron ${process.versions.electron}, Windows ${os.release()}` }]

  // the agents' server: answers 403 to a request without the token
  const server = await fetch(`http://127.0.0.1:${i.port}/`, { signal: AbortSignal.timeout(3000) }).then(r => r.status).catch(() => 0)
  checks.push({ name: 'Agent server', ok: server === 403, detail: server ? `port ${i.port}` : `nothing answers on port ${i.port}` })

  const self = await run(i.nativeExe, ['selftest'])
  try {
    const r = JSON.parse(self.out) as { checks: Check[] }
    for (const c of r.checks) checks.push({ name: `Native: ${c.name}`, ok: c.ok, detail: c.detail })
  } catch { checks.push({ name: 'Native helper', ok: false, detail: self.out.trim().slice(0, 200) || `not found: ${i.nativeExe}` }) }

  for (const a of i.agents) if (a.available || a.connected) checks.push({ name: a.name, ok: a.connected, detail: a.connected ? 'connected' : 'found, not connected' })
  for (const c of i.connectors) if (c.enabled) checks.push({ name: `Connector: ${c.name}`, ok: c.running && !c.problem, detail: c.problem ?? (c.running ? 'running' : 'stopped') })

  checks.push({ name: `Chat: ${i.chat.provider}`, ok: i.chat.ready, detail: i.chat.ready ? undefined : 'needs a key (Settings → Pip\'s chat)' })
  for (const cmd of i.cli) {
    const where = await run('where.exe', [cmd], 5000)
    checks.push({ name: `Chat: ${cmd} command`, ok: where.code === 0, detail: where.out.trim().split('\n')[0] || 'not on PATH' })
  }
  checks.push({ name: 'Browser extension', ok: i.extensionSeen > 0, detail: i.extensionSeen ? `last heard ${Math.round((Date.now() - i.extensionSeen) / 1000)} s ago` : 'not paired, or no chat tab open' })
  return checks
}

/** The report as text, for pasting into an issue. */
export const report = (checks: Check[]) => checks.map(c => `${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`).join('\n')
