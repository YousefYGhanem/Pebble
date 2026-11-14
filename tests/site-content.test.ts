import { test, expect } from 'vitest'
import en from '../site/content/en'
import ar from '../site/content/ar'

/** The shape of a value: keys and array lengths, not the words (so a feature added in one language shows up as missing in the other). */
const shape = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, shape((v as Record<string, unknown>)[k])])) : typeof v

test('the website has the same sections, features and fields in English and Arabic', () => {
  expect(shape(ar)).toEqual(shape(en))
  // ids, icons, images and live demos are data, not words: they must match one to one
  const data = (c: typeof en) => c.features.map(f => [f.id, f.icon, f.live, f.mood, f.shots?.map(s => [s.src, s.h, s.size]), f.chips?.map(x => x.id)])
  expect(data(ar)).toEqual(data(en))
  expect(ar.more.items.map(i => i.icon)).toEqual(en.more.items.map(i => i.icon))
  expect(ar.footer.links.map(l => l.href)).toEqual(en.footer.links.map(l => l.href))
})
