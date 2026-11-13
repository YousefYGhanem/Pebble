import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { apply, askOf, providerOf, type Agent, type HookEvent, type Session } from '../../shared/state'
import type { Answer, Usage } from '../../shared/ipc'
import { logger } from '../log'
import * as normalize from './normalize'
import { applyChat, asksYou, type ChatUpdate } from '../../shared/chatapps'

const log = logger('hub')
const PERMISSION_WAIT_S = 300
const REPLY_WAIT_S = 1800
const CLI_ASK_WAIT_S = 600
// the charset matters: some clients (Windows PowerShell 5.1, scripts people write) read JSON without it as Latin-1
/** Agents that post to /hook (?agent=…). */
const HOOK_AGENTS: Agent[] = ['claude', 'codex', 'gemini', 'cursor', 'opencode']
const JSON_TYPE = { 'Content-Type': 'application/json; charset=utf-8' }

/** A shared secret so only agents configured by Pebble can post to it. Kept in userData. */
export function loadToken(dir: string): string {
  const file = path.join(dir, 'hook-token')
  try { const t = fs.readFileSync(file, 'utf8').trim(); if (/^[a-f0-9]{48}$/.test(t)) return t } catch {}
  const fresh = randomBytes(24).toString('hex')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, fresh, { mode: 0o600 })
  return fresh
}

/** Line where text starts in file (1-based); 1 when the file is big, missing or does not contain it. */
export function findLine(file: string, text: string): number {
  try {
    if (fs.statSync(file).size > 1024 * 1024) return 1
    const body = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
    const i = body.indexOf(text.replace(/\r\n/g, '\n'))
    return i < 0 ? 1 : body.slice(0, i).split('\n').length
  } catch { return 1 }
}

interface Held { res: http.ServerResponse; agent: Agent; suggestions?: unknown[]; timer: NodeJS.Timeout }

/**
 * Local server for agent hooks (127.0.0.1 only, token required). Keeps the sessions and holds open:
 *  - PermissionRequest responses (also AskUserQuestion and ExitPlanMode) until you answer in the island, the terminal
 *    answers (the socket closes), or the wait runs out (no decision: the agent's own prompt decides);
 *  - reply waits from the Stop hook (pebble-reply), answered with the text you type after the agent stopped;
 *  - `pebble ask` from the CLI.
 * Emits 'change', 'question' (id), 'finished' (session), 'notify' ({title, body, id}), 'pid' (id, pid of the agent's process), 'usage' (agent, before, now).
 */
export class Hub extends EventEmitter {
  readonly sessions = new Map<string, Session>()
  /** each CLI's usage (see Usage); the status line fills Claude's, main the others */
  usage: Partial<Record<Agent, Usage>> = {}
  private held = new Map<string, Held>()
  private waits = new Map<string, http.ServerResponse>()
  private lastText = new Map<string, string>() // Cursor: its final text arrives before stop
  private server?: http.Server

  private chatReplies = new Map<string, (text: string) => void>() // chat apps: where your reply goes

  constructor(private token: string, private opts: {
    answerPermissions: () => boolean
    webhook?: (plugin: string, key: string, body: unknown) => boolean
    /** the browser extension (POST /ext, its own key): what it reports in, what to answer (null: wrong key) */
    extension?: (key: string, body: unknown) => unknown | null
  }) {
    super()
    // a closed terminal sends no SessionEnd: forget sessions that went quiet for 30 min
    setInterval(() => {
      const old = Date.now() - 30 * 60e3
      let gone = false
      for (const [id, s] of this.sessions) if (s.at < old && !this.held.has(id) && !this.waits.has(id)) { this.sessions.delete(id); gone = true }
      if (gone) this.emit('change')
    }, 60e3).unref()
  }

  list(): Session[] { return [...this.sessions.values()] }

  private patch(id: string, p: Partial<Session>) {
    const s = this.sessions.get(id)
    if (s) this.sessions.set(id, { ...s, ...p })
    this.emit('change')
  }

  // ---------- answers from the island ----------

