import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, test, expect } from 'vitest'
import { interval, loadPlugin, makeApi, startPlugin, type FromMain, type ToMain } from '../app/main/connectors/runner'
import { ConnectorHost, type Spawner } from '../app/main/connectors/host'
import { describePermissions, hostAllowed, manifestSchema, type Manifest } from '../app/shared/connectors'
import { Hub } from '../app/main/agents/hub'

const ROOT = path.join(__dirname, '..')
const manifest = (p: Partial<Manifest['permissions']> = {}): Manifest => manifestSchema.parse({ id: 'test', name: 'Test', permissions: p })
const fakeFetch = (routes: Record<string, { status?: number; body?: string; location?: string }>) => (async (url: string | URL, init?: RequestInit) => {
  const r = routes[String(url)] ?? { status: 404, body: 'not found' }
  return new Response(r.body ?? '', { status: r.status ?? 200, headers: { ...(r.location ? { location: r.location } : {}), 'x-saw-auth': String((init?.headers as Record<string, string>)?.Authorization ?? '') } })
}) as typeof fetch
const collect = () => { const sent: ToMain[] = []; return { sent, send: (m: ToMain) => sent.push(m) } }

test('intervals: words, and never faster than 15 s', () => {
  expect(interval('2m')).toBe(120_000)
  expect(interval('1h')).toBe(3_600_000)
  expect(interval('1s')).toBe(15_000)
  expect(() => interval('soon')).toThrow(/bad interval/)
})

test('hosts and permissions in words', () => {
  expect(hostAllowed('api.github.com', ['api.github.com'])).toBe(true)
  expect(hostAllowed('evil.com', ['api.github.com'])).toBe(false)
  expect(hostAllowed('site.api.espn.com', ['*.espn.com'])).toBe(true)
  expect(hostAllowed('espn.com.evil.io', ['*.espn.com'])).toBe(false)
  expect(hostAllowed('anything.io', ['*'])).toBe(true)
  expect(describePermissions(manifest({ net: ['*'], notify: true }))).toEqual(['Connect to any website', 'Show notifications'])
})

describe('the plugin context', () => {
  const pebble = makeApi({ manifest: manifest(), settings: {}, secrets: {}, store: {}, send: () => {} }).api

  test('has only pebble: no require, process, eval or new Function', async () => {
    await expect(startPlugin('module.exports = p => require("fs")', 'x.js', pebble)).rejects.toThrow(/require is not defined/)
    await expect(startPlugin('module.exports = p => process.exit()', 'x.js', pebble)).rejects.toThrow(/process is not defined/)
    expect(() => loadPlugin('eval("1+1")', 'x.js', pebble)).toThrow(/Code generation from strings disallowed/)
    expect(() => loadPlugin('new Function("return 1")', 'x.js', pebble)).toThrow(/Code generation from strings disallowed/)
    expect(() => loadPlugin('while (true) {}', 'x.js', pebble)).toThrow(/timed out/)
  })

  test('a plugin must export a function', async () => {
    await expect(startPlugin('module.exports = 42', 'x.js', pebble)).rejects.toThrow(/must export a function/)
  })
})

