// The native helper's relay hook (Gemini CLI, Cursor) and MCP server against a live hub (Windows, after build:native).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Hub } from '../app/main/agents/hub'

const TOKEN = 'b'.repeat(48)
const PORT = 47992
const EXE = path.join(__dirname, '..', 'native', 'out', 'pebble-native.exe')
let hub: Hub

function run(args: string[], stdin: string, env: NodeJS.ProcessEnv = process.env): Promise<{ code: number | null; out: string }> {
  return new Promise(resolve => {
    const child = spawn(EXE, args, { env, windowsHide: true })
    let out = ''
    child.stdout.setEncoding('utf8').on('data', d => (out += d))
    child.on('close', code => resolve({ code, out: out.trim() }))
    child.stdin.end(stdin)
  })
}
const relay = (agent: string, extra: string[] = [], port = PORT) => ['hook', 'relay', '--agent', agent, '--port', String(port), '--token', TOKEN, ...extra]

describe.skipIf(process.platform !== 'win32' || !fs.existsSync(EXE))('relay hook and MCP server', () => {
  beforeAll(async () => { hub = new Hub(TOKEN, { answerPermissions: () => true }); await hub.listen(PORT) })
  afterAll(() => hub.close())

  test('relay: a Gemini event reaches the hub with the agent\'s pid; the hook prints {}', async () => {
    const pid = new Promise<[string, number]>(r => hub.once('pid', (id, p) => r([id, p])))
    const { code, out } = await run(relay('gemini'), JSON.stringify({ session_id: 'gem', cwd: 'C:/code/site', hook_event_name: 'BeforeAgent', prompt: 'build the page' }))
    expect(code).toBe(0)
    expect(out).toBe('{}')
    expect(hub.sessions.get('gem')).toMatchObject({ agent: 'gemini', status: 'running', prompt: 'build the page', project: 'site' })
    const [id, p] = await pid
    expect(id).toBe('gem')
    expect(p).toBeGreaterThan(0)
  })

  test('relay: Cursor\'s beforeSubmitPrompt always gets {"continue":true}, also with Pebble off', async () => {
    const body = JSON.stringify({ conversation_id: 'cur', hook_event_name: 'beforeSubmitPrompt', prompt: 'hi', workspace_roots: ['C:/code/app'] })
    expect((await run(relay('cursor', ['--reply', 'continue']), body)).out).toBe('{"continue":true}')
    expect(hub.sessions.get('cur')).toMatchObject({ agent: 'cursor', project: 'app' })
    const started = Date.now()
    const off = await run(relay('cursor', ['--reply', 'continue'], 47998), body)
    expect(off).toEqual({ code: 0, out: '{"continue":true}' })
    expect(Date.now() - started).toBeLessThan(5000)
  })

  test('MCP: initialize, list tools, notify and ask_user through Pebble', async () => {
    const appdata = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-mcp-'))
    fs.mkdirSync(path.join(appdata, 'Pebble'))
    fs.writeFileSync(path.join(appdata, 'Pebble', 'hook-token'), TOKEN)
    fs.writeFileSync(path.join(appdata, 'Pebble', 'settings.json'), JSON.stringify({ server: { port: PORT } }))
    const asked = new Promise<string>(r => hub.once('question', r))
    const lines = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'notify', arguments: { text: 'Migration done', title: 'db' } } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'ask_user', arguments: { question: 'Drop the old table?', options: ['Yes', 'No'] } } }
    ].map(l => JSON.stringify(l)).join('\n') + '\n'
    const result = run(['mcp'], lines, { ...process.env, APPDATA: appdata })
    const id = await asked
    // notify and ask_user run side by side: the notification may land just after the question
    for (let i = 0; i < 40 && !hub.sessions.has('cli:db'); i++) await new Promise(r => setTimeout(r, 50))
    expect(hub.sessions.get('cli:db')?.detail).toBe('Migration done')
    hub.answer(id, { kind: 'question', answers: { 'Drop the old table?': 'No' } })
    const replies = Object.fromEntries((await result).out.split('\n').map(l => JSON.parse(l)).map(r => [r.id, r]))
    expect(replies[1].result.serverInfo.name).toBe('pebble')
    expect(replies[2].result.tools.map((t: { name: string }) => t.name)).toEqual(['notify', 'ask_user'])
    expect(replies[3].result).toMatchObject({ isError: false, content: [{ type: 'text', text: 'Shown to the user.' }] })
    expect(replies[4].result.content[0].text).toBe('No')
  }, 20000)
})
