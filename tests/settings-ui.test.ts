import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from 'vitest'
import { DEFAULTS } from '../app/shared/settings'

// "No dead buttons": every option in settings.json has a control in the Settings window.
const NOT_SHOWN = ['version', 'general.welcomed'] // bookkeeping, not choices
// the Agents switches set agents.<id>.enabled through their own action (it also installs or removes the hooks)
const BY_ACTION = /^agents\.\w+\.enabled$/

test('the Settings window shows every option', () => {
  const src = fs.readFileSync(path.join(__dirname, '../app/renderer/settings/App.svelte'), 'utf8')
  const leaves: string[] = []
  const walk = (o: object, p: string) => {
    for (const [k, v] of Object.entries(o)) {
      const q = p ? `${p}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, q)
      else leaves.push(q)
    }
  }
  walk(DEFAULTS, '')
  // a control names its option as 'a.b' (set), s.a.b (shows it), or a template like `island.${key}` with the key listed
  const shown = (l: string) => src.includes(`'${l}'`) || src.includes(`s.${l}`) || src.includes(`'${l.split('.').at(-1)}'`)
  expect(leaves.filter(l => !NOT_SHOWN.includes(l) && !BY_ACTION.test(l) && !shown(l))).toEqual([])
})