describe('pebble.fetch', () => {
  test('only declared hosts; secrets added by Pebble, never seen by the plugin', async () => {
    const { send } = collect()
    const h = makeApi({ manifest: manifest({ net: ['api.ok.io'], secrets: ['token'] }), settings: { token: 'leak?' }, secrets: { token: 's3cret' }, store: {}, send,
      fetch: fakeFetch({ 'https://api.ok.io/x': { body: '{"a":1}' } }) })
    expect(await h.api.fetchJSON('https://api.ok.io/x')).toEqual({ a: 1 })
    await expect(h.api.fetchJSON('https://evil.io/x')).rejects.toThrow(/not in this plugin's permissions.net/)
    const r = await h.api.fetch('https://api.ok.io/x', { auth: 'token' })
    expect(r.ok).toBe(true)
    await expect(h.api.fetch('https://api.ok.io/x', { auth: 'other' })).rejects.toThrow(/permissions.secrets/)
    expect(h.api.settings).toEqual({ token: 'leak?' }) // settings are what main gave; main leaves secrets out (see the host test)
  })

  test('redirects are checked too, and a secret never follows to another host', async () => {
    const seen: string[] = []
    const f = (async (url: string | URL, init?: RequestInit) => {
      seen.push(`${url} ${(init?.headers as Record<string, string>).Authorization ?? '-'}`)
      if (String(url) === 'https://a.io/start') return new Response('', { status: 302, headers: { location: 'https://b.io/end' } })
      if (String(url) === 'https://a.io/bad') return new Response('', { status: 302, headers: { location: 'https://evil.io/' } })
      return new Response('ok')
    }) as typeof fetch
    const h = makeApi({ manifest: manifest({ net: ['a.io', 'b.io'], secrets: ['t'] }), settings: {}, secrets: { t: 'x' }, store: {}, send: () => {}, fetch: f })
    expect(await h.api.fetchText('https://a.io/start', { auth: 't' })).toBe('ok')
    expect(seen).toEqual(['https://a.io/start Bearer x', 'https://b.io/end -'])
    await expect(h.api.fetchText('https://a.io/bad')).rejects.toThrow(/evil.io is not in/)
  })

  test('"secret:name" fetches an address that is itself a secret', async () => {
    const h = makeApi({ manifest: manifest({ net: ['*'], secrets: ['ics'] }), settings: {}, secrets: { ics: 'webcal://cal.io/me.ics' }, store: {}, send: () => {},
      fetch: fakeFetch({ 'https://cal.io/me.ics': { body: 'BEGIN:VCALENDAR' } }) })
    expect(await h.api.fetchText('secret:ics')).toBe('BEGIN:VCALENDAR')
  })
})

test('widgets, notifications and the store reach main; permissions are enforced', () => {
  const { sent, send } = collect()
  const h = makeApi({ manifest: manifest({ notify: false }), settings: {}, secrets: {}, store: { a: 1 }, send })
  h.api.widget('w1', { kind: 'chip', text: 'x'.repeat(500), link: 'javascript:alert(1)' })
  expect(sent[0]).toMatchObject({ type: 'widget', widget: { id: 'w1', kind: 'chip', link: undefined } })
  expect((sent[0] as { widget: { text: string } }).widget.text).toHaveLength(200)
  expect(() => h.api.notify({ body: 'hi' })).toThrow(/no permissions.notify/)
  expect(() => h.api.onWebhook(() => {})).toThrow(/no permissions.webhook/)
  expect(h.api.store.get('a')).toBe(1)
  h.api.store.set('b', 2)
  expect(sent.at(-1)).toEqual({ type: 'store', data: { a: 1, b: 2 } })
})

test('the example from docs/PLUGINS.md works as written', async () => {
  const dir = path.join(ROOT, 'examples', 'plugins', 'hacker-news')
  const m = manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')))
  const { sent, send } = collect()
  const h = makeApi({ manifest: m, settings: { minScore: 500 }, secrets: {}, store: {}, send, fetch: fakeFetch({
    'https://hacker-news.firebaseio.com/v0/topstories.json': { body: '[42, 7]' },
    'https://hacker-news.firebaseio.com/v0/item/42.json': { body: '{"id":42,"title":"Show HN: Pebble","score":812,"url":"https://example.com"}' }
  }) })
  await startPlugin(fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), 'index.js', h.api)
  for (let i = 0; i < 20 && !sent.some(x => x.type === 'notify'); i++) await new Promise(r => setTimeout(r, 10))
  h.stop()
  expect(sent.filter(x => x.type === 'widget').map(x => (x as { widget: { id: string; text: string } }).widget)).toEqual([
    expect.objectContaining({ id: 'top', kind: 'card', text: 'Show HN: Pebble', link: 'https://example.com' }),
    expect.objectContaining({ id: 'score', kind: 'chip', text: 'HN 812' })
  ])
  expect(sent).toContainEqual({ type: 'notify', title: 'Big on Hacker News', body: 'Show HN: Pebble', link: 'https://example.com' })
})

