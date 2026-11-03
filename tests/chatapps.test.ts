import { test, expect } from 'vitest'
import { applyChat, asksYou, readChat } from '../app/shared/chatapps'
import { ChatApps } from '../app/main/chatapps'
import { Hub } from '../app/main/agents/hub'
import { textOf, transcript } from '../app/main/ai/providers'

test('a question at the end of an answer asks you; a long paragraph ending in "?" does not', () => {
  expect(asksYou('Here is the plan.\n\nShould I go ahead?')).toBe(true)
  expect(asksYou('Done.')).toBe(false)
  expect(asksYou('x'.repeat(250) + '?')).toBe(false)
})

test('a chat goes running while the answer is written, then done once', () => {
  const u = { app: 'claude.ai', title: 'Trip', answer: '' }
  let r = applyChat(undefined, 'tab:1', { ...u, streaming: false, answer: 'old answer' }, 1)
  expect(r.session).toMatchObject({ agent: 'web', status: 'done', replyable: true }) // what was there already
  expect(r.finished).toBe(false)
  r = applyChat(r.session, 'tab:1', { ...u, streaming: true, answer: 'New' }, 2)
  expect(r.session).toMatchObject({ status: 'running', startedAt: 2 })
  r = applyChat(r.session, 'tab:1', { ...u, streaming: false, answer: 'New answer' }, 3)
  expect(r).toMatchObject({ finished: true, session: { status: 'done', message: 'New answer' } })
  expect(applyChat(r.session, 'tab:1', { ...u, streaming: false, answer: 'New answer' }, 4).finished).toBe(false)
})

test("a desktop app's last answer: the texts before its last Copy button", () => {
  const items = [
    { t: 'text', n: 'What is 2+2?' }, { t: 'button', n: 'Edit' },
    { t: 'text', n: 'It is' }, { t: 'text', n: '4.' }, { t: 'button', n: 'Copy' }, { t: 'button', n: 'Retry' },
    { t: 'input', n: 'Reply to Claude' }, { t: 'text', n: 'Opus 5.5' }
  ]
  expect(readChat(items)).toEqual({ streaming: false, answer: 'It is\n4.' })
  expect(readChat([...items.slice(0, 4), { t: 'button', n: 'Stop response' }, { t: 'input', n: '' }]).streaming).toBe(true)
})

test('the extension: wrong key refused; your reply rides back once on its next report', () => {
  const hub = new Hub('a'.repeat(48), { answerPermissions: () => false })
  const apps = new ChatApps(hub, 'k'.repeat(16), { native: { available: false, request: async () => null as never }, followed: () => [], problem: () => {} })
  const report = { tab: '7', site: 'chatgpt', title: 'Plans', streaming: false, answer: 'Want the long version?' }
  expect(apps.fromExtension('wrong', report)).toBeNull()
  expect(apps.fromExtension('k'.repeat(16), report)).toEqual({})
  const s = hub.sessions.get('tab:7')!
  expect(s).toMatchObject({ project: 'ChatGPT', replyable: true })
  expect(hub.reply('tab:7', 'Yes please')).toBe(true)
  expect(hub.sessions.get('tab:7')?.detail).toBe('Sent: Yes please')
  expect(apps.fromExtension('k'.repeat(16), report)).toEqual({ reply: 'Yes please' })
  expect(apps.fromExtension('k'.repeat(16), report)).toEqual({}) // never twice
  apps.fromExtension('k'.repeat(16), { ...report, closed: true })
  expect(hub.sessions.has('tab:7')).toBe(false)
  hub.close()
})

test('a window shown to Pip: its title and OCR text come first; the CLIs are told where the picture is', () => {
  const m = { role: 'user' as const, text: 'What is wrong?', at: 0, look: { title: 'Build failed', process: 'WindowsTerminal', image: 'look-1.png', text: 'error TS2304' } }
  expect(textOf(m)).toBe('[I am showing you a window: "Build failed" (WindowsTerminal). Its text, read by OCR:\nerror TS2304]\n\nWhat is wrong?')
  expect(transcript({ system: 'S', messages: [m] }, ' Picture: {file}.')).toContain('(WindowsTerminal). Picture: look-1.png. Its text')
})
