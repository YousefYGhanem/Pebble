import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Hub } from './agents/hub'
import { readChat } from '../shared/chatapps'
import { logger } from './log'

const log = logger('chatapps')

/** Sites the browser extension reads, by its content script's name for them. */
export const SITES: Record<string, string> = { claude: 'claude.ai', chatgpt: 'ChatGPT', gemini: 'Gemini', deepseek: 'DeepSeek' }
/** Desktop apps followed through UI Automation (beta), by process name. */
export const DESKTOP_APPS: Record<string, string> = { claude: 'Claude (desktop)', chatgpt: 'ChatGPT (desktop)' }

interface Tab { site: string; title: string; streaming: boolean; answer: string; seen: number; reply?: string }

/** The key you paste into the extension once (pairing). Kept in userData. */
export function loadExtensionKey(dir: string): string {
  const file = path.join(dir, 'extension-key')
  try { const k = fs.readFileSync(file, 'utf8').trim(); if (/^[\w-]{16}$/.test(k)) return k } catch {}
  const k = randomBytes(12).toString('base64url')
  fs.writeFileSync(file, k, { mode: 0o600 })
  return k
}

/**
 * Chats in the browser (through Pebble's extension) and in desktop chat apps (UI Automation, beta) as island sessions:
 * you see when an answer is done and can reply from the island. A reply is typed only after you press Send there, only
 * into an empty message box (a draft is never overwritten), and is never repeated by itself.
 */
export class ChatApps {
  private tabs = new Map<string, Tab>()
  private desktop = new Map<string, { hwnd: number; pid: number }>()
  private timer?: NodeJS.Timeout
  /** when the extension last reported (diagnostics) */
  seen = 0

  constructor(private hub: Hub, private key: string, private o: {
    /** away, in a game or tucked: nobody reads the chats then */
    resting?: () => boolean
    native: { available: boolean; request<T>(cmd: string, args?: Record<string, unknown>): Promise<T> }
    /** process names of the desktop apps to follow (settings) */
    followed(): string[]
    problem(title: string, body: string): void
  }) {
    // a closed tab sends nothing: forget tabs quiet for a minute (the extension reports every 20 s)
    setInterval(() => {
      for (const [id, t] of this.tabs) if (Date.now() - t.seen > 60e3) { this.tabs.delete(id); this.hub.chatEnd(id) }
    }, 15e3).unref()
  }

  /** POST /ext from the extension. null: the key is wrong. */
  fromExtension(key: string, body: unknown): unknown | null {
    const given = Buffer.from(key), expected = Buffer.from(this.key)
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    this.seen = Date.now()
    const b = body as Record<string, unknown>
    if (!b || typeof b.tab !== 'string' || !/^\d{1,12}$/.test(b.tab) || typeof b.site !== 'string' || !(b.site in SITES)) return {}
    const id = `tab:${b.tab}`
    if (b.closed === true) { this.tabs.delete(id); this.hub.chatEnd(id); return {} }
    if (typeof b.problem === 'string') this.o.problem(SITES[b.site]!, b.problem.slice(0, 200))
    const tab: Tab = {
      ...this.tabs.get(id), site: b.site, seen: Date.now(),
      title: typeof b.title === 'string' ? b.title.slice(0, 200) : '',
      streaming: b.streaming === true,
      answer: typeof b.answer === 'string' ? b.answer.slice(-8000) : ''
    }
    this.tabs.set(id, tab)
    this.hub.chatUpdate(id, { app: SITES[b.site]!, title: tab.title, streaming: tab.streaming, answer: tab.answer }, text => { tab.reply = text })
    // your reply rides back on the extension's next report, once
    const reply = tab.reply
    tab.reply = undefined
    return reply ? { reply } : {}
  }

  /** Starts or stops following desktop apps, as the settings say. */
  apply() {
    const on = this.o.followed().length > 0 && this.o.native.available
    if (on && !this.timer) this.timer = setInterval(() => void this.poll(), 2000)
    if (!on && this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
      for (const id of this.desktop.keys()) this.hub.chatEnd(id)
      this.desktop.clear()
    }
  }

  private polling = false
  private async poll() {
    if (this.polling || this.o.resting?.()) return
    this.polling = true
    try {
      const wanted = new Set(this.o.followed().map(p => p.toLowerCase()))
      const windows = await this.o.native.request<{ hwnd: number; pid: number; title: string; process: string }[]>('windows.list')
      const live = new Set<string>()
      for (const w of windows) {
        const proc = w.process.toLowerCase()
        if (!wanted.has(proc) || !(proc in DESKTOP_APPS)) continue
        const id = `desk:${w.hwnd}`
        live.add(id)
        this.desktop.set(id, { hwnd: w.hwnd, pid: w.pid })
        const items = await this.o.native.request<{ t: string; n: string }[]>('uia.read', { hwnd: w.hwnd }).catch(() => null)
        if (!items) continue
        const r = readChat(items)
        this.hub.chatUpdate(id, { app: DESKTOP_APPS[proc]!, title: w.title, ...r }, text => {
          // checked again right before typing: still that window, still that program
          this.o.native.request('uia.send', { hwnd: w.hwnd, pid: w.pid, text })
            .catch((err: Error) => { log.warn('send:', err.message); this.o.problem(DESKTOP_APPS[proc]!, `Not sent: ${err.message}`) })
        })
      }
      for (const id of this.desktop.keys()) if (!live.has(id)) { this.desktop.delete(id); this.hub.chatEnd(id) }
    } catch (err) { log.warn('poll:', (err as Error).message) }
    finally { this.polling = false }
  }
}
