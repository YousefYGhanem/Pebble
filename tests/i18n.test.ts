import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from 'vitest'

const dir = path.join(__dirname, '../i18n')
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, string>
const en = read('en.json')

test('every language file names itself, uses only known words, and keeps their {placeholders}', () => {
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const words = read(f)
    expect(words['language.name'], f).toBeTruthy()
    expect(['ltr', 'rtl'], f).toContain(words['language.dir'])
    for (const [k, v] of Object.entries(words)) {
      expect(en, `${f}: ${k} is not in en.json`).toHaveProperty(k)
      const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
      expect(holes(v), `${f}: ${k}`).toEqual(holes(en[k]!))
    }
  }
})

test('every word the Settings window and the tour ask for is in en.json', () => {
  const src = ['settings/App.svelte', 'welcome/App.svelte'].map(f => fs.readFileSync(path.join(__dirname, '../app/renderer', f), 'utf8')).join('\n')
  const fixed = [...src.matchAll(/\bt\('([\w.]+)'/g)].map(m => m[1]!)
  expect(fixed.filter(k => !(k in en))).toEqual([])
  // keys built from a prefix (t(`tab.${id}`)): the prefix exists
  for (const m of src.matchAll(/\bt\(`([\w.]+)\$\{/g)) expect(Object.keys(en).some(k => k.startsWith(m[1]!)), m[1]).toBe(true)
})
