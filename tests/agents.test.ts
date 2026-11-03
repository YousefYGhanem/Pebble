import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, test, expect } from 'vitest'
import * as normalize from '../app/main/agents/normalize'
import * as gemini from '../app/main/agents/gemini'
import * as cursor from '../app/main/agents/cursor'
import * as opencode from '../app/main/agents/opencode'
import * as aider from '../app/main/agents/aider'
import * as terminals from '../app/main/agents/terminals'
import { readBlock, setBlock } from '../app/main/agents/config'
import { apply, providerOf } from '../app/shared/state'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-agents-'))
const o = { port: 47901, token: 'a'.repeat(48), nativeExe: 'C:\\Pebble\\pebble-native.exe' }

test('Gemini events become the shared shape', () => {
  const b = { session_id: 'g', cwd: 'C:/code/site' }
  expect(normalize.gemini({ ...b, hook_event_name: 'BeforeAgent', prompt: 'hi' })).toMatchObject({ hook_event_name: 'UserPromptSubmit', prompt: 'hi', cwd: 'C:/code/site' })
  expect(normalize.gemini({ ...b, hook_event_name: 'BeforeTool', tool_name: 'run_shell_command', tool_input: { command: 'npm test' } })).toMatchObject({ hook_event_name: 'PreToolUse', tool_name: 'run_shell_command' })
  expect(normalize.gemini({ ...b, hook_event_name: 'AfterAgent', prompt_response: 'Done.' })).toMatchObject({ hook_event_name: 'Stop', last_assistant_message: 'Done.' })
  expect(normalize.gemini({ ...b, hook_event_name: 'Notification', notification_type: 'ToolPermission', message: 'Allow?', details: { tool_name: 'write_file' } }))
    .toMatchObject({ hook_event_name: 'PermissionRequest', tool_name: 'write_file' })
  expect(normalize.gemini({ ...b, hook_event_name: 'PreCompress' })).toBeNull()
  // and the reducer understands Gemini's tools
  let s = apply(undefined, normalize.gemini({ ...b, hook_event_name: 'BeforeTool', tool_name: 'write_file', tool_input: { file_path: 'a.html', content: '<p>' } })!, 'gemini')!
  expect(s).toMatchObject({ project: 'site', agent: 'gemini', steps: [{ kind: 'edit' }], diff: { added: ['<p>'] } })
  s = apply(s, normalize.gemini({ ...b, hook_event_name: 'BeforeTool', tool_name: 'google_web_search', tool_input: { query: 'x' } })!, 'gemini')!
  expect(s.steps[1]!.kind).toBe('web')
})

test('Cursor: conversation = session, its last answer arrives with stop', () => {
  const last = new Map<string, string>()
  const b = { conversation_id: 'c1', workspace_roots: ['C:/code/app'] }
  expect(normalize.cursor({ ...b, hook_event_name: 'beforeSubmitPrompt', prompt: 'fix' }, last)).toMatchObject({ session_id: 'c1', hook_event_name: 'UserPromptSubmit', cwd: 'C:/code/app' })
  expect(normalize.cursor({ ...b, hook_event_name: 'afterFileEdit', file_path: 'x.ts', edits: [{ old_string: 'a', new_string: 'b' }] }, last))
    .toMatchObject({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'x.ts', old_string: 'a', new_string: 'b' } })
  expect(normalize.cursor({ ...b, hook_event_name: 'afterAgentResponse', text: 'All fixed.' }, last)).toBeNull()
  expect(normalize.cursor({ ...b, hook_event_name: 'stop', status: 'completed' }, last)).toMatchObject({ hook_event_name: 'Stop', last_assistant_message: 'All fixed.' })
  expect(normalize.cursor({ ...b, hook_event_name: 'stop', status: 'error' }, last)).toMatchObject({ hook_event_name: 'StopFailure' })
})

test('providers are read from model names', () => {
  expect(providerOf('deepseek-chat')).toBe('DeepSeek')
  expect(providerOf('deepseek/deepseek-reasoner')).toBe('DeepSeek')
  expect(providerOf('Opus 5.5')).toBeUndefined()
})

