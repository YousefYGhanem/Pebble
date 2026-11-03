import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from 'vitest'
import { finishTask, inSeason, moodFor, OUTFITS, outfitFor, wearable, type MoodInput } from '../app/shared/pip'
import { PipStore } from '../app/main/pip'

const NOW = 1_000_000
const base: MoodInput = { status: 'ready', now: NOW, pokes: [], lovedAt: 0, happyAt: 0, sleepy: false, playing: false, hovering: false }

test('moods: reactions beat the agent, the agent beats music, music beats hover and sleep', () => {
  expect(moodFor(base)).toBe('idle')
  expect(moodFor({ ...base, sleepy: true })).toBe('sleepy')
  expect(moodFor({ ...base, sleepy: true, hovering: true })).toBe('curious')
  expect(moodFor({ ...base, playing: true, hovering: true })).toBe('dancing')
  expect(moodFor({ ...base, playing: true, status: 'running' })).toBe('focused')
  expect(moodFor({ ...base, status: 'question' })).toBe('alert')
  expect(moodFor({ ...base, status: 'error' })).toBe('sad')
  expect(moodFor({ ...base, status: 'running', happyAt: NOW - 1000 })).toBe('happy')
  expect(moodFor({ ...base, happyAt: NOW - 4000 })).toBe('idle') // happy wears off
  expect(moodFor({ ...base, lovedAt: NOW - 500, happyAt: NOW - 500 })).toBe('love')
  expect(moodFor({ ...base, pokes: [NOW - 900, NOW - 600, NOW - 300] })).toBe('grumpy')
  expect(moodFor({ ...base, pokes: [1, 2, 3, 4, 5, 6].map(i => NOW - i * 300) })).toBe('dizzy')
  expect(moodFor({ ...base, pokes: [NOW - 5000, NOW - 4000, NOW - 3500] })).toBe('idle') // old pokes do not count
})

const day = (m: number, d: number) => new Date(2026, m - 1, d, 12)

test('seasons, also across new year', () => {
  const party = OUTFITS.find(o => o.id === 'party')!, santa = OUTFITS.find(o => o.id === 'santa')!
  expect(inSeason(party, day(12, 31))).toBe(true)
  expect(inSeason(party, day(1, 1))).toBe(true)
  expect(inSeason(party, day(1, 2))).toBe(false)
  expect(inSeason(santa, day(12, 26))).toBe(true)
  expect(inSeason(santa, day(12, 27))).toBe(false)
})

test('outfits: earned by tasks, worn in season, your own always', () => {
  expect(wearable(9, day(6, 1))).toEqual([])
  expect(wearable(25, day(6, 1))).toEqual(['glasses', 'cap'])
  expect(outfitFor('auto', 0, day(10, 30), [])).toBe('witch')
  expect(outfitFor('auto', 500, day(6, 1), [])).toBeNull()
  expect(outfitFor('crown', 99, day(6, 1), [])).toBeNull() // not earned yet
  expect(outfitFor('crown', 100, day(6, 1), [])).toBe('crown')
  expect(outfitFor('my-bow', 0, day(6, 1), ['my-bow'])).toBe('my-bow')
  expect(outfitFor('none', 100, day(12, 24), [])).toBeNull()
})

test('achievements are earned once', () => {
  let s = { done: 9, achievements: ['first'] }
  const r = finishTask(s, { at: new Date(2026, 5, 1, 3).getTime(), seconds: 12 })
  expect(r.stats.done).toBe(10)
  expect(r.earned).toEqual(['ten', 'night-owl', 'quick'])
  s = r.stats
  expect(finishTask(s, { at: new Date(2026, 5, 1, 3).getTime(), seconds: 12 }).earned).toEqual([])
})

test('PipStore keeps stats and reads your own SVG outfits', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-pip-'))
  const a = new PipStore(dir)
  expect(a.finish(5)).toEqual(['first', 'quick'])
  fs.writeFileSync(path.join(dir, 'outfits', 'bow.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
  fs.writeFileSync(path.join(dir, 'outfits', 'notes.txt'), 'ignored')
  const b = new PipStore(dir)
  expect(b.stats).toEqual({ done: 1, achievements: ['first', 'quick'] })
  expect(b.custom.map(c => c.id)).toEqual(['bow'])
  expect(b.custom[0]!.data.startsWith('data:image/svg+xml;base64,')).toBe(true)
})
