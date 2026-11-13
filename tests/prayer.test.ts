import { test, expect } from 'vitest'
import { nextPrayer, prayerDay } from '../app/main/prayer'

const JERUSALEM = [31.77, 35.21] as const

test('prayer times: five a day, in order; after Isha the next is tomorrow\'s Fajr', () => {
  const day = prayerDay(...JERUSALEM, 'MuslimWorldLeague', 'shafi', new Date(2026, 10, 13, 12))
  expect(day.map(p => p.name)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'])
  expect(day.every((p, i) => i === 0 || p.at > day[i - 1]!.at)).toBe(true)
  const afterIsha = day[4]!.at + 60_000
  const next = nextPrayer(...JERUSALEM, 'MuslimWorldLeague', 'shafi', afterIsha)
  expect(next.name).toBe('fajr')
  expect(next.at).toBeGreaterThan(afterIsha)
  expect(nextPrayer(...JERUSALEM, 'MuslimWorldLeague', 'shafi', day[1]!.at - 60_000).name).toBe('dhuhr')
  // Hanafi Asr comes later than the standard one
  const hanafi = prayerDay(...JERUSALEM, 'MuslimWorldLeague', 'hanafi', new Date(2026, 10, 13, 12))
  expect(hanafi[2]!.at).toBeGreaterThan(day[2]!.at)
})
