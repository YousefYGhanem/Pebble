import { describe, expect, it } from 'vitest'
import { appName, countTime, freshScreen, topApps } from '../app/shared/screentime'

describe('screen time', () => {
  const now = new Date(2026, 10, 13, 12).getTime()
  it('adds up time per app and lists the longest first', () => {
    let s = freshScreen(now)
    s = countTime(s, 'Code', 3600, now)
    s = countTime(s, 'Chrome', 600, now)
    s = countTime(s, 'Code', 60, now)
    s = countTime(s, 'Notepad', 30, now)
    expect(topApps(s)).toEqual([{ name: 'Code', seconds: 3660 }, { name: 'Chrome', seconds: 600 }])
  })
  it('starts a new day from nothing', () => {
    const s = countTime(countTime(freshScreen(now), 'Code', 3600, now), 'Chrome', 120, now + 86_400_000)
    expect(s.apps).toEqual({ Chrome: 120 })
  })
  it('names apps as people know them', () => expect(appName('code')).toBe('Code'))
})
