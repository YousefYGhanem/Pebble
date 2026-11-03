import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from 'vitest'
import { install, installed, remove, EVENTS } from '../app/main/agents/codex'

const TOKEN = 'e'.repeat(48)

test('Codex: async curl hooks on every event; the user\'s own hooks survive install and remove', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-')), 'hooks.json')
  const mine = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'notify-send done' }] }] } }
  fs.writeFileSync(file, JSON.stringify(mine))
  install(47901, TOKEN, file)
  expect(installed(47901, TOKEN, file)).toBe(true)
  const hooks = JSON.parse(fs.readFileSync(file, 'utf8')).hooks
  expect(Object.keys(hooks)).toEqual(expect.arrayContaining([...EVENTS]))
  expect(hooks.PreToolUse[0].hooks[0]).toMatchObject({ type: 'command', async: true, timeout: 5 })
  expect(hooks.PreToolUse[0].hooks[0].command).toContain('agent=codex')
  remove(file)
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(mine)
})