  /** Sends your decision to the waiting agent. false when nothing waits any more (answered in the terminal). */
  answer(id: string, a: Answer): boolean {
    const h = this.held.get(id), s = this.sessions.get(id)
    if (!h || !s?.ask) return false
    if (h.agent === 'cli') {
      const answer = a.kind === 'question' ? Object.values(a.answers).join(', ') : ''
      this.release(id, { answer })
      this.sessions.delete(id)
      this.emit('change')
      return true
    }
    const input = s.ask.input
    let decision: Record<string, unknown>
    if (a.kind === 'permission') {
      decision = a.choice === 'deny' ? { behavior: 'deny', message: 'Denied from Pebble.' }
        : a.choice === 'always' && h.suggestions ? { behavior: 'allow', updatedPermissions: h.suggestions }
        : { behavior: 'allow' }
    } else if (a.kind === 'question') {
      decision = { behavior: 'allow', updatedInput: { ...input, answers: a.answers } }
    } else {
      decision = a.approve ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: a.feedback?.trim() || 'Not yet: keep planning.' }
    }
    this.release(id, { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } })
    this.patch(id, { status: 'running', ask: undefined })
    return true
  }

  /** Events Pebble reads itself (DeepSeek Harness's session logs) instead of receiving them on /hook. */
  ingest(e: HookEvent, agent: Agent) {
    const next = apply(this.sessions.get(e.session_id), e, agent, Date.now(), findLine)
    if (next) this.sessions.set(e.session_id, next)
    else this.sessions.delete(e.session_id)
    if (next && e.hook_event_name === 'Stop') this.emit('finished', next)
    if (next && e.hook_event_name === 'PermissionRequest') this.emit('question', e.session_id) // it asks in its own window
    this.emit('change')
  }

  /** A CLI's usage changed (Codex's session files, DeepSeek Harness's token counts). */
  setUsage(agent: Agent, u: Usage) {
    this.noteUsage(agent, u)
    this.emit('change')
  }

  /** Emits 'usage' (agent, before, now): alerts and the day's summary follow it. */
  private noteUsage(agent: Agent, u: Usage) {
    const prev = this.usage[agent]
    const known = Object.fromEntries(Object.entries(u).filter(([, v]) => v !== undefined)) as Usage
    this.usage[agent] = { ...prev, ...known, at: Date.now() }
    this.emit('usage', agent, prev, this.usage[agent])
  }

  // ---------- chat apps (browser tabs, desktop apps) ----------

  /** A chat app reported what it shows; onReply types your reply into it. */
  chatUpdate(id: string, u: ChatUpdate, onReply: (text: string) => void) {
    const { session, finished } = applyChat(this.sessions.get(id), id, u, Date.now())
    const before = JSON.stringify(this.sessions.get(id))
    this.sessions.set(id, session)
    this.chatReplies.set(id, onReply)
    if (finished) { this.emit('finished', session); if (asksYou(session.message ?? '')) this.emit('question', id) }
    if (JSON.stringify(session) !== before) this.emit('change')
  }

  chatEnd(id: string) {
    this.chatReplies.delete(id)
    if (this.sessions.delete(id)) this.emit('change')
  }

  /** Wakes a stopped agent with your text (through its waiting Stop hook), or sends it in a chat app. */
  reply(id: string, text: string): boolean {
    const chat = this.chatReplies.get(id)
    if (chat && text.trim()) { chat(text.trim()); this.patch(id, { prompt: text.trim(), detail: 'Sent: ' + text.trim().slice(0, 130) }); return true } // running once the app streams
    const res = this.waits.get(id)
    if (!res || !text.trim()) return false
    this.waits.delete(id)
    res.writeHead(200, JSON_TYPE).end(JSON.stringify({ reply: text.trim() }))
    const s = this.sessions.get(id)
    this.patch(id, { replyable: false, status: 'running', prompt: text.trim(), detail: text.trim().slice(0, 140), startedAt: Date.now(), steps: [], files: [], diff: undefined, message: undefined, seenAt: undefined })
    if (s) log.info(`reply sent to ${s.project}`)
    return true
  }

  seen(ids: string[]) {
    const now = Date.now()
    let changed = false
    for (const id of ids) {
      const s = this.sessions.get(id)
      if (s && !s.seenAt && s.status !== 'running') { this.sessions.set(id, { ...s, seenAt: now }); changed = true }
    }
    if (changed) this.emit('change')
  }

  dismiss(id: string) {
    const s = this.sessions.get(id)
    if (s && !s.ask) { this.sessions.delete(id); this.emit('change') }
  }

  /** On quit: release everything so no agent waits for nothing. */
  close() {
    for (const id of [...this.held.keys()]) this.release(id, {})
    for (const res of this.waits.values()) res.writeHead(200).end('{}')
    this.waits.clear()
    this.server?.close()
    this.server?.closeAllConnections()
  }

  private release(id: string, body: unknown) {
    const h = this.held.get(id)
    if (!h) return
    this.held.delete(id)
    clearTimeout(h.timer)
    h.res.writeHead(200, JSON_TYPE).end(JSON.stringify(body))
  }

  private endWait(id: string) {
    const res = this.waits.get(id)
    if (!res) return
    this.waits.delete(id)
    res.writeHead(200, JSON_TYPE).end('{}')
  }

  // ---------- server ----------

  listen(port: number): Promise<void> {
    const expected = Buffer.from(this.token)
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      // /in/<connector>?k=<key>: a connector's webhook inbox (Connectors → Webhook inbox); the key is its own check
      const inbox = /^\/in\/([a-z0-9][a-z0-9-]{0,40})$/.exec(url.pathname)
      if (inbox && req.method === 'POST' && this.opts.webhook) { this.handleInbox(inbox[1]!, url.searchParams.get('k') ?? '', req, res); return }
      if (url.pathname === '/ext' && req.method === 'POST' && this.opts.extension) { this.handleExtension(String(req.headers['x-pebble-ext'] ?? ''), req, res); return }
      const given = Buffer.from(String(req.headers['x-pebble-token'] ?? ''))
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) { res.writeHead(403).end(); return }
      if (req.method === 'GET' && url.pathname === '/wait') { this.handleWait(url.searchParams.get('session') ?? '', res); return }
      if (req.method !== 'POST') { res.writeHead(404).end(); return }
      let body = ''
      req.setEncoding('utf8')
      req.on('data', chunk => { body += chunk; if (body.length > 8e6) req.destroy() })
      req.on('end', () => {
        let data: Record<string, unknown>
        try { data = JSON.parse(body) } catch { res.writeHead(400).end(); return }
        if (!data || typeof data !== 'object') { res.writeHead(400).end(); return }
        switch (url.pathname) {
          case '/hook': {
            const agent = url.searchParams.get('agent') ?? 'claude'
            if (!HOOK_AGENTS.includes(agent as Agent)) { res.writeHead(400).end(); return }
            // the relay hook and the OpenCode plugin say which process runs the agent: main finds its window
            const sid = agent === 'cursor' ? data.conversation_id : data.session_id
            if (typeof data._pid === 'number' && Number.isSafeInteger(data._pid) && typeof sid === 'string') this.emit('pid', sid, data._pid)
            const e = agent === 'gemini' ? normalize.gemini(data) : agent === 'cursor' ? normalize.cursor(data, this.lastText) : (data as unknown as HookEvent)
            if (!e) { res.writeHead(200, JSON_TYPE).end('{}'); return }
            this.handleHook(e, agent as Agent, res)
            if (typeof data._model === 'string' && this.sessions.has(e.session_id)) this.patch(e.session_id, { model: data._model.slice(0, 80), provider: providerOf(data._model) })
            return
          }
          case '/status': return this.handleStatus(data, res)
          case '/window': return this.handleWindow(data, res)
          case '/notify': return this.handleNotify(data, res)
          case '/ask': return this.handleAsk(data, res)
          default: res.writeHead(404).end()
        }
      })
    })
    return new Promise((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(port, '127.0.0.1', () => { log.info(`listening on 127.0.0.1:${port}`); resolve() })
    })
  }

  private handleExtension(key: string, req: http.IncomingMessage, res: http.ServerResponse) {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy() })
    req.on('end', () => {
      let data: unknown
      try { data = JSON.parse(body) } catch { res.writeHead(400).end(); return }
      const answer = this.opts.extension!(key, data)
      if (answer === null) { res.writeHead(403).end(); return }
      res.writeHead(200, JSON_TYPE).end(JSON.stringify(answer ?? {}))
    })
  }

  private handleInbox(plugin: string, key: string, req: http.IncomingMessage, res: http.ServerResponse) {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy() })
    req.on('end', () => {
      let data: unknown = body
      try { data = JSON.parse(body) } catch {} // plain text is fine too
      res.writeHead(this.opts.webhook!(plugin, key, data) ? 200 : 404).end()
    })
  }

  private hold(id: string, res: http.ServerResponse, agent: Agent, seconds: number, suggestions?: unknown[]) {
    this.release(id, {}) // an older question for this session was answered elsewhere
    const timer = setTimeout(() => { this.release(id, {}); this.patch(id, { ask: undefined }) }, (seconds - 5) * 1000)
    this.held.set(id, { res, agent, suggestions, timer })
    res.on('close', () => {
      if (this.held.get(id)?.res !== res) return
      clearTimeout(timer)
      this.held.delete(id)
      if (agent === 'cli') this.sessions.delete(id)
      this.patch(id, { ask: undefined })
    })
  }

  private handleHook(e: HookEvent, agent: Agent, res: http.ServerResponse) {
    if (typeof e.session_id !== 'string' || typeof e.hook_event_name !== 'string') { res.writeHead(400).end(); return }
    const id = e.session_id
    const before = this.sessions.get(id)
    const next = apply(before, e, agent, Date.now(), findLine)
    if (next) this.sessions.set(id, next)
    else this.sessions.delete(id)

    // you typed in the terminal, or the session ended: the island's reply box is no longer needed
    if (e.hook_event_name === 'UserPromptSubmit' || e.hook_event_name === 'SessionEnd') this.endWait(id)
    // a finished tool means the permission was answered elsewhere (PreToolUse may run in parallel, so not that one)
    if (/^(PostToolUse|PostToolUseFailure|Stop|StopFailure|SessionEnd)$/.test(e.hook_event_name)) this.release(id, {})

    if (next && e.hook_event_name === 'Stop') this.emit('finished', next)

    if (next && e.hook_event_name === 'PermissionRequest' && agent === 'claude' && this.opts.answerPermissions()) {
      const suggestions = (e as { permission_suggestions?: unknown[] }).permission_suggestions
      this.sessions.set(id, { ...next, ask: askOf(e) })
      this.hold(id, res, agent, PERMISSION_WAIT_S, Array.isArray(suggestions) && suggestions.length ? suggestions : undefined)
      this.emit('question', id)
    } else {
      res.writeHead(200, JSON_TYPE).end('{}')
      // Gemini, OpenCode…: they ask in their own UI; Pebble tells you that they wait
      if (next && e.hook_event_name === 'PermissionRequest' && agent !== 'claude') this.emit('question', id)
    }
    this.emit('change')
  }

  /** Claude Code's status line: usage for the ring, context and model per session; answers with the line to print. */
  private handleStatus(d: Record<string, unknown>, res: http.ServerResponse) {
    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined)
    const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
    const rl = obj(d.rate_limits), five = obj(rl.five_hour), week = obj(rl.seven_day), spend = obj(rl.spend_limit)
    const window = (w: Record<string, unknown>) => num(w.used_percentage) === undefined ? undefined : { used: num(w.used_percentage)!, resetsAt: (num(w.resets_at) ?? 0) * 1000 }
    if (rl.five_hour || rl.seven_day || rl.spend_limit) {
      const sp = window(spend)
      this.noteUsage('claude', { fiveHour: window(five), sevenDay: window(week), spend: sp && { ...sp, usd: num(spend.used_usd), limitUsd: num(spend.limit_usd) } })
    }
    const model = typeof obj(d.model).display_name === 'string' ? String(obj(d.model).display_name) : undefined
    const context = num(obj(d.context_window).used_percentage)
    if (typeof d.session_id === 'string' && this.sessions.has(d.session_id)) this.patch(d.session_id, { model, context, provider: providerOf(model) })
    else this.emit('change')
    const parts = [model, context !== undefined ? `ctx ${Math.round(context)}%` : '', this.usage.claude?.fiveHour ? `5h ${Math.round(this.usage.claude.fiveHour.used)}%` : '']
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(parts.filter(Boolean).join(' · '))
  }

  private handleWindow(d: Record<string, unknown>, res: http.ServerResponse) {
    if (typeof d.session_id === 'string') this.attachWindow(d.session_id, d)
    res.writeHead(200).end('{}')
  }

  /** The window (and process chain) that runs a session: from Claude's window hook, or looked up by main for a pid. */
  attachWindow(id: string, d: Record<string, unknown>) {
    const int = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : undefined)
    const pid = int(d.pid)
    if (!pid) return
    const win: Partial<Session> = {
      windowPid: pid, windowHandle: int(d.hwnd),
      windowProcess: typeof d.process === 'string' ? d.process : undefined,
      pidChain: Array.isArray(d.chain) ? d.chain.map(int).filter((x): x is number => !!x).slice(0, 32) : undefined
    }
    if (this.sessions.has(id)) this.patch(id, win)
    else this.sessions.set(id, { id, agent: 'claude', project: 'Claude Code', status: 'ready', detail: '', steps: [], files: [], at: Date.now(), ...win })
  }

  private handleWait(id: string, res: http.ServerResponse) {
    if (!id) { res.writeHead(400).end(); return }
    this.endWait(id) // a newer Stop replaces the older wait
    this.waits.set(id, res)
    const timer = setTimeout(() => this.endWait(id), (REPLY_WAIT_S - 5) * 1000)
    res.on('close', () => {
      clearTimeout(timer)
      if (this.waits.get(id) !== res) return
      this.waits.delete(id)
      this.patch(id, { replyable: false })
    })
    this.patch(id, { replyable: true })
  }

  /** `pebble notify "Build done" --kind done|error|running --title CI` */
  private handleNotify(d: Record<string, unknown>, res: http.ServerResponse) {
    const text = typeof d.text === 'string' ? d.text.slice(0, 300) : ''
    if (!text) { res.writeHead(400).end(); return }
    const title = typeof d.title === 'string' && d.title ? d.title.slice(0, 60) : 'Pebble'
    const kind = d.kind === 'error' || d.kind === 'running' ? d.kind : 'done'
    const id = 'cli:' + title
    this.sessions.set(id, { id, agent: 'cli', project: title, status: kind, detail: text, message: text, steps: [], files: [], at: Date.now() })
    this.emit('notify', { id, title, body: text })
    this.emit('change')
    res.writeHead(200).end('{}')
  }

  /** `pebble ask "Ship it?" --options Yes,No`: waits for your answer and returns it. */
  private handleAsk(d: Record<string, unknown>, res: http.ServerResponse) {
    const question = typeof d.question === 'string' ? d.question.slice(0, 500) : ''
    if (!question) { res.writeHead(400).end(); return }
    const options = Array.isArray(d.options) ? d.options.filter((o): o is string => typeof o === 'string' && !!o).slice(0, 6) : []
    const title = typeof d.title === 'string' && d.title ? d.title.slice(0, 60) : 'Script'
    const id = 'cli-ask:' + randomBytes(4).toString('hex')
    const input = { questions: [{ question, options: options.map(label => ({ label })) }] }
    this.sessions.set(id, {
      id, agent: 'cli', project: title, status: 'question', detail: question, steps: [], files: [], at: Date.now(),
      ask: { kind: 'question', input, questions: [{ question, options: options.map(label => ({ label })) }] }
    })
    this.hold(id, res, 'cli', CLI_ASK_WAIT_S)
    this.emit('question', id)
    this.emit('change')
  }
}