describe('installers keep your own config exactly', () => {
  test('Gemini CLI', () => {
    const file = path.join(tmp(), 'settings.json')
    const mine = { theme: 'Dracula', hooks: { BeforeTool: [{ matcher: 'write_file', hooks: [{ name: 'lint', type: 'command', command: 'lint.sh' }] }] } }
    fs.writeFileSync(file, JSON.stringify(mine))
    gemini.install(o, file)
    expect(gemini.installed(o, file)).toBe(true)
    const hook = JSON.parse(fs.readFileSync(file, 'utf8')).hooks.AfterAgent[0].hooks[0]
    expect(hook).toMatchObject({ name: 'pebble', type: 'command', timeout: 5000 })
    expect(hook.command).toBe(`"C:/Pebble/pebble-native.exe" hook relay --agent gemini --port 47901 --token ${o.token}`)
    gemini.remove(file)
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(mine)
  })

  test('Cursor: beforeSubmitPrompt answers continue; your hooks stay', () => {
    const file = path.join(tmp(), 'hooks.json')
    const mine = { version: 1, hooks: { afterFileEdit: [{ command: './format.sh' }] } }
    fs.writeFileSync(file, JSON.stringify(mine))
    cursor.install(o, file)
    expect(cursor.installed(o, file)).toBe(true)
    const c = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(c.hooks.beforeSubmitPrompt[0].command).toContain('--reply continue')
    expect(c.hooks.afterFileEdit).toHaveLength(2)
    expect(c.hooks.beforeShellExecution).toBeUndefined() // never a permission hook: Cursor keeps asking itself
    cursor.remove(file)
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(mine)
  })

  test('OpenCode: one plugin file', () => {
    const file = path.join(tmp(), 'plugins', 'pebble.js')
    opencode.install(o, file)
    expect(opencode.installed(o, file)).toBe(true)
    expect(opencode.installed({ ...o, port: 1 }, file)).toBe(false)
    opencode.remove(file)
    expect(fs.existsSync(file)).toBe(false)
  })

  test('Aider: a marked block; your own notifications-command wins', () => {
    const dir = tmp(), file = path.join(dir, '.aider.conf.yml')
    fs.writeFileSync(file, 'model: deepseek/deepseek-chat\ndark-mode: true\n')
    expect(aider.install(o, file)).toBe(true)
    expect(aider.installed(o, file)).toBe(true)
    expect(fs.readFileSync(file, 'utf8')).toContain("notifications-command: '\"C:/Pebble/pebble-native.exe\" cli notify")
    aider.remove(file)
    expect(fs.readFileSync(file, 'utf8')).toBe('model: deepseek/deepseek-chat\ndark-mode: true\n')

    const own = path.join(dir, 'own.yml')
    fs.writeFileSync(own, 'notifications-command: say done\n')
    expect(aider.install(o, own)).toBe(false)
    expect(fs.readFileSync(own, 'utf8')).toBe('notifications-command: say done\n')
  })

  test('marked blocks: replaced in place, removed cleanly, CRLF kept', () => {
    const file = path.join(tmp(), 'profile.ps1')
    fs.writeFileSync(file, 'Set-Alias ll ls\r\n')
    setBlock(file, 'one', 'n')
    setBlock(file, 'two', 'n')
    const text = fs.readFileSync(file, 'utf8')
    expect(text.match(/>>> pebble >>>/g)).toHaveLength(1)
    expect(readBlock(file)).toContain('two')
    expect(text.includes('\r\ntwo\r\n')).toBe(true)
    setBlock(file, null, 'n')
    expect(fs.readFileSync(file, 'utf8')).toBe('Set-Alias ll ls\r\n')
  })
})

describe.skipIf(process.platform !== 'win32')('shell snippets are valid code', () => {
  const t = { nativeExe: o.nativeExe, minSeconds: 10 }

  test('bash: parses, and only notifies for long commands', () => {
    const r = spawnSync('bash', ['-n'], { input: terminals.snippet('bash', t), encoding: 'utf8' })
    expect(r.stderr).toBe('')
    expect(terminals.snippet('bash', t)).toContain('"/c/Pebble/pebble-native.exe" cli notify')
  })

  test('Windows PowerShell: parses without errors', () => {
    const file = path.join(tmp(), 'snippet.ps1')
    fs.writeFileSync(file, terminals.snippet('powershell', t))
    const r = spawnSync('powershell.exe', ['-NoProfile', '-Command',
      `$e = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$e); $e.Count`], { encoding: 'utf8' })
    expect(r.stdout.trim()).toBe('0')
    expect(/^[\x00-\x7f]*$/.test(terminals.snippet('powershell', t))).toBe(true) // ASCII: PowerShell 5.1 reads profiles in the old code page
  }, 30000)

  test('install puts the block in the profile file; remove takes it out', () => {
    const docs = tmp()
    terminals.install('powershell', t, docs)
    expect(terminals.installed('powershell', docs)).toBe(true)
    terminals.remove('powershell', docs)
    expect(terminals.installed('powershell', docs)).toBe(false)
  })
})

test('the OpenCode plugin turns OpenCode events into hook calls', async () => {
  const file = path.join(tmp(), 'pebble.mjs')
  fs.writeFileSync(file, opencode.plugin(o))
  const sent: Record<string, unknown>[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (_url: string, init: { body: string }) => { sent.push(JSON.parse(init.body)); return new Response('{}') }) as typeof fetch
  try {
    const mod = await import(/* @vite-ignore */ 'file:///' + file.replace(/\\/g, '/'))
    const hooks = await mod.Pebble({ directory: 'C:/code/api' })
    await hooks['chat.message']({ sessionID: 's1' }, { parts: [{ type: 'text', text: 'add a route' }] })
    await hooks['tool.execute.before']({ sessionID: 's1', tool: 'bash' }, { args: { command: 'npm test' } })
    await hooks.event({ event: { type: 'message.updated', properties: { info: { id: 'm1', sessionID: 's1', role: 'assistant', providerID: 'deepseek', modelID: 'deepseek-chat' } } } })
    await hooks.event({ event: { type: 'message.part.updated', properties: { part: { sessionID: 's1', messageID: 'm1', type: 'text', text: 'Route added.' } } } })
    await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 's1' } } })
  } finally { globalThis.fetch = realFetch }
  expect(sent.map(e => e.hook_event_name)).toEqual(['UserPromptSubmit', 'PreToolUse', 'Stop'])
  expect(sent[2]).toMatchObject({ session_id: 's1', cwd: 'C:/code/api', last_assistant_message: 'Route added.', _model: 'deepseek/deepseek-chat' })
  expect(typeof sent[0]!._pid).toBe('number')
})
