import { createRequire } from 'node:module'
import { test, expect } from 'vitest'

// the built-in connectors' own logic (they run in the connector sandbox; their helpers are exported for this)
const require = createRequire(import.meta.url)
const { ciState } = require('../plugins/github/index.js') as { ciState: (runs: { status: string; conclusion: string | null }[]) => { total: number; done: number; failed: number; running: boolean } }
const { ports } = require('../plugins/localhost/index.js') as { ports: (list: unknown[]) => number[] }
const countdowns = require('../plugins/countdowns/index.js') as { parse: (l: string[]) => { name: string; at: number }[]; left: (at: number, now: number) => string }
const { crossed } = require('../plugins/watch/index.js') as { crossed: (before: unknown, value: unknown, above: unknown, below: unknown) => string | null }

test('countdowns: "Name: date [time]" lines, soonest first, in whole days', () => {
  const list = countdowns.parse(['Eid: 2027-03-10', 'Launch: 2026-12-01 09:00', 'nonsense', 'Trip - 2026-11-20'])
  expect(list.map(d => d.name)).toEqual(['Trip', 'Launch', 'Eid'])
  const now = new Date(2026, 10, 17, 15, 0).getTime()
  expect(countdowns.left(new Date(2026, 10, 20).getTime(), now)).toBe('in 3 days')
  expect(countdowns.left(new Date(2026, 10, 18).getTime(), now)).toBe('tomorrow')
  expect(countdowns.left(new Date(2026, 10, 17).getTime(), now)).toBe('today')
  expect(countdowns.left(new Date(2026, 10, 17, 18, 0).getTime(), now)).toBe('in 3 h')
})

test('price alerts: only when the value goes past a limit you set', () => {
  expect(crossed('$99.50', '$101.20', '100', '')).toBe('above')
  expect(crossed('101', '102', '100', '')).toBeNull() // already above: told before
  expect(crossed('1,050', '980', '', '1000')).toBe('below')
  expect(crossed(undefined, '120', '100', '')).toBeNull() // the first reading is no news
  expect(crossed('99', '101', '', '')).toBeNull() // no limits
})

test('GitHub CI: checks done of all, failures, still running', () => {
  expect(ciState([{ status: 'completed', conclusion: 'success' }, { status: 'in_progress', conclusion: null }, { status: 'queued', conclusion: null }]))
    .toEqual({ total: 3, done: 1, failed: 0, running: true })
  expect(ciState([{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'failure' }]))
    .toEqual({ total: 2, done: 2, failed: 1, running: false })
  expect(ciState([])).toEqual({ total: 0, done: 0, failed: 0, running: false })
})

test('local servers: ports as people write them, each once, nothing odd', () => {
  expect(ports(['3000', ':5173', 'localhost:8080', 'http://127.0.0.1:4200/', '3000', 'abc', '70000', 0])).toEqual([3000, 5173, 8080, 4200])
  expect(ports(undefined as unknown as unknown[])).toEqual([])
})
