import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from 'vitest'
import { fetchPlanUsage, parsePlanUsage } from '../app/main/agents/claude-usage'

test("Anthropic's plan usage: the session, the week, and the other weekly limits", () => {
  const u = parsePlanUsage({
    five_hour: { utilization: 42, resets_at: '2026-11-13T18:00:00Z' },
    seven_day: { utilization: 18.5, resets_at: '2026-11-18T09:00:00Z' },
    seven_day_opus: { utilization: 61, resets_at: '2026-11-18T09:00:00Z' },
    seven_day_oauth_apps: null
  })!
  expect(u.fiveHour).toEqual({ used: 42, resetsAt: Date.parse('2026-11-13T18:00:00Z') })
  expect(u.sevenDay?.used).toBe(18.5)
  expect(u.extra).toEqual([{ name: 'Opus', used: 61, resetsAt: Date.parse('2026-11-18T09:00:00Z') }])
  expect(parsePlanUsage({ something: 'else' })).toBeNull()
})

test('no sign-in, or an expired one, is reported without asking Anthropic', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-cred-'))
  expect(await fetchPlanUsage(path.join(dir, 'missing.json'))).toEqual({ problem: 'none' })
  const file = path.join(dir, '.credentials.json')
  fs.writeFileSync(file, JSON.stringify({ claudeAiOauth: { accessToken: 'x', expiresAt: Date.now() - 1000 } }))
  expect(await fetchPlanUsage(file)).toEqual({ problem: 'expired' })
})
