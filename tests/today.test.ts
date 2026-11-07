import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect, vi } from 'vitest'
import { addTask, addUsage, daysAt, emptyDay, spentOf, usageAlerts, type Days } from '../app/shared/today'
import { restLevel } from '../app/main/rest'
import { moodFor } from '../app/shared/pip'
import { validSettingsAction } from '../app/shared/settings-ui'
import { makeApi } from '../app/main/connectors/runner'
import { manifestSchema } from '../app/shared/connectors'
import { Store } from '../app/main/store'

const at = (d: string) => new Date(d).getTime()

test('usage alerts: once when passing 80% and 95%; the first report is only the baseline', () => {
  const w = (used: number) => ({ fiveHour: { used, resetsAt: 1 }, sevenDay: { used: 10, resetsAt: 2 } })
  expect(usageAlerts(undefined, w(90))).toEqual([])
  expect(usageAlerts(w(70), w(79))).toEqual([])
  expect(usageAlerts(w(79), w(81))).toEqual([{ window: 'fiveHour', level: 80, resetsAt: 1 }])
  expect(usageAlerts(w(81), w(85))).toEqual([])
  expect(usageAlerts(w(70), w(97))).toEqual([{ window: 'fiveHour', level: 95, resetsAt: 1 }]) // only the highest
  expect(usageAlerts(w(97), w(3))).toEqual([]) // a new window
})

test('the day: tasks add up, usage counts from the first report, a reset keeps what went before, a new day starts fresh', () => {
  let d: Days = { today: emptyDay(at('2026-11-07T09:00')), yesterday: null }
  d = addTask(d, at('2026-11-07T10:00'), { agent: 'claude', seconds: 600, files: 3 })
  d = addTask(d, at('2026-11-07T11:00'), { agent: 'codex', seconds: 60, files: 0 })
  expect([d.today.tasks, d.today.seconds, d.today.files, d.today.agents.claude?.tasks]).toEqual([2, 660, 3, 1])
  const week = (used: number) => ({ sevenDay: { used, resetsAt: 0 } })
  d = addUsage(d, at('2026-11-07T10:00'), 'claude', week(40))
  d = addUsage(d, at('2026-11-07T12:00'), 'claude', week(52))
  expect(spentOf(d.today.spent.claude!)).toBe(12)
  d = addUsage(d, at('2026-11-07T13:00'), 'claude', week(4)) // the week reset
  expect(spentOf(d.today.spent.claude!)).toBe(16)
  d = addUsage(d, at('2026-11-07T13:00'), 'dsh', { tokens: { session: 5, week: 1000 } })
  d = addUsage(d, at('2026-11-07T14:00'), 'dsh', { tokens: { session: 5, week: 1500 } })
  expect(d.today.spent.dsh).toMatchObject({ unit: 'tokens' })
  expect(spentOf(d.today.spent.dsh!)).toBe(500)
  const next = daysAt(d, at('2026-11-08T08:00'))
  expect(next.today.tasks).toBe(0)
  expect(next.yesterday?.tasks).toBe(2)
  expect(daysAt(d, at('2026-11-10T08:00')).yesterday).toBeNull() // older than yesterday: gone
})

test('rest: off while tucked, deep while away or in a game, light on battery, each as the settings allow', () => {
  const all = { away: true, games: true, battery: true }
  expect(restLevel({ away: false, game: false, battery: false }, all)).toBe('awake')
  expect(restLevel({ away: true, game: false, battery: true }, all)).toBe('deep')
  expect(restLevel({ away: false, game: true, battery: false }, all)).toBe('deep')
  expect(restLevel({ away: false, game: false, battery: true }, all)).toBe('light')
  expect(restLevel({ away: true, game: false, battery: false }, { ...all, away: false })).toBe('awake')
  expect(restLevel({ away: false, game: false, battery: false, tucked: true }, { away: false, games: false, battery: false })).toBe('off') // tucked: always
})

test('Pip looks worried for a moment when a limit is near', () => {
  const base = { status: 'ready' as const, now: 10_000, pokes: [], lovedAt: 0, happyAt: 0, sleepy: false, playing: false, hovering: false }
  expect(moodFor({ ...base, worriedAt: 8_000 })).toBe('alert')
  expect(moodFor({ ...base, worriedAt: 1_000 })).toBe('idle')
})

test('connectors rest: jobs wait while paused and run once on waking', async () => {
  vi.useFakeTimers()
  try {
    const h = makeApi({ manifest: manifestSchema.parse({ id: 't', name: 'T', permissions: {} }), settings: {}, secrets: {}, store: {}, send: () => {} })
    let runs = 0
    h.api.every('30s', () => { runs++ })
    await vi.advanceTimersByTimeAsync(0)
    expect(runs).toBe(1)
    h.pause(true)
    await vi.advanceTimersByTimeAsync(90_000)
    expect(runs).toBe(1)
    h.pause(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(runs).toBe(2)
    h.stop()
  } finally { vi.useRealTimers() }
})

test('theme colours: only real colours and a sane radius pass; an edit saves and selects your own theme', () => {
  expect(validSettingsAction({ do: 'theme.edit', tokens: { accent: '#ff00aa', radius: 12 } })).toBe(true)
  expect(validSettingsAction({ do: 'theme.edit', tokens: { accent: 'red' } })).toBe(false)
  expect(validSettingsAction({ do: 'theme.edit', tokens: { font: '#ffffff' } })).toBe(false)
  expect(validSettingsAction({ do: 'theme.edit', tokens: { radius: 400 } })).toBe(false)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-theme-'))
  const store = new Store(dir)
  store.editTheme({ accent: '#ff00aa' })
  expect(store.settings.theme).toBe('custom')
  expect(store.theme.tokens.accent).toBe('#ff00aa')
  expect(store.theme.tokens.background).toBeTruthy() // the rest comes from the theme in use
  store.editTheme({ radius: 8 })
  expect([store.theme.tokens.accent, store.theme.tokens.radius]).toEqual(['#ff00aa', 8])
})
