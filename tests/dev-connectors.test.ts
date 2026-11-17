import { createRequire } from 'node:module'
import { test, expect } from 'vitest'

// the built-in connectors' own logic (they run in the connector sandbox; their helpers are exported for this)
const require = createRequire(import.meta.url)
const { ciState } = require('../plugins/github/index.js') as { ciState: (runs: { status: string; conclusion: string | null }[]) => { total: number; done: number; failed: number; running: boolean } }
const { ports } = require('../plugins/localhost/index.js') as { ports: (list: unknown[]) => number[] }

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
