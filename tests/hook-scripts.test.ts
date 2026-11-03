// The native helper's hooks and CLI, run the way Claude Code and a terminal run them, against a live hub
// (Windows, after `npm run build:native`).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Hub } from '../app/main/agents/hub'
import { install } from '../app/main/agents/claude'

const TOKEN = 'f'.repeat(48)
const PORT = 47990
const EXE = path.join(__dirname, '..', 'native', 'out', 'pebble-native.exe')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-live-'))
const settings = path.join(dir, 'settings.json')
let hub: Hub

function run(file: string, args: string[], stdin: string, env: NodeJS.ProcessEnv = process.env): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise(resolve => {
    const child = spawn(file, args, { env, windowsHide: true })
    let out = '', err = ''
    child.stdout.setEncoding('utf8').on('data', d => (out += d))
    child.stderr.setEncoding('utf8').on('data', d => (err += d))
    child.on('close', code => resolve({ code, out: out.trim(), err: err.trim() }))
    child.stdin.end(stdin)
  })
}

/** The installed hook command, split into program + arguments (as a shell would). */
function hookCommand(kind: string): [string, string[]] {
  const s = JSON.parse(fs.readFileSync(settings, 'utf8'))
  for (const groups of Object.values(s.hooks) as { hooks: { command?: string }[] }[][]) {
    for (const g of groups) for (const h of g.hooks) {
      if (!h.command?.includes(` hook ${kind} `)) continue
      const parts = h.command.match(/"[^"]*"|\S+/g)!.map(p => p.replace(/^"|"$/g, ''))
      return [parts[0]!, parts.slice(1)]
    }
  }
  throw new Error(kind + ' hook not installed')
}

describe.skipIf(process.platform !== 'win32' || !fs.existsSync(EXE))('native hooks and CLI on Windows', () => {
  beforeAll(async () => {
    hub = new Hub(TOKEN, { answerPermissions: () => true })
    await hub.listen(PORT)
    install({ port: PORT, token: TOKEN, nativeExe: EXE }, settings)
  })
  afterAll(() => hub.close())

  test('hook reply: your reply comes out on stderr with exit 2 (that wakes Claude)', async () => {
    const [exe, args] = hookCommand('reply')
    const r = run(exe, args, JSON.stringify({ session_id: 'rp', hook_event_name: 'Stop' }))
    for (let i = 0; i < 100 && !hub.sessions.get('rp')?.replyable; i++) await new Promise(res => setTimeout(res, 50))
    expect(hub.reply('rp', 'add tests — and ünïcode ✓')).toBe(true)
    const { code, err } = await r
    expect(code).toBe(2)
    expect(err).toBe('add tests — and ünïcode ✓')
  }, 20000)

  test('hook reply: exit 0 when you typed in the terminal instead', async () => {
    const [exe, args] = hookCommand('reply')
    const r = run(exe, args, JSON.stringify({ session_id: 'rt', hook_event_name: 'Stop' }))
    for (let i = 0; i < 100 && !hub.sessions.get('rt')?.replyable; i++) await new Promise(res => setTimeout(res, 50))
    await fetch(`http://127.0.0.1:${PORT}/hook`, { method: 'POST', headers: { 'X-Pebble-Token': TOKEN }, body: JSON.stringify({ session_id: 'rt', hook_event_name: 'UserPromptSubmit', prompt: 'x' }) })
    expect((await r).code).toBe(0)
  }, 20000)

  test('hook reply: exit 0 straight away when Pebble is not running', async () => {
    const [exe, args] = hookCommand('reply')
    const started = Date.now()
    const { code } = await run(exe, args.map(a => (a === String(PORT) ? '47999' : a)), JSON.stringify({ session_id: 'x' }))
    expect(code).toBe(0)
    expect(Date.now() - started).toBeLessThan(5000)
  }, 20000)

  test('hook window reports a live parent process that has a window', async () => {
    const [exe, args] = hookCommand('window')
    const started = Date.now()
    const { code } = await run(exe, args, JSON.stringify({ session_id: 'win', hook_event_name: 'UserPromptSubmit' }))
    expect(code).toBe(0)
    expect(Date.now() - started).toBeLessThan(3000) // the PowerShell version took several seconds
    const pid = hub.sessions.get('win')?.windowPid
    if (pid) expect(() => process.kill(pid, 0)).not.toThrow() // headless CI may have no window among the parents
  }, 20000)

  test('the status line command prints the line and feeds the usage ring', async () => {
    const cmd = JSON.parse(fs.readFileSync(settings, 'utf8')).statusLine.command as string
    const args = cmd.match(/"[^"]*"|\S+/g)!.slice(1).map(a => a.replace(/^"|"$/g, ''))
    const { out } = await run('curl.exe', args, JSON.stringify({ model: { display_name: 'Opus' }, rate_limits: { five_hour: { used_percentage: 12, resets_at: 1 } } }))
    expect(out).toBe('Opus · 5h 12%')
    expect(hub.usage.fiveHour?.used).toBe(12)
  }, 20000)

  test('pebble CLI: notify, and ask waits for the answer', async () => {
    const appdata = path.join(dir, 'appdata')
    fs.mkdirSync(path.join(appdata, 'Pebble'), { recursive: true })
    fs.writeFileSync(path.join(appdata, 'Pebble', 'hook-token'), TOKEN)
    fs.writeFileSync(path.join(appdata, 'Pebble', 'settings.json'), JSON.stringify({ server: { port: PORT } }))
    const env = { ...process.env, APPDATA: appdata }
    const cli = path.join(__dirname, '..', 'cli', 'pebble.cmd')

    expect((await run('cmd.exe', ['/c', cli, 'notify', 'Build done', '--title', 'CI'], '', env)).code).toBe(0)
    expect(hub.sessions.get('cli:CI')?.detail).toBe('Build done')

    const asked = new Promise<string>(r => hub.once('question', r))
    const r = run('cmd.exe', ['/c', cli, 'ask', 'Ship it?', '-Options', 'Yes,No'], '', env)
    const id = await asked
    expect(hub.sessions.get(id)?.ask).toMatchObject({ kind: 'question', questions: [{ question: 'Ship it?', options: [{ label: 'Yes' }, { label: 'No' }] }] })
    hub.answer(id, { kind: 'question', answers: { 'Ship it?': 'Yes' } })
    const { code, out } = await r
    expect(code).toBe(0)
    expect(out).toBe('Yes')
  }, 30000)
})
