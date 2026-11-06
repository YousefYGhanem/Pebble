import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from 'vitest'
import { install, installed, remove, EVENTS } from '../app/main/agents/claude'

const TOKEN = 'a'.repeat(48)
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-'))
const opts = (_dir?: string) => ({ port: 47901, token: TOKEN, nativeExe: 'C:\\Pebble\\pebble-native.exe' })

test('the PowerShell hooks of an older Pebble are replaced, not kept next to the new ones', () => {
  const file = path.join(tmp(), 'settings.json')
  const old = (name: string) => ({ hooks: [{ type: 'command', command: `powershell.exe -NoProfile -File "C:/x/Pebble/hooks/${name}"` }] })
  fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [old('pebble-reply.ps1')], UserPromptSubmit: [old('pebble-window.ps1')] } }))
  install(opts(), file)
  expect(fs.readFileSync(file, 'utf8')).not.toContain('.ps1')
  remove(file)
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({})
})

test('install and remove keep the user\'s own settings, hooks and status line exactly', () => {
  const dir = tmp(), file = path.join(dir, 'settings.json')
  const mine = {
    model: 'opus',
    statusLine: { type: 'command', command: '~/.claude/my-status.sh' },
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }], PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'lint' }] }] }
  }
  fs.writeFileSync(file, JSON.stringify(mine))

  install(opts(dir), file)
  expect(installed(opts(), file)).toBe(true)
  expect(installed({ ...opts(), token: 'b'.repeat(48) }, file)).toBe(false)
  expect(installed({ ...opts(), nativeExe: 'D:/elsewhere.exe' }, file)).toBe(false) // the app moved: install again
  const after = JSON.parse(fs.readFileSync(file, 'utf8'))
  expect(Object.keys(after.hooks)).toEqual(expect.arrayContaining([...EVENTS]))
  expect(after.hooks.PermissionRequest[0].hooks[0].timeout).toBe(305)
  // your status line runs inside Pebble's (which reads the usage), kept exactly in base64
  expect(after.statusLine.command).toBe('"C:/Pebble/pebble-native.exe" hook status --port 47901 --token ' + TOKEN + ' --then-b64 ' + Buffer.from('~/.claude/my-status.sh').toString('base64'))
  const reply = after.hooks.Stop.flatMap((g: { hooks: { command?: string; asyncRewake?: boolean }[] }) => g.hooks).find((h: { command?: string }) => h.command?.includes(' hook reply '))
  expect(reply.asyncRewake).toBe(true)
  expect(reply.command).toBe('"C:/Pebble/pebble-native.exe" hook reply --port 47901 --token ' + TOKEN)

  install(opts(dir), file) // twice: no duplicates, and yours is not wrapped twice
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop).toHaveLength(3) // yours, http, reply
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).statusLine).toEqual(after.statusLine)

  remove(file)
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(mine)
  expect(fs.existsSync(file + '.pebble-backup')).toBe(true)
})

test('without a status line of your own, Pebble adds one and removes it again', () => {
  const dir = tmp(), file = path.join(dir, 'settings.json')
  install(opts(dir), file)
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).statusLine.command).toBe('"C:/Pebble/pebble-native.exe" hook status --port 47901 --token ' + TOKEN)
  remove(file)
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({})
})

test('a settings file that is not valid JSON is never overwritten', () => {
  const dir = tmp(), file = path.join(dir, 'settings.json')
  fs.writeFileSync(file, '{ broken')
  expect(() => install(opts(dir), file)).toThrow(/Cannot read/)
  expect(fs.readFileSync(file, 'utf8')).toBe('{ broken')
})
