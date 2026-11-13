import { test, expect } from 'vitest'
import { freshWellness, wellnessAnswer, wellnessCheck } from '../app/shared/wellness'

const c = { water: true, waterMinutes: 60, stand: true, standMinutes: 45, from: 9, to: 21 }
const at = (h: number, m = 0) => new Date(2026, 10, 13, h, m).getTime()
// the island looks once a minute: the minute before each check was a look
const look = (s: Parameters<typeof wellnessCheck>[0], t: number, idle: number, cc = c) => wellnessCheck({ ...s, seen: t - 60_000 }, t, idle, cc)

test('water and stand-up: asked on time, within the hours, never while away; Later asks again in 15 minutes', () => {
  let s = freshWellness(at(10))
  expect(look(s, at(10, 30), 10, c).due).toBeNull()
  let r = look(s, at(10, 46), 10, c) // 46 min of sitting: stand first
  expect(r.due).toBe('stand')
  r = look(r.st, at(11, 1), 10, c) // an hour since the last water
  expect(r.due).toBe('water')
  s = wellnessAnswer(r.st, 'water', true, at(11, 1), c)
  expect(s.glasses).toBe(1)
  // away (idle 6 min): nothing, and the sitting starts over
  r = look(s, at(11, 40), 360, c)
  expect(r.due).toBeNull()
  expect(r.st.sittingSince).toBe(at(11, 40))
  // after hours: nothing
  expect(look(freshWellness(at(20)), at(22), 10, c).due).toBeNull()
  // Later: 15 minutes, not a whole hour
  const later = wellnessAnswer(s, 'water', false, at(12), c)
  expect(look(later, at(12, 14), 10, { ...c, stand: false }).due).toBeNull()
  expect(look(later, at(12, 15), 10, { ...c, stand: false }).due).toBe('water')
})

test('coming back after a gap between looks (asleep, away) is a break: no stand-up or water at once', () => {
  let st = wellnessCheck(freshWellness(at(9)), at(9, 1), 0, c).st
  const back = wellnessCheck(st, at(13), 0, c) // no looks from 9:01 to 13:00
  expect(back.due).toBeNull()
  st = back.st
  expect(wellnessCheck(st, at(13, 1), 0, c).due).toBeNull()
})