describe('built-in connectors', () => {
  const dirs = fs.readdirSync(path.join(ROOT, 'plugins'))
  test.each(dirs)('%s: a valid plugin.json and a script that loads', dir => {
    const m = manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'plugins', dir, 'plugin.json'), 'utf8')))
    expect(m.id).toBe(dir)
    const exp = loadPlugin(fs.readFileSync(path.join(ROOT, 'plugins', dir, m.main), 'utf8'), m.main, {})
    expect(typeof exp).toBe('function')
  })

  const exportsOf = (dir: string) => loadPlugin(fs.readFileSync(path.join(ROOT, 'plugins', dir, 'index.js'), 'utf8'), 'index.js', {}) as Record<string, (...a: unknown[]) => unknown>

  test('RSS and Atom parsing', () => {
    const { parseFeed } = exportsOf('rss')
    expect(parseFeed('<rss><channel><item><title><![CDATA[A &amp; B]]></title><link>https://x.io/1</link><guid>g1</guid></item></channel></rss>'))
      .toEqual([{ title: 'A & B', link: 'https://x.io/1', id: 'g1' }])
    expect(parseFeed('<feed><entry><title>Atom one</title><link href="https://y.io/a"/><id>urn:1</id></entry></feed>'))
      .toEqual([{ title: 'Atom one', link: 'https://y.io/a', id: 'urn:1' }])
  })

  test('iCal parsing: UTC, local and all-day starts, folded lines', () => {
    const { parseIcs } = exportsOf('calendar')
    const ev = parseIcs('BEGIN:VEVENT\r\nSUMMARY:Design\r\n  review\r\nDTSTART:20261103T090000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Holiday\r\nDTSTART;VALUE=DATE:20261224\r\nEND:VEVENT') as { title: string; start: Date; allDay: boolean }[]
    expect(ev[0]!.title).toBe('Design review')
    expect(ev[0]!.start.toISOString()).toBe('2026-11-03T09:00:00.000Z')
    expect(ev[1]).toMatchObject({ title: 'Holiday', allDay: true })
  })

  test('watch: a JSON path or a regular expression', () => {
    const { pick } = exportsOf('watch')
    expect(pick('{"data":{"price":42.5}}', 'data.price')).toBe('42.5')
    expect(pick('{"items":[{"status":"ok"}]}', 'items.0.status')).toBe('ok')
    expect(pick('<p>Price: 1299 EUR</p>', 'Price: (\\d+)')).toBe('1299')
  })
})

