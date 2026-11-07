import vm from 'node:vm'
import fs from 'node:fs'
import { hostAllowed, type Manifest, type Widget } from '../../shared/connectors'

// One connector's process (Electron utilityProcess). The plugin's script runs in a fresh VM context that has only the
// Pebble API (docs/PLUGINS.md): no require, no process, no fetch of its own. Network calls go through pebble.fetch,
// which reaches only the hosts the plugin declared, and adds secrets the plugin names but never sees.
// This keeps mistakes contained (a crash or a hang ends here, not in Pebble); it is not a wall against hostile code,
// so Pebble asks before it runs a plugin you added.

export type ToMain =
  | { type: 'widget'; widget: Omit<Widget, 'plugin' | 'at'> }
  | { type: 'remove'; id: string }
  | { type: 'notify'; title: string; body: string; link?: string }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; text: string }
  | { type: 'store'; data: Record<string, unknown> }
  | { type: 'windows' }
  | { type: 'ready' }
  | { type: 'exit'; code: number } // this plugin ended (its process may run on, for the others)

export type FromMain =
  | { type: 'init'; manifest: Manifest; file: string; settings: Record<string, unknown>; secrets: Record<string, string>; store: Record<string, unknown> }
  | { type: 'webhook'; body: unknown }
  | { type: 'windows'; list: { title: string; process: string }[] }
  | { type: 'stop' }
  | { type: 'pause'; on: boolean }

type Auth = string | { header: string; secret: string; prefix?: string }
interface FetchOptions { method?: string; headers?: Record<string, string>; body?: string; auth?: Auth }

/** "30s", "2m", "1h" or ms → ms (at least 15 s: connectors poll, they do not hammer). */
export function interval(v: string | number): number {
  const ms = typeof v === 'number' ? v : (() => {
    const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/.exec(v.trim())
    if (!m) throw new Error(`bad interval "${v}" (use 30s, 2m, 1h)`)
    return +m[1]! * { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2] as 'ms']!
  })()
  return Math.max(15_000, ms)
}

const MAX_BODY = 5 * 1024 * 1024

