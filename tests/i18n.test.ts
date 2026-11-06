import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from 'vitest'
import { LANGUAGES, translate } from '../app/shared/i18n'

const dir = path.join(__dirname, '../i18n')
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, string>
const en = read('en.json')
const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

test('every offered language is complete, uses only known words, and keeps their {placeholders}', () => {
  expect(LANGUAGES.map(l => l.id)).toEqual(['en', 'ar'])
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const words = read(f)
    expect(['ltr', 'rtl'], f).toContain(words['language.dir'])
    expect(Object.keys(en).filter(k => !(k in words)), `${f} misses`).toEqual([])
    for (const [k, v] of Object.entries(words)) {
      expect(en, `${f}: ${k} is not in en.json`).toHaveProperty(k)
      expect(holes(v), `${f}: ${k}`).toEqual(holes(en[k]!))
    }
  }
})

test('every word the windows, the island and the tray ask for is in en.json', () => {
  const files = [
    ...['settings/App.svelte', 'welcome/App.svelte'].map(f => path.join('app/renderer', f)),
    ...fs.readdirSync(path.join(__dirname, '../app/renderer/island')).filter(f => /\.(svelte|ts)$/.test(f)).map(f => path.join('app/renderer/island', f)),
    'app/main/index.ts', 'app/main/tray.ts'
  ]
  const src = files.map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n')
  const fixed = [...src.matchAll(/\b(?:t|tr|a\.t)\('([\w.-]+)'/g)].map(m => m[1]!)
  expect(fixed.length).toBeGreaterThan(150)
  expect(fixed.filter(k => !(k in en))).toEqual([])
  // keys built from a prefix (t(`i.page.${id}`)): the prefix exists
  for (const m of src.matchAll(/\b(?:t|tOr)\(`([\w.-]+)\$\{/g)) expect(Object.keys(en).some(k => k.startsWith(m[1]!)), m[1]).toBe(true)
})

test('Arabic reads right to left; a missing word falls back to English, placeholders filled in', () => {
  expect(translate('ar', 'i.files.received', { n: 3 })).toBe('استُلم 3')
  expect(translate('nl', 'i.common.stop')).toBe('Stop') // Dutch is not offered: English
  expect(translate('ar', 'no.such.key')).toBe('no.such.key')
})