describe('the connector host', () => {
  /** runs connectors in this process (the app uses Electron's utilityProcess) */
  const inProcess: Spawner = () => {
    const listeners: Record<string, ((x: never) => void)[]> = { message: [], exit: [] }
    let h: ReturnType<typeof makeApi> | undefined
    return {
      post: (m: FromMain) => {
        if (m.type === 'init') {
          h = makeApi({ manifest: m.manifest, settings: m.settings, secrets: m.secrets, store: m.store, send: x => listeners.message!.forEach(f => f(x as never)) })
          startPlugin(fs.readFileSync(m.file, 'utf8'), m.file, h.api).then(() => listeners.message!.forEach(f => f({ type: 'ready' } as never)))
        } else if (m.type === 'webhook') h?.webhook(m.body)
      },
      on: (e: 'message' | 'exit', f: (x: never) => void) => { listeners[e]!.push(f) },
      kill: () => h?.stop()
    } as ReturnType<Spawner>
  }
  const vault = { encrypt: (s: string) => 'enc:' + Buffer.from(s).toString('base64'), decrypt: (s: string) => Buffer.from(s.slice(4), 'base64').toString() }

  test('secrets leave connectors.json; your own plugin runs only after you allow it; webhooks need its key', async () => {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-conn-'))
    const builtIn = path.join(data, 'builtin')
    fs.mkdirSync(path.join(builtIn, 'echo'), { recursive: true })
    fs.writeFileSync(path.join(builtIn, 'echo', 'plugin.json'), JSON.stringify({ id: 'echo', name: 'Echo', permissions: { webhook: true, secrets: ['key'] }, settings: [{ key: 'key', label: 'k', required: true }, { key: 'word', label: 'w', default: 'hi' }] }))
    fs.writeFileSync(path.join(builtIn, 'echo', 'index.js'), "module.exports = p => { p.widget('w', { text: p.settings.word + (p.settings.key ? ' LEAK' : '') }); p.onWebhook(b => p.widget('w', { text: 'got ' + b.n })) }")
    fs.mkdirSync(path.join(data, 'plugins', 'mine'), { recursive: true })
    fs.writeFileSync(path.join(data, 'plugins', 'mine', 'plugin.json'), JSON.stringify({ id: 'mine', name: 'Mine', permissions: { net: ['*'] } }))
    fs.writeFileSync(path.join(data, 'plugins', 'mine', 'index.js'), "module.exports = p => p.widget('x', { text: 'mine' })")
    fs.writeFileSync(path.join(data, 'connectors.json'), JSON.stringify({ echo: { enabled: true, settings: { key: 'top-secret' } }, mine: { enabled: true } }))

    const asked: string[] = []
    let allow = false
    const host = new ConnectorHost({ dataDir: data, builtInDir: builtIn, spawn: inProcess, vault, approve: async m => { asked.push(m.id); return allow }, windows: async () => [] })
    host.discover()
    host.loadConfig()
    expect(fs.readFileSync(path.join(data, 'connectors.json'), 'utf8')).not.toContain('top-secret')
    expect(fs.readFileSync(path.join(data, 'connectors.secrets'), 'utf8')).toMatch(/^enc:/)

    await host.startAll()
    await new Promise(r => setTimeout(r, 30))
    expect(host.widgets.get('echo/w')?.text).toBe('hi') // the secret was not in its settings
    expect(asked).toEqual(['mine'])
    expect(host.list().find(c => c.id === 'mine')).toMatchObject({ enabled: false, running: false, problem: 'Not allowed' })

    const url = host.webhookUrl('echo', 47901)!
    const key = new URL(url).searchParams.get('k')!
    expect(host.deliver('echo', 'wrong', { n: 1 })).toBe(false)
    expect(host.deliver('echo', key, { n: 7 })).toBe(true)
    await new Promise(r => setTimeout(r, 20))
    expect(host.widgets.get('echo/w')?.text).toBe('got 7')

    allow = true
    await host.setEnabled('mine', true)
    await new Promise(r => setTimeout(r, 30))
    expect(host.widgets.get('mine/x')?.text).toBe('mine')
    host.stopAll()
  })

  test('a required setting that is missing keeps it off, with the reason', async () => {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-conn-'))
    const host = new ConnectorHost({ dataDir: data, builtInDir: path.join(ROOT, 'plugins'), spawn: inProcess, vault, approve: async () => true, windows: async () => [] })
    host.discover()
    host.loadConfig()
    await host.setEnabled('weather', true)
    expect(host.list().find(c => c.id === 'weather')?.problem).toMatch(/"city"/)
    // and connectors.json now shows what to fill in
    expect(JSON.parse(fs.readFileSync(host.configFile, 'utf8')).weather.settings).toEqual({ city: '', unit: 'celsius', rainAlert: true })
  })

  test('the Settings window form: secrets are write-only, values are checked by type', async () => {
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-conn-'))
    const builtIn = path.join(data, 'builtin')
    fs.mkdirSync(path.join(builtIn, 'echo'), { recursive: true })
    fs.writeFileSync(path.join(builtIn, 'echo', 'plugin.json'), JSON.stringify({ id: 'echo', name: 'Echo', permissions: { secrets: ['key'] }, settings: [{ key: 'key', label: 'Key' }, { key: 'n', label: 'N', type: 'number', default: 3 }] }))
    fs.writeFileSync(path.join(builtIn, 'echo', 'index.js'), 'module.exports = () => {}')
    const host = new ConnectorHost({ dataDir: data, builtInDir: builtIn, spawn: inProcess, vault, approve: async () => true, windows: async () => [] })
    host.discover()
    host.loadConfig()
    expect(host.fields('echo')).toMatchObject([{ key: 'key', secret: true, set: false, value: '' }, { key: 'n', secret: false, value: 3 }])
    await host.setSetting('echo', 'key', 'top-secret')
    await host.setSetting('echo', 'n', 5)
    expect(host.fields('echo')).toMatchObject([{ key: 'key', set: true, value: '' }, { key: 'n', value: 5 }])
    expect(fs.readFileSync(host.configFile, 'utf8')).not.toContain('top-secret')
    await expect(host.setSetting('echo', 'n', 'five')).rejects.toThrow(/number/)
    await expect(host.setSetting('echo', 'nope', 1)).rejects.toThrow()
  })
})

