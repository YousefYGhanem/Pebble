import zlib from 'node:zlib'
import { test, expect } from 'vitest'
import { readFrames, toHookEvents } from '../app/main/agents/dsh'
import { usageFromLines } from '../app/main/agents/codex-usage'
import { apply, type Session } from '../app/shared/state'

/** A DeepSeek Harness log: JSON lines appended as separate zstd frames. */
const frames = (...groups: object[][]) => Buffer.concat(groups.map(g => zlib.zstdCompressSync(Buffer.from(g.map(o => JSON.stringify(o)).join('\n') + '\n'))))

test('DeepSeek Harness: its session log becomes the same session as any agent, with tokens', () => {
  const log = frames(
    [{ type: 'session', id: 'abc', cwd: 'C:\\work\\shop' }],
    [{ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'fix the cart' }] } }, { type: 'turn/start', data: { turn: 1 } }],
    [{ type: 'tool/call', data: { name: 'run_code', arguments: '{}' } }, { type: 'tool/ptc-dispatch-start', data: { name: 'read', arguments: { path: 'C:\\work\\shop\\cart.js' } } }],
    [{ type: 'tool/ptc-dispatch', data: { name: 'read', isError: false } }, { type: 'approval/asked', data: { toolName: 'write' } }],
    [{ type: 'approval/decided', data: { outcome: 'allowed-once' } }, { type: 'assistant/message', time: Date.now(), data: { message: { content: [{ type: 'reasoning', text: 'hm' }, { type: 'text', text: 'Fixed the total.' }] }, usage: { totalTokens: 1200 } } }],
    [{ type: 'turn/end', data: { reason: { kind: 'completed' } } }]
  )
  const s = { offset: 0, id: '', answer: '', tokens: [] as { time: number; n: number }[] }
  const r = readFrames(log)
  expect(r.next).toBe(log.length)
  const states: string[] = []
  let session: Session | undefined
  for (const e of toHookEvents(r.events, s)) { session = apply(session, e, 'dsh') ?? undefined; states.push(session!.status) }
  expect(session).toMatchObject({ id: 'abc', agent: 'dsh', project: 'shop', status: 'done', prompt: 'fix the cart', message: 'Fixed the total.' })
  expect(session!.steps.map(x => [x.kind, x.text])).toEqual([['read', 'read cart.js']])
  expect(states).toContain('question') // it asked for permission in its own window
  expect(s.tokens.map(t => t.n)).toEqual([1200])

  // a frame still being written is left for next time; nothing is read twice
  const cut = readFrames(log.subarray(0, log.length - 5))
  expect(cut.next).toBeLessThan(log.length)
  expect(readFrames(log, cut.next).events.map(e => e.type)).toEqual(['turn/end'])
  // a turn that fails ends the session with its reason
  const failed = toHookEvents(readFrames(frames([{ type: 'turn/end', data: { reason: { kind: 'error', error: { message: 'Insufficient Balance' } } } }])).events, s)
  expect(failed).toMatchObject([{ hook_event_name: 'StopFailure', error: 'Insufficient Balance' }])
})

test('Codex: the session and weekly windows from the newest token_count event', () => {
  const line = (used: number) => JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: {}, rate_limits: {
    primary: { used_percent: used, window_minutes: 300, resets_at: 1800000000 },
    secondary: { used_percent: 40, window_minutes: 10080, resets_at: 1800500000 } } } })
  const text = [line(10), JSON.stringify({ type: 'response_item' }), line(23.5), '{"type":"event_msg","payload":{"type":"agent_message"}}'].join('\n')
  expect(usageFromLines(text)).toEqual({ fiveHour: { used: 23.5, resetsAt: 1800000000000 }, sevenDay: { used: 40, resetsAt: 1800500000000 } })
  expect(usageFromLines('{"type":"session_meta"}')).toBeNull()
})
