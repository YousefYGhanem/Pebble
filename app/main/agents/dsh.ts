import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import type { HookEvent } from '../../shared/state'
import type { Usage } from '../../shared/ipc'
import { logger } from '../log'

const log = logger('dsh')

// DeepSeek Harness has no hooks to install: it writes every session as a log, ~/.dsh/sessions/<project>/<session>/
// session.v4.jsonl.zstd (JSON lines, appended as separate zstd frames). Pebble reads what is added and turns its events
// into the same events as the other agents, so the island follows it like Claude Code. Nothing is written there.

export const SESSIONS = path.join(os.homedir(), '.dsh', 'sessions')
export const available = () => fs.existsSync(path.dirname(SESSIONS))

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const WEEK = 7 * 24 * 3600e3

/** The JSON events in a stretch of the log, and how far they reach (a frame still being written waits for next time). */
export function readFrames(buf: Buffer, from = 0): { events: Record<string, any>[]; next: number } {
  const events: Record<string, any>[] = []
  let at = buf.indexOf(MAGIC, from)
  while (at >= 0 && at < buf.length) {
    // the magic number can also occur inside compressed data: try each next one until the frame decodes
    let end = buf.indexOf(MAGIC, at + 4), text: string | null = null
    for (;;) {
      try { text = zlib.zstdDecompressSync(buf.subarray(at, end < 0 ? buf.length : end)).toString('utf8'); break } catch {}
      if (end < 0) break
      end = buf.indexOf(MAGIC, end + 4)
    }
    if (text === null) break // the last frame is incomplete
    for (const line of text.split('\n')) if (line.trim()) try { events.push(JSON.parse(line)) } catch {}
    at = end < 0 ? buf.length : end
  }
  return { events, next: Math.max(from, at < 0 ? buf.length : at) }
}

const textOf = (content: unknown) => Array.isArray(content)
  ? content.filter((c: any) => c?.type === 'text' && typeof c.text === 'string').map((c: any) => c.text).join('\n').trim() : ''

interface Log { offset: number; id: string; cwd?: string; answer: string; tokens: { time: number; n: number }[] }

/** One session log's events → hook events (the shape apply() takes), and tokens used. */
export function toHookEvents(events: Record<string, any>[], s: Log): HookEvent[] {
  const out: HookEvent[] = []
  const e = (name: string, extra: Partial<HookEvent> = {}) => out.push({ session_id: s.id, hook_event_name: name, cwd: s.cwd, ...extra })
  for (const ev of events) {
    const d = ev.data ?? {}
    switch (ev.type) {
      case 'session': s.id = ev.id ?? s.id; s.cwd = ev.cwd; e('SessionStart'); break
      case 'user/message': if (d.source?.kind === 'user') { const prompt = textOf(d.content); if (prompt) e('UserPromptSubmit', { prompt }) } break
      case 'tool/ptc-dispatch-start': e('PreToolUse', { tool_name: d.name, tool_input: d.arguments ?? {} }); break
      case 'tool/call': if (d.name !== 'run_code') { let input = {}; try { input = JSON.parse(d.arguments) } catch {} e('PreToolUse', { tool_name: d.name, tool_input: input }) } break
      case 'tool/ptc-dispatch': case 'tool/result': e(d.isError ?? d.message?.isError ? 'PostToolUseFailure' : 'PostToolUse'); break
      case 'approval/asked': e('PermissionRequest', { tool_name: d.toolName, tool_input: {} }); break
      case 'approval/decided': e('PostToolUse'); break
      case 'assistant/message': {
        const text = textOf(d.message?.content)
        if (text) s.answer = text
        const n = d.usage?.totalTokens
        if (typeof n === 'number') s.tokens.push({ time: ev.time ?? Date.now(), n })
        break
      }
      case 'turn/end':
        if (d.reason?.kind === 'error') e('StopFailure', { error: String(d.reason.error?.message ?? 'Stopped with an error').slice(0, 200) })
        else e('Stop', { last_assistant_message: s.answer })
        break
    }
  }
  return out
}

/** Follows DeepSeek Harness's session logs while it is switched on (Settings → Agents). */
export class DshWatch {
  private logs = new Map<string, Log>()
  private watcher?: fs.FSWatcher
  private timer?: NodeJS.Timeout
  private pending = new Set<string>()

  constructor(private o: { event(e: HookEvent): void; usage(u: Usage): void }) {}

  get on() { return !!this.watcher }

  start() {
    if (this.watcher || !fs.existsSync(SESSIONS)) return
    // what is there already counts for the week's tokens, but is not replayed as live sessions
    for (const file of this.files()) {
      const log = this.open(file)
      try { const buf = fs.readFileSync(file); const r = readFrames(buf); toHookEvents(r.events, log); log.offset = r.next } catch {}
    }
    this.report()
    this.watcher = fs.watch(SESSIONS, { recursive: true }, (_e, name) => {
      if (!name?.endsWith('.jsonl.zstd')) return
      this.pending.add(path.join(SESSIONS, name))
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.flush(), 150) // a burst of writes is read once
    })
    log.info('following DeepSeek Harness sessions')
  }

  stop() {
    this.watcher?.close()
    this.watcher = undefined
    clearTimeout(this.timer)
  }

  private files(): string[] {
    const recent = Date.now() - WEEK
    const out: string[] = []
    for (const project of safeDir(SESSIONS)) for (const session of safeDir(path.join(SESSIONS, project))) {
      const f = path.join(SESSIONS, project, session, 'session.v4.jsonl.zstd')
      try { if (fs.statSync(f).mtimeMs > recent) out.push(f) } catch {}
    }
    return out
  }

  private open(file: string): Log {
    let log = this.logs.get(file)
    if (!log) this.logs.set(file, (log = { offset: 0, id: `dsh-${path.basename(path.dirname(file))}`, answer: '', tokens: [] }))
    return log
  }

  private flush() {
    for (const file of this.pending) {
      const log = this.open(file)
      try {
        const buf = fs.readFileSync(file)
        if (buf.length < log.offset) log.offset = 0 // the log was rewritten
        const r = readFrames(buf, log.offset)
        log.offset = r.next
        for (const e of toHookEvents(r.events, log)) this.o.event(e)
      } catch (err) { logWarn(file, err) }
    }
    this.pending.clear()
    this.report()
  }

  /** Tokens of the session used last, and of the last 7 days. */
  private report() {
    const since = Date.now() - WEEK
    let week = 0, latest: Log | undefined, latestAt = 0
    for (const l of this.logs.values()) {
      for (const t of l.tokens) if (t.time > since) week += t.n
      const last = l.tokens.at(-1)?.time ?? 0
      if (last > latestAt) { latestAt = last; latest = l }
    }
    if (latest) this.o.usage({ tokens: { session: latest.tokens.reduce((a, t) => a + t.n, 0), week } })
  }
}

/** The one watch main made (the agents' list switches it on and off). */
export let current: DshWatch | undefined
export const use = (w: DshWatch) => { current = w }

const safeDir = (dir: string) => { try { return fs.readdirSync(dir) } catch { return [] } }
const logWarn = (file: string, err: unknown) => log.warn(`${path.basename(path.dirname(file))}:`, (err as Error).message)