export function makeApi(o: {
  manifest: Manifest
  settings: Record<string, unknown>
  secrets: Record<string, string>
  store: Record<string, unknown>
  send: (m: ToMain) => void
  fetch?: typeof fetch
}) {
  const { manifest, send } = o
  const doFetch = o.fetch ?? fetch
  const timers: NodeJS.Timeout[] = []
  // resting (away, in a game, on battery): the regular jobs wait, and each runs once when Pebble wakes
  let paused = false
  const jobs: (() => unknown)[] = []
  let webhook: ((body: unknown) => unknown) | undefined
  let windowsWaiter: ((list: { title: string; process: string }[]) => void) | undefined
  const store = { ...o.store }
  const log = (level: 'info' | 'warn' | 'error') => (...a: unknown[]) =>
    send({ type: 'log', level, text: a.map(x => (x instanceof Error ? x.message : typeof x === 'string' ? x : JSON.stringify(x))).join(' ').slice(0, 2000) })
  const safely = (fn: () => unknown) => Promise.resolve().then(fn).catch(err => log('error')(err))

  async function request(url: string, opts: FetchOptions = {}) {
    // "secret:<name>": the address itself is a secret (a private calendar link): Pebble puts it in, the script never sees it
    if (url.startsWith('secret:')) {
      const name = url.slice(7)
      if (!manifest.permissions.secrets.includes(name)) throw new Error(`"${name}" is not in this plugin's permissions.secrets`)
      if (!o.secrets[name]) throw new Error(`the secret "${name}" is not set (connectors.json)`)
      url = o.secrets[name]!.replace(/^webcal:/i, 'https:')
    }
    let u = new URL(url)
    const check = (x: URL) => {
      if (x.protocol !== 'https:' && x.protocol !== 'http:') throw new Error('only http(s) addresses')
      if (!hostAllowed(x.hostname, manifest.permissions.net)) throw new Error(`${x.hostname} is not in this plugin's permissions.net`)
    }
    check(u)
    const headers: Record<string, string> = { 'User-Agent': `Pebble-connector/${manifest.id}`, ...(opts.headers ?? {}) }
    if (opts.auth) {
      const a = typeof opts.auth === 'string' ? { header: 'Authorization', secret: opts.auth, prefix: 'Bearer ' } : opts.auth
      if (!manifest.permissions.secrets.includes(a.secret)) throw new Error(`"${a.secret}" is not in this plugin's permissions.secrets`)
      const value = o.secrets[a.secret]
      if (!value) throw new Error(`the secret "${a.secret}" is not set (connectors.json)`)
      headers[a.header] = (a.prefix ?? '') + value
    }
    // redirects are followed by hand, so every hop must also be an allowed host (and secrets never follow to another host)
    let res = await doFetch(u, { method: opts.method ?? 'GET', headers, body: opts.body, redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    for (let hops = 0; res.status >= 300 && res.status < 400 && res.headers.get('location'); hops++) {
      if (hops >= 3) throw new Error('too many redirects')
      const nextUrl = new URL(res.headers.get('location')!, u)
      check(nextUrl)
      if (nextUrl.host !== u.host) delete headers[typeof opts.auth === 'object' ? opts.auth.header : 'Authorization']
      u = nextUrl
      res = await doFetch(u, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    }
    const text = await res.text()
    if (text.length > MAX_BODY) throw new Error('response too big')
    return { status: res.status, ok: res.ok, text: () => text, json: () => JSON.parse(text) }
  }

  const api = {
    settings: Object.freeze({ ...o.settings }),
    every(every: string | number, fn: () => unknown) {
      const ms = interval(every)
      jobs.push(fn)
      if (!paused) void safely(fn)
      timers.push(setInterval(() => { if (!paused) void safely(fn) }, ms))
    },
    after(ms: number, fn: () => unknown) { timers.push(setTimeout(() => void safely(fn), Math.max(0, ms))) },
    fetch: request,
    async fetchJSON(url: string, opts?: FetchOptions) {
      const r = await request(url, opts)
      if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`)
      return r.json()
    },
    async fetchText(url: string, opts?: FetchOptions) {
      const r = await request(url, opts)
      if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`)
      return r.text()
    },
    widget(id: string, w: Partial<Widget> & { text: string }) {
      if (!/^[\w-]{1,40}$/.test(id)) throw new Error(`bad widget id "${id}"`)
      const kind = w.kind === 'chip' || w.kind === 'activity' ? w.kind : 'card'
      send({ type: 'widget', widget: {
        id, kind, text: String(w.text).slice(0, 200), title: w.title?.slice(0, 80), icon: w.icon?.slice(0, 20), tone: w.tone,
        lines: w.lines?.slice(0, 6).map(l => String(l).slice(0, 200)),
        progress: typeof w.progress === 'number' ? Math.max(0, Math.min(100, w.progress)) : undefined,
        link: typeof w.link === 'string' && /^https?:\/\//.test(w.link) ? w.link : undefined
      } })
    },
    remove(id: string) { send({ type: 'remove', id }) },
    notify(n: { title?: string; body: string; link?: string }) {
      if (!manifest.permissions.notify) throw new Error('this plugin has no permissions.notify')
      send({ type: 'notify', title: (n.title ?? manifest.name).slice(0, 80), body: String(n.body).slice(0, 300), link: n.link })
    },
    onWebhook(fn: (body: unknown) => unknown) {
      if (!manifest.permissions.webhook) throw new Error('this plugin has no permissions.webhook')
      webhook = fn
    },
    windows(): Promise<{ title: string; process: string }[]> {
      if (!manifest.permissions.windows) return Promise.reject(new Error('this plugin has no permissions.windows'))
      return new Promise(resolve => { windowsWaiter = resolve; send({ type: 'windows' }) })
    },
    store: {
      get: (key: string) => store[key],
      set(key: string, value: unknown) { store[key] = value; send({ type: 'store', data: { ...store } }) }
    },
    log: log('info')
  }

  return {
    api: Object.freeze(api),
    webhook: (body: unknown) => { if (webhook) void safely(() => webhook!(body)) },
    windows: (list: { title: string; process: string }[]) => { windowsWaiter?.(list); windowsWaiter = undefined },
    stop: () => timers.forEach(t => clearTimeout(t)),
    pause: (on: boolean) => { if (paused && !on) for (const fn of jobs) void safely(fn); paused = on }
  }
}

/** Runs a plugin script in its own context with only `pebble` in reach; returns what it exported. */
export function loadPlugin(code: string, filename: string, pebble: object): unknown {
  const module = { exports: {} as unknown }
  const context = vm.createContext({
    module, exports: module.exports, pebble,
    console: { log: (pebble as { log: (...a: unknown[]) => void }).log, warn: (pebble as { log: (...a: unknown[]) => void }).log, error: (pebble as { log: (...a: unknown[]) => void }).log },
    URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone
  }, { codeGeneration: { strings: false, wasm: false } }) // no eval / new Function inside
  vm.runInContext(code, context, { filename, timeout: 2000 })
  return module.exports
}

/** Starts the plugin: its export is a function that gets `pebble` (or an object with a `start` function). */
export async function startPlugin(code: string, filename: string, pebble: object) {
  const exp = loadPlugin(code, filename, pebble) as ((p: object) => unknown) | { start?: (p: object) => unknown }
  const start = typeof exp === 'function' ? exp : exp?.start
  if (typeof start !== 'function') throw new Error('the plugin must export a function: module.exports = pebble => { … }')
  await start(pebble)
}

// ---------- the utility process: one or more plugins, each message names its plugin (shared.ts) ----------
const port = (process as unknown as { parentPort?: { on(e: 'message', f: (e: { data: FromMain & { plugin: string } }) => void): void; postMessage(m: ToMain & { plugin: string }): void } }).parentPort
if (port) {
  const plugins = new Map<string, ReturnType<typeof makeApi>>()
  port.on('message', async ({ data }) => {
    const id = data.plugin, send = (m: ToMain) => port.postMessage({ ...m, plugin: id })
    if (data.type === 'init') {
      const handle = makeApi({ manifest: data.manifest, settings: data.settings, secrets: data.secrets, store: data.store, send })
      plugins.set(id, handle)
      try { await startPlugin(fs.readFileSync(data.file, 'utf8'), data.file, handle.api); send({ type: 'ready' }) }
      catch (err) { handle.stop(); plugins.delete(id); send({ type: 'log', level: 'error', text: `could not start: ${(err as Error).message}` }); send({ type: 'exit', code: 1 }) }
    } else if (data.type === 'stop') { plugins.get(id)?.stop(); plugins.delete(id) }
    else if (data.type === 'pause') plugins.get(id)?.pause(data.on)
    else if (data.type === 'webhook') plugins.get(id)?.webhook(data.body)
    else if (data.type === 'windows') plugins.get(id)?.windows(data.list)
  })
}
