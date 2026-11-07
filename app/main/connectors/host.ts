import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { manifestSchema, type ConnectorInfo, type Manifest, type Widget } from '../../shared/connectors'
import type { FromMain, ToMain } from './runner'
import { writeJsonAtomic } from '../store'
import { logger } from '../log'

const log = logger('connectors')

/** How a connector process is started (Electron's utilityProcess in the app; a fake in tests). */
export interface Spawner {
  (pluginId: string, builtIn?: boolean): { post(m: FromMain): void; on(e: 'message', f: (m: ToMain) => void): void; on(e: 'exit', f: (code: number) => void): void; kill(): void }
}

/** Encrypting secrets at rest (Electron safeStorage = Windows DPAPI in the app). */
export interface Vault { encrypt(s: string): string; decrypt(s: string): string }

interface Found { manifest: Manifest; dir: string; builtIn: boolean; error?: string }
interface Entry { enabled?: boolean; settings?: Record<string, unknown>; approved?: string; webhookKey?: string }

const SECRET_SAVED = '(saved encrypted)'

/**
 * Finds connectors (built-in ones shipped with Pebble, and yours in userData/plugins), runs the enabled ones, and keeps
 * their config in userData/connectors.json: { "<id>": { "enabled": true, "settings": { … } } }. You may type a secret
 * (a token) into that file: on the next load it moves into connectors.secrets (encrypted) and the file says
 * "(saved encrypted)". A plugin you added runs only after you allowed its permissions (asked again when they change).
 * Emits 'change' (widgets or the list changed), 'notify' ({title, body, link}).
 */
export class ConnectorHost extends EventEmitter {
  widgets = new Map<string, Widget>() // "<plugin>/<widget>"
  private found = new Map<string, Found>()
  private running = new Map<string, ReturnType<Spawner>>()
  private problems = new Map<string, string>()
  private restarts = new Map<string, number>()
  private config: Record<string, Entry> = {}
  private secrets: Record<string, Record<string, string>> = {}
  readonly configFile: string
  readonly userDir: string
  private secretsFile: string
  private storeDir: string

  constructor(private o: {
    dataDir: string
    builtInDir: string
    spawn: Spawner
    vault: Vault
    /** asked for a plugin you added: may it run with these permissions? */
    approve: (m: Manifest) => Promise<boolean>
    windows: () => Promise<{ title: string; process: string }[]>
  }) {
    super()
    this.configFile = path.join(o.dataDir, 'connectors.json')
    this.secretsFile = path.join(o.dataDir, 'connectors.secrets')
    this.userDir = path.join(o.dataDir, 'plugins')
    this.storeDir = path.join(o.dataDir, 'connector-data')
    fs.mkdirSync(this.userDir, { recursive: true })
    fs.mkdirSync(this.storeDir, { recursive: true })
  }

  // ---------- finding and configuring ----------

  discover() {
    this.found.clear()
    for (const [dir, builtIn] of [[this.o.builtInDir, true], [this.userDir, false]] as const) {
      let names: string[] = []
      try { names = fs.readdirSync(dir) } catch { continue }
      for (const name of names) {
        const folder = path.join(dir, name), file = path.join(folder, 'plugin.json')
        if (!fs.existsSync(file)) continue
        try {
          const manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
          if (this.found.get(manifest.id)?.builtIn && !builtIn) { log.warn(`${folder}: id "${manifest.id}" is taken by a built-in connector`); continue }
          this.found.set(manifest.id, { manifest, dir: folder, builtIn })
        } catch (err) { log.warn(`${file} is not a valid plugin.json:`, (err as Error).message) }
      }
    }
  }

