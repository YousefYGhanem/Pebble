import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { PROVIDERS, type ChatMessage, type ChatState, type Look, type ProviderId, type WordFixes } from '../../shared/chat'
import type { Vault } from '../connectors/host'
import { writeJsonAtomic } from '../store'
import { ask as defaultAsk } from './providers'
import { logger } from '../log'

const log = logger('chat')

const system = (name: string) => `You are ${name}, a small friendly helper who lives in Pebble, an island at the top of the user's Windows screen. ` +
  'Answer briefly and plainly. Use Markdown only when it helps (lists, code).'

/**
 * Pip's chat. The conversation lives in memory only (never on disk); API keys are kept encrypted in keys.secrets.
 * Emits 'change' as the answer streams in.
 */
export class Chat extends EventEmitter {
  messages: ChatMessage[] = []
  /** the window that goes with your next message (screen buddy) */
  look?: Look
  /** open windows to pick from, while you pick */
  windows?: { hwnd: number; title: string; process: string }[]
  busy = false
  error?: string
  word?: WordFixes
  private stopper?: AbortController
  private keys: Record<string, string> = {}
  private keysFile: string
  private sandbox: string

  constructor(dataDir: string, private vault: Vault, private settings: () => { provider: ProviderId; model: string; name?: string }, private ask = defaultAsk) {
    super()
    this.keysFile = path.join(dataDir, 'keys.secrets')
    this.sandbox = path.join(dataDir, 'chat')
    fs.mkdirSync(this.sandbox, { recursive: true })
    try { this.keys = JSON.parse(fs.readFileSync(this.keysFile, 'utf8')) } catch {}
  }

  hasKey = (p: string) => !!this.keys[p]

  setKey(provider: ProviderId, key: string) {
    if (!PROVIDERS.find(p => p.id === provider)?.key) throw new Error('this provider needs no key')
    if (key.trim()) this.keys[provider] = this.vault.encrypt(key.trim())
    else delete this.keys[provider]
    writeJsonAtomic(this.keysFile, this.keys)
    this.emit('change')
  }

  state(): ChatState {
    const s = this.settings(), p = PROVIDERS.find(x => x.id === s.provider)!
    const look = this.look && { title: this.look.title, process: this.look.process }
    return { provider: p.name, ready: !p.key || this.hasKey(p.id), messages: this.messages, look, windows: this.windows, busy: this.busy, error: this.error, word: this.word }
  }

  async send(text: string) {
    if (this.busy || !text.trim()) return
    const s = this.settings(), p = PROVIDERS.find(x => x.id === s.provider)!
    this.messages.push({ role: 'user', text: text.trim(), at: Date.now(), look: this.look })
    this.look = undefined
    const answer: ChatMessage = { role: 'assistant', text: '', at: Date.now() }
    this.messages = this.messages.slice(-40)
    const history = [...this.messages]
    this.messages.push(answer)
    this.busy = true
    this.error = undefined
    this.stopper = new AbortController()
    this.emit('change')
    try {
      await this.ask({
        provider: p.id, model: s.model || p.model, key: this.keys[p.id] && this.vault.decrypt(this.keys[p.id]!),
        system: system(s.name ?? 'Pip'), messages: history, sandbox: this.sandbox, signal: this.stopper.signal,
        onText: t => { answer.text += t; this.emit('change') }
      })
    } catch (err) {
      if (!this.stopper.signal.aborted) { this.error = (err as Error).message; log.warn(p.id, this.error) }
    }
    if (!answer.text) this.messages = this.messages.filter(m => m !== answer)
    this.busy = false
    this.emit('change')
    if (answer.text && !this.stopper.signal.aborted) this.emit('answered', answer.text)
  }

  /** Shows Pip a window: it goes with your next message. image: a PNG file name in the chat folder. */
  attach(look: Look | undefined) { this.look = look; this.windows = undefined; this.emit('change') }

  pick(windows: Chat['windows']) { this.windows = windows; this.emit('change') }

  /** Where screenshots for the chat go. */
  get folder() { return this.sandbox }

  /** One whole answer from the chosen provider, outside the conversation (Fix in Word). */
  async complete(system: string, text: string): Promise<string> {
    const s = this.settings(), p = PROVIDERS.find(x => x.id === s.provider)!
    if (p.key && !this.hasKey(p.id)) throw new Error(`${p.name} needs a key (Settings)`)
    let out = ''
    await this.ask({
      provider: p.id, model: s.model || p.model, key: this.keys[p.id] && this.vault.decrypt(this.keys[p.id]!),
      system, messages: [{ role: 'user', text, at: Date.now() }], sandbox: this.sandbox, signal: new AbortController().signal, onText: t => { out += t }
    })
    return out
  }

  setWord(w: WordFixes | undefined) { this.word = w; this.emit('change') }

  stop() { this.stopper?.abort() }

  clear() {
    this.stop()
    this.messages = []
    this.look = undefined
    this.error = undefined
    // the screenshots go with the conversation
    for (const f of fs.readdirSync(this.sandbox)) if (/^look-\d+\.png$/.test(f)) fs.rmSync(path.join(this.sandbox, f), { force: true })
    this.emit('change')
  }
}
