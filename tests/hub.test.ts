import { afterEach, test, expect } from 'vitest'
import { Hub } from '../app/main/agents/hub'

const TOKEN = 'c'.repeat(48)
// a fresh port per test: fetch keeps sockets alive, and a POST on a socket the last server closed is not retried
let PORT = 47970
let hub: Hub | undefined
afterEach(() => { hub?.close(); PORT++ })

const url = (p: string) => `http://127.0.0.1:${PORT}${p}`
const post = (p: string, body: unknown, token = TOKEN) =>
  fetch(url(p), { method: 'POST', headers: { 'X-Pebble-Token': token }, body: JSON.stringify(body) })
const start = async (answerPermissions = true) => { hub = new Hub(TOKEN, { answerPermissions: () => answerPermissions }); await hub.listen(PORT); return hub }
const asked = (h: Hub) => new Promise<string>(r => h.once('question', r))

test('rejects a wrong token and bad bodies', async () => {
  await start()
  expect((await post('/hook', { session_id: 'x', hook_event_name: 'Stop' }, 'd'.repeat(48))).status).toBe(403)
  expect((await post('/hook', { nope: 1 })).status).toBe(400)
})

test('a permission is held until the island answers', async () => {
  const h = await start(), q = asked(h)
  const reply = post('/hook', { session_id: 's', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'ls' }, permission_suggestions: [{ type: 'addRules' }] })
  expect(await q).toBe('s')
  expect(h.sessions.get('s')?.ask).toMatchObject({ kind: 'permission', canAlways: true })
  h.answer('s', { kind: 'permission', choice: 'always' })
  expect(await (await reply).json()).toEqual({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow', updatedPermissions: [{ type: 'addRules' }] } } })
  expect(h.sessions.get('s')?.status).toBe('running')
  expect(h.sessions.get('s')?.ask).toBeUndefined()
})

test('AskUserQuestion is answered with the questions echoed back plus the answers', async () => {
  const h = await start(), q = asked(h)
  const input = { questions: [{ question: 'Which?', header: 'Pick', options: [{ label: 'A' }, { label: 'B' }], multiSelect: false }] }
  const reply = post('/hook', { session_id: 'q', hook_event_name: 'PermissionRequest', tool_name: 'AskUserQuestion', tool_input: input })
  await q
  expect(h.sessions.get('q')?.ask?.kind).toBe('question')
  h.answer('q', { kind: 'question', answers: { 'Which?': 'B' } })
  const body = await (await reply).json()
  expect(body.hookSpecificOutput.decision).toEqual({ behavior: 'allow', updatedInput: { ...input, answers: { 'Which?': 'B' } } })
})

test('a plan sent back carries your feedback; approving echoes the plan', async () => {
  const h = await start()
  let q = asked(h)
  let reply = post('/hook', { session_id: 'p', hook_event_name: 'PermissionRequest', tool_name: 'ExitPlanMode', tool_input: { plan: '# Plan' } })
  await q
  h.answer('p', { kind: 'plan', approve: false, feedback: 'use Mollie' })
  expect((await (await reply).json()).hookSpecificOutput.decision).toEqual({ behavior: 'deny', message: 'use Mollie' })
  q = asked(h)
  reply = post('/hook', { session_id: 'p', hook_event_name: 'PermissionRequest', tool_name: 'ExitPlanMode', tool_input: { plan: '# Plan' } })
  await q
  h.answer('p', { kind: 'plan', approve: true })
  expect((await (await reply).json()).hookSpecificOutput.decision).toEqual({ behavior: 'allow', updatedInput: { plan: '# Plan' } })
})

test('answered in the terminal: the next event releases the held request with no decision', async () => {
  const h = await start(), q = asked(h)
  const reply = post('/hook', { session_id: 't', hook_event_name: 'PermissionRequest', tool_name: 'Bash' })
  await q
  await post('/hook', { session_id: 't', hook_event_name: 'PostToolUse', tool_name: 'Bash' })
  expect(await (await reply).json()).toEqual({})
  expect(h.answer('t', { kind: 'permission', choice: 'allow' })).toBe(false)
})

test('with answering off, a permission gets no decision right away', async () => {
  const h = await start(false)
  const r = await post('/hook', { session_id: 's', hook_event_name: 'PermissionRequest', tool_name: 'Bash' })
  expect(await r.json()).toEqual({})
  expect(h.sessions.get('s')?.status).toBe('question')
})

test('reply: the Stop hook waits; your text wakes it; typing in the terminal ends the wait', async () => {
  const h = await start()
  await post('/hook', { session_id: 'r', hook_event_name: 'Stop', last_assistant_message: 'All done.' })
  expect(h.sessions.get('r')?.message).toBe('All done.')
  let wait = fetch(url('/wait?session=r'), { headers: { 'X-Pebble-Token': TOKEN } })
  await new Promise(res => setTimeout(res, 50))
  expect(h.sessions.get('r')?.replyable).toBe(true)
  expect(h.reply('r', 'now add tests')).toBe(true)
  expect(await (await wait).json()).toEqual({ reply: 'now add tests' })
  expect(h.sessions.get('r')?.status).toBe('running')

  wait = fetch(url('/wait?session=r'), { headers: { 'X-Pebble-Token': TOKEN } })
  await new Promise(res => setTimeout(res, 50))
  await post('/hook', { session_id: 'r', hook_event_name: 'UserPromptSubmit', prompt: 'typed here' })
  expect(await (await wait).json()).toEqual({})
  expect(h.sessions.get('r')?.replyable).toBe(false)
})

test('status line: usage for the ring, model and context per session, and the line to print', async () => {
  const h = await start()
  await post('/hook', { session_id: 'u', hook_event_name: 'UserPromptSubmit', prompt: 'x' })
  const r = await post('/status', { session_id: 'u', model: { display_name: 'Opus' }, context_window: { used_percentage: 41.6 }, rate_limits: { five_hour: { used_percentage: 23, resets_at: 1800000000 }, seven_day: { used_percentage: 61, resets_at: 1800500000 } } })
  expect(await r.text()).toBe('Opus · ctx 42% · 5h 23%')
  expect(h.usage.fiveHour).toEqual({ used: 23, resetsAt: 1800000000000 })
  expect(h.sessions.get('u')).toMatchObject({ model: 'Opus', context: 41.6 })
})

test('pebble ask waits for your answer; pebble notify shows a message', async () => {
  const h = await start(), q = asked(h)
  const reply = post('/ask', { question: 'Ship it?', options: ['Yes', 'No'], title: 'Deploy' })
  const id = await q
  expect(h.sessions.get(id)).toMatchObject({ agent: 'cli', project: 'Deploy', status: 'question' })
  h.answer(id, { kind: 'question', answers: { 'Ship it?': 'Yes' } })
  expect(await (await reply).json()).toEqual({ answer: 'Yes' })
  expect(h.sessions.has(id)).toBe(false)

  const notified = new Promise(r => h.once('notify', r))
  expect((await post('/notify', { text: 'Build done', title: 'CI' })).status).toBe(200)
  expect(await notified).toMatchObject({ title: 'CI', body: 'Build done' })
  expect(h.sessions.get('cli:CI')).toMatchObject({ status: 'done', detail: 'Build done' })
})

test('the window that runs a session is remembered for "jump to terminal"', async () => {
  const h = await start()
  await post('/window', { session_id: 'w', pid: 4242 })
  expect(h.sessions.get('w')?.windowPid).toBe(4242)
  await post('/hook', { session_id: 'w', hook_event_name: 'UserPromptSubmit', prompt: 'hi', cwd: 'C:\\code\\app' })
  expect(h.sessions.get('w')).toMatchObject({ windowPid: 4242, project: 'app' })
})
