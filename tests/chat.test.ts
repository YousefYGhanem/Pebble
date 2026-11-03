import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from 'vitest'
import { Chat } from '../app/main/ai/chat'
import { transcript, type Ask } from '../app/main/ai/providers'
import type { ProviderId } from '../app/shared/chat'

const vault = { encrypt: (s: string) => 'enc:' + Buffer.from(s).toString('base64'), decrypt: (s: string) => Buffer.from(s.slice(4), 'base64').toString() }

function setup(provider: ProviderId, ask: (a: Ask) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-chat-'))
  return { dir, chat: new Chat(dir, vault, () => ({ provider, model: '' }), ask) }
}

test('an answer streams in; the key is stored encrypted and handed only to its provider', async () => {
  let got: Ask | undefined
  const { dir, chat } = setup('deepseek', async a => { got = a; a.onText('Hel'); a.onText('lo') })
  expect(chat.state().ready).toBe(false) // no key yet
  chat.setKey('deepseek', ' sk-123 ')
  expect(fs.readFileSync(path.join(dir, 'keys.secrets'), 'utf8')).not.toContain('sk-123')
  expect(chat.state().ready).toBe(true)
  await chat.send('hi')
  expect(got).toMatchObject({ provider: 'deepseek', model: 'deepseek-chat', key: 'sk-123', messages: [{ role: 'user', text: 'hi' }] })
  expect(chat.messages.map(m => [m.role, m.text])).toEqual([['user', 'hi'], ['assistant', 'Hello']])
  expect(chat.busy).toBe(false)
})

test('a failure shows its reason; stopping is not a failure', async () => {
  const { chat } = setup('claude-cli', async () => { throw new Error('claude: not logged in') })
  await chat.send('hi')
  expect(chat.error).toBe('claude: not logged in')
  expect(chat.messages.map(m => m.role)).toEqual(['user']) // no empty answer left behind

  const s = setup('claude-cli', a => new Promise((_, reject) => a.signal.addEventListener('abort', () => reject(new Error('killed')))))
  const p = s.chat.send('long one')
  s.chat.stop()
  await p
  expect(s.chat.error).toBeUndefined()
  expect(() => s.chat.setKey('claude-cli', 'x')).toThrow()
})

test('the CLIs get the conversation written out', () => {
  expect(transcript({ system: 'Be Pip.', messages: [{ role: 'user', text: 'a', at: 0 }, { role: 'assistant', text: 'b', at: 0 }, { role: 'user', text: 'c', at: 0 }] }))
    .toBe('Be Pip.\n\nUser: a\n\nYou: b\n\nUser: c\n\nYou:')
})
