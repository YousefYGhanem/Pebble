import { test, expect } from 'vitest'
import { RectSpring, Spring, contentOpacity, jelly } from '../app/renderer/island/spring'
import { modeFor, rank, sizeFor } from '../app/renderer/island/layout'
import { DEFAULTS } from '../app/shared/settings'
import type { Session } from '../app/shared/state'

const run = (s: Spring, response: number, damping: number, seconds: number) => {
  let max = s.value
  for (let t = 0; t < seconds; t += 1 / 60) { s.step(1 / 60, response, damping); max = Math.max(max, s.value) }
  return max
}

test('growing overshoots a little and settles; shrinking never overshoots', () => {
  const grow = new Spring(0, 100)
  const peak = run(grow, 0.42, 0.86, 2)
  expect(peak).toBeGreaterThan(100)
  expect(peak).toBeLessThan(106)
  expect(grow.value).toBe(100)

  const shrink = new Spring(100, 0)
  let min = 100
  for (let t = 0; t < 2; t += 1 / 60) { shrink.step(1 / 60, 0.34, 1); min = Math.min(min, shrink.value) }
  expect(min).toBeGreaterThanOrEqual(-0.25)
  expect(shrink.value).toBe(0)
})

test('a new target mid-move keeps the velocity (no jump, no restart)', () => {
  const s = new Spring(0, 100)
  for (let i = 0; i < 10; i++) s.step(1 / 60, 0.42, 0.86)
  const { value, velocity } = s
  s.target = 0
  expect(s.value).toBe(value)
  s.step(1 / 240, 0.34, 1)
  expect(s.value).toBeGreaterThan(value) // still moving up for a moment
  expect(s.velocity).toBeLessThan(velocity)
})

test('the step is stable at a slow frame rate', () => {
  const s = new Spring(0, 300)
  for (let i = 0; i < 30; i++) s.step(1 / 15, 0.42, 0.86)
  expect(s.value).toBe(300)
})

test('progress and content opacity follow the move', () => {
  const r = new RectSpring({ w: 180, h: 32, r: 16 })
  r.setTarget({ w: 680, h: 300, r: 30 })
  expect(r.progress()).toBe(0)
  expect(contentOpacity(r.progress(), 0.7)).toBe(0)
  for (let i = 0; i < 120; i++) r.step(1 / 60)
  expect(r.progress()).toBe(1)
  expect(contentOpacity(1, 0.9)).toBe(1)
  expect(contentOpacity(0.95, 0.9)).toBeCloseTo(0.5)
})

test('jelly fades out', () => {
  expect(jelly(0)).toBe(0)
  expect(Math.abs(jelly(0.08))).toBeGreaterThan(0.02)
  expect(Math.abs(jelly(1))).toBeLessThan(0.001)
  expect(jelly(2)).toBe(0)
})

const S = (id: string, status: Session['status'], extra: Partial<Session> = {}): Session => ({ id, agent: 'claude', project: id, status, detail: '', at: 0, steps: [], files: [], ...extra })
const ask = { kind: 'permission' as const, tool: 'Bash', summary: 'Bash: ls', input: {}, canAlways: false }

test('mode: a question beats tucked; open beats ask; busy → medium; nothing → resting', () => {
  expect(modeFor({ tucked: true, open: false, sessions: [S('a', 'question', { ask })] })).toBe('ask')
  expect(modeFor({ tucked: true, open: false, sessions: [S('a', 'running')] })).toBe('tucked')
  expect(modeFor({ tucked: false, open: true, sessions: [S('a', 'question', { ask })] })).toBe('open')
  expect(modeFor({ tucked: false, open: false, sessions: [S('a', 'running')] })).toBe('medium')
  expect(modeFor({ tucked: false, open: false, sessions: [S('a', 'ready')] })).toBe('resting')
})

test('rank: busiest first; done stays until seen, then fades to ready', () => {
  const now = 100_000
  const r = rank([S('d', 'done', { at: now - 20_000, seenAt: now - 10_000 }), S('q', 'question'), S('r', 'running'), S('u', 'done', { at: now - 60_000 })], 8, now)
  expect(r.map(s => s.id + ':' + s.status)).toEqual(['q:question', 'r:running', 'u:done', 'd:ready'])
})

test('sizes come from the settings; pages grow with their content', () => {
  expect(sizeFor('resting', DEFAULTS.island, 0)).toEqual({ w: 180, h: 32, r: 16 })
  expect(sizeFor('open', DEFAULTS.island, 260).h).toBe(260)
  expect(sizeFor('ask', DEFAULTS.island, 10).h).toBe(DEFAULTS.island.height)
})
