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

test('renewing the sign-in: new tokens go back into the file, every other field kept; a refusal writes nothing', async () => {
  const { renewSignIn } = await import('../app/main/agents/claude-usage')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-renew-'))
  const file = path.join(dir, '.credentials.json')
  const before = { mcpOAuth: { keep: 'me' }, claudeAiOauth: { accessToken: 'old', refreshToken: 'r1', expiresAt: 1, scopes: ['user:inference'], subscriptionType: 'max' } }
  fs.writeFileSync(file, JSON.stringify(before))
  const asked: string[] = []
  const ok = (async (url: string) => {
    asked.push(url)
    // the first address is gone: the second answers
    return asked.length === 1 ? new Response('', { status: 404 }) : Response.json({ access_token: 'new', refresh_token: 'r2', expires_in: 28800 })
  }) as unknown as typeof fetch
  expect(await renewSignIn(file, ok)).toBe(true)
  expect(asked.length).toBe(2)
  const after = JSON.parse(fs.readFileSync(file, 'utf8'))
  expect(after.mcpOAuth).toEqual({ keep: 'me' })
  expect(after.claudeAiOauth).toMatchObject({ accessToken: 'new', refreshToken: 'r2', scopes: ['user:inference'], subscriptionType: 'max' })
  expect(after.claudeAiOauth.expiresAt).toBeGreaterThan(Date.now() + 28_000_000)
  const refused = (async () => new Response('{"error":"invalid_grant"}', { status: 400 })) as unknown as typeof fetch
  expect(await renewSignIn(file, refused)).toBe(false)
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).claudeAiOauth.accessToken).toBe('new') // unchanged
  expect(fs.readdirSync(dir)).toEqual(['.credentials.json']) // no temporary file left
})

test('renewing: when the file cannot be swapped in, the new tokens are still written (the old refresh token is dead)', async () => {
  const { renewSignIn } = await import('../app/main/agents/claude-usage')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-renew2-'))
  const file = path.join(dir, '.credentials.json')
  fs.writeFileSync(file, JSON.stringify({ claudeAiOauth: { accessToken: 'old', refreshToken: 'r1', expiresAt: 1 } }))
  fs.mkdirSync(`${file}.pebble-tmp`) // the temporary file cannot be made
  const ok = (async () => Response.json({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 })) as unknown as typeof fetch
  expect(await renewSignIn(file, ok)).toBe(true)
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).claudeAiOauth).toMatchObject({ accessToken: 'new', refreshToken: 'r2' })
})