  /** Reads connectors.json (moving any secret typed into it into the encrypted store). */
  loadConfig() {
    try { this.config = JSON.parse(fs.readFileSync(this.configFile, 'utf8')) } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') { log.warn('connectors.json is not valid JSON; keeping the last good config'); return }
      this.config = {}
    }
    try { this.secrets = JSON.parse(this.o.vault.decrypt(fs.readFileSync(this.secretsFile, 'utf8'))) } catch { this.secrets = {} }
    let moved = false
    for (const [id, f] of this.found) {
      const s = this.config[id]?.settings
      if (!s) continue
      for (const key of f.manifest.permissions.secrets) {
        if (typeof s[key] === 'string' && s[key] && s[key] !== SECRET_SAVED) {
          ;(this.secrets[id] ??= {})[key] = s[key] as string
          s[key] = SECRET_SAVED
          moved = true
        }
      }
    }
    if (moved) { this.saveSecrets(); this.saveConfig(); log.info('secrets moved out of connectors.json into encrypted storage') }
  }

  private saveConfig() { writeJsonAtomic(this.configFile, this.config) }
  private saveSecrets() {
    fs.writeFileSync(this.secretsFile + '.tmp', this.o.vault.encrypt(JSON.stringify(this.secrets)))
    fs.renameSync(this.secretsFile + '.tmp', this.secretsFile)
  }

  /** Writes a skeleton entry (with every setting and its default) so connectors.json shows what can be filled in. */
  private ensureEntry(id: string): Entry {
    const f = this.found.get(id)!
    const e = (this.config[id] ??= {})
    e.settings ??= {}
    for (const s of f.manifest.settings) if (!(s.key in e.settings)) e.settings[s.key] = s.default ?? (s.type === 'list' ? [] : s.type === 'boolean' ? false : '')
    return e
  }

  list(): ConnectorInfo[] {
    return [...this.found.values()].map(f => ({
      id: f.manifest.id, name: f.manifest.name, description: f.manifest.description, builtIn: f.builtIn,
      enabled: !!this.config[f.manifest.id]?.enabled, running: this.running.has(f.manifest.id), problem: this.problems.get(f.manifest.id)
    }))
  }

  /** What is still missing to run it (required settings), or null. */
  missing(id: string): string | null {
    const f = this.found.get(id)
    if (!f) return 'not found'
    const s = this.config[id]?.settings ?? {}
    const need = f.manifest.settings.filter(x => x.required && (x.key in (this.secrets[id] ?? {}) ? false : s[x.key] === undefined || s[x.key] === '' || s[x.key] === SECRET_SAVED || (Array.isArray(s[x.key]) && !(s[x.key] as unknown[]).length)))
    return need.length ? `Fill in ${need.map(n => `"${n.key}" (${n.label})`).join(', ')} in connectors.json` : null
  }

  async setEnabled(id: string, on: boolean) {
    if (!this.found.has(id)) return
    this.ensureEntry(id).enabled = on
    this.saveConfig()
    on ? await this.start(id) : this.stop(id)
    this.emit('change')
  }

  /** Starts every enabled connector (after discover + loadConfig). */
  async startAll() {
    for (const [id] of this.found) if (this.config[id]?.enabled) await this.start(id)
    this.emit('change')
  }

  /** Re-reads connectors.json and restarts the connectors whose config changed. */
  async reload() {
    const before = JSON.stringify(this.config)
    this.loadConfig()
    if (JSON.stringify(this.config) === before) return
    for (const [id] of this.found) { this.stop(id); if (this.config[id]?.enabled) await this.start(id) }
    this.emit('change')
  }

  // ---------- running ----------

  private hash = (m: Manifest) => createHash('sha256').update(JSON.stringify(m.permissions)).digest('hex').slice(0, 16)

  async start(id: string) {
    const f = this.found.get(id)
    if (!f || this.running.has(id)) return
    this.problems.delete(id)
    const entry = this.ensureEntry(id)
    if (!f.builtIn && entry.approved !== this.hash(f.manifest)) {
      if (!(await this.o.approve(f.manifest))) { entry.enabled = false; this.saveConfig(); this.problems.set(id, 'Not allowed'); return }
      entry.approved = this.hash(f.manifest)
      this.saveConfig()
    }
    const missing = this.missing(id)
    if (missing) { this.problems.set(id, missing); log.info(`${f.manifest.name}: ${missing}`); return }
    if (f.manifest.permissions.webhook && !entry.webhookKey) { entry.webhookKey = randomBytes(12).toString('hex'); this.saveConfig() }

    const child = this.o.spawn(id, f.builtIn)
    this.running.set(id, child)
    const settings: Record<string, unknown> = {}
    for (const s of f.manifest.settings) if (!f.manifest.permissions.secrets.includes(s.key)) settings[s.key] = entry.settings?.[s.key] ?? s.default
    let store = {}
    try { store = JSON.parse(fs.readFileSync(path.join(this.storeDir, id + '.json'), 'utf8')) } catch {}
    child.on('message', m => this.onMessage(id, m))
    child.on('exit', code => {
      if (this.running.get(id) !== child) return
      this.running.delete(id)
      for (const k of [...this.widgets.keys()]) if (k.startsWith(id + '/')) this.widgets.delete(k)
      this.emit('change')
      if (!this.config[id]?.enabled) return
      const n = (this.restarts.get(id) ?? 0) + 1
      this.restarts.set(id, n)
      if (n > 5) { this.problems.set(id, 'Stopped after crashing 5 times (see the log)'); return }
      log.warn(`${f.manifest.name} stopped (${code}); restarting`)
      setTimeout(() => void this.start(id), Math.min(60_000, 2000 * 2 ** n)).unref()
    })
    child.post({ type: 'init', manifest: f.manifest, file: path.join(f.dir, f.manifest.main), settings, secrets: this.secrets[id] ?? {}, store })
    if (this.paused) child.post({ type: 'pause', on: true })
  }

  /** Resting: every connector's regular jobs wait (each runs once when it ends). */
  private paused = false
  pause(on: boolean) {
    if (on === this.paused) return
    this.paused = on
    for (const child of this.running.values()) child.post({ type: 'pause', on })
  }

  stop(id: string) {
    const child = this.running.get(id)
    this.running.delete(id)
    child?.kill()
    for (const k of [...this.widgets.keys()]) if (k.startsWith(id + '/')) this.widgets.delete(k)
  }

  stopAll() { for (const id of [...this.running.keys()]) this.stop(id) }

  private onMessage(id: string, m: ToMain) {
    const name = this.found.get(id)?.manifest.name ?? id
    switch (m.type) {
      case 'ready': this.restarts.set(id, 0); log.info(`${name} started`); return
      case 'widget': this.widgets.set(`${id}/${m.widget.id}`, { ...m.widget, plugin: id, at: Date.now() }); this.emit('change'); return
      case 'remove': this.widgets.delete(`${id}/${m.id}`); this.emit('change'); return
      case 'notify': this.emit('notify', { title: m.title, body: m.body, link: m.link }); return
      case 'log': log[m.level](`${name}: ${m.text}`); if (m.level === 'error') { this.problems.set(id, m.text.slice(0, 200)); this.emit('change') } return
      case 'store': try { writeJsonAtomic(path.join(this.storeDir, id + '.json'), m.data) } catch {} return
      case 'windows': this.o.windows().then(list => this.running.get(id)?.post({ type: 'windows', list })).catch(() => this.running.get(id)?.post({ type: 'windows', list: [] })); return
    }
  }

  // ---------- settings, for the Settings window ----------

  /** A connector's settings with their current values. Secrets only say whether they are set: their value never leaves main. */
  fields(id: string): { key: string; label: string; type: string; required: boolean; secret: boolean; value: unknown; set: boolean; pick?: string }[] {
    const f = this.found.get(id)
    if (!f) return []
    const values = this.config[id]?.settings ?? {}
    return f.manifest.settings.map(s => {
      const secret = f.manifest.permissions.secrets.includes(s.key)
      return { key: s.key, label: s.label, type: s.type, required: s.required, secret, value: secret ? '' : values[s.key] ?? s.default ?? '', set: secret ? !!this.secrets[id]?.[s.key] : true, pick: s.pick }
    })
  }

  /** Saves one setting (a secret goes straight into the encrypted store) and restarts the connector if it is on. */
  async setSetting(id: string, key: string, value: unknown) {
    const f = this.found.get(id)
    const field = f?.manifest.settings.find(s => s.key === key)
    if (!f || !field) throw new Error('unknown setting')
    const ok = field.type === 'number' ? typeof value === 'number' && isFinite(value)
      : field.type === 'boolean' ? typeof value === 'boolean'
      : field.type === 'list' ? Array.isArray(value) && value.length <= 100 && value.every(v => typeof v === 'string' && v.length < 2000)
      : typeof value === 'string' && value.length < 4000
    if (!ok) throw new Error(`${field.label}: not a valid ${field.type}`)
    const entry = this.ensureEntry(id)
    if (f.manifest.permissions.secrets.includes(key)) {
      ;(this.secrets[id] ??= {})[key] = value as string
      if (!value) delete this.secrets[id]![key]
      entry.settings![key] = value ? SECRET_SAVED : ''
      this.saveSecrets()
    } else entry.settings![key] = value
    this.saveConfig()
    if (entry.enabled) { this.stop(id); await this.start(id) }
    this.emit('change')
  }

  // ---------- webhooks: POST http://127.0.0.1:<port>/in/<plugin>?k=<key> ----------

  webhookUrl(id: string, port: number): string | null {
    const key = this.config[id]?.webhookKey
    return key && this.found.get(id)?.manifest.permissions.webhook ? `http://127.0.0.1:${port}/in/${id}?k=${key}` : null
  }

  /** true when delivered (right plugin, right key, running). */
  deliver(id: string, key: string, body: unknown): boolean {
    const want = this.config[id]?.webhookKey, child = this.running.get(id)
    if (!want || !child || key.length !== want.length || !timingSafeEqual(Buffer.from(key), Buffer.from(want))) return false
    child.post({ type: 'webhook', body })
    return true
  }
}
