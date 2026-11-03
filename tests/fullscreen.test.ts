import { test, expect } from 'vitest'
import { coversDisplay } from '../app/main/fullscreen'

const screen = { x: 1920, y: 0, width: 2560, height: 1440 }

test('a window counts as full screen only when it covers the whole display', () => {
  expect(coversDisplay({ x: 1920, y: 0, width: 2560, height: 1440 }, screen)).toBe(true)
  expect(coversDisplay({ x: 1912, y: -8, width: 2576, height: 1456 }, screen)).toBe(true) // maximised borders overhang
  expect(coversDisplay({ x: 1920, y: 0, width: 2560, height: 1392 }, screen)).toBe(false) // maximised above the taskbar
  expect(coversDisplay({ x: 0, y: 0, width: 1920, height: 1080 }, screen)).toBe(false) // the other screen
})