test('the hub passes /in/<connector>?k=… to the connectors, without the hook token', async () => {
  const got: unknown[] = []
  const hub = new Hub('a'.repeat(48), { answerPermissions: () => false, webhook: (p, k, b) => { got.push([p, k, b]); return k === 'right' } })
  await hub.listen(47995)
  try {
    expect((await fetch('http://127.0.0.1:47995/in/webhook?k=right', { method: 'POST', body: '{"title":"Deploy"}' })).status).toBe(200)
    expect((await fetch('http://127.0.0.1:47995/in/webhook?k=wrong', { method: 'POST', body: 'x' })).status).toBe(404)
    expect((await fetch('http://127.0.0.1:47995/hook', { method: 'POST', body: '{}' })).status).toBe(403) // everything else still needs the token
    expect(got[0]).toEqual(['webhook', 'right', { title: 'Deploy' }])
  } finally { hub.close() }
})

test('built-in connectors share one process; yours get their own; it ends with its last connector', async () => {
  const { EventEmitter } = await import('node:events')
  const { sharedSpawner } = await import('../app/main/connectors/shared')
  const forks: (InstanceType<typeof EventEmitter> & { posted: unknown[]; killed: boolean })[] = []
  const spawn = sharedSpawner(() => {
    const c = Object.assign(new EventEmitter(), { posted: [] as unknown[], killed: false, postMessage(m: unknown) { c.posted.push(m) }, kill() { c.killed = true; return true } })
    forks.push(c)
    return c as never
  })
  const a = spawn('a', true), b = spawn('b', true), mine = spawn('mine', false)
  expect(forks.length).toBe(2) // a and b together, mine alone
  const got: ToMain[] = [], exits: number[] = []
  a.on('message', m => got.push(m)); b.on('exit', c => exits.push(c))
  a.post({ type: 'webhook', body: 1 })
  expect(forks[0]!.posted).toEqual([{ type: 'webhook', body: 1, plugin: 'a' }])
  forks[0]!.emit('message', { type: 'ready', plugin: 'b' }) // b's message is not a's
  forks[0]!.emit('message', { type: 'remove', id: 'x', plugin: 'a' })
  expect(got).toEqual([{ type: 'remove', id: 'x', plugin: 'a' }])
  forks[0]!.emit('message', { type: 'exit', code: 1, plugin: 'b' }) // b could not start: only b ends
  expect(exits).toEqual([1])
  expect(forks[0]!.killed).toBe(false)
  a.kill() // the last one in the shared process
  expect(forks[0]!.posted.at(-1)).toEqual({ type: 'stop', plugin: 'a' })
  expect(forks[0]!.killed).toBe(true)
  spawn('c', true)
  expect(forks.length).toBe(3) // a fresh shared process
  mine.kill()
  expect(forks[1]!.killed).toBe(true)
})
