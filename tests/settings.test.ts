import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from 'vitest'
import { DEFAULTS, parseSettings } from '../app/shared/settings'
import { Store } from '../app/main/store'
import { accelerator, validSettingsAction } from '../app/shared/settings-ui'

test('partial user settings are merged over the defaults', () => {
  const r = parseSettings({ island: { width: 400 } })
  expect(r.ok && r.value.island).toEqual({ ...DEFAULTS.island, width: 400 })
})

test('bad values are reported with their path', () => {
  const r = parseSettings({ island: { width: 'wide' } })
  expect(r.ok).toBe(false)
  expect(!r.ok && r.problems[0]).toMatch(/^island\.width/)
})

test('store: user theme, broken edit keeps the last good settings, update saves only the change', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-'))
  const store = new Store(dir)
  expect(store.theme.name).toBe('Default')
  expect(Object.keys(store.themes())).toEqual(expect.arrayContaining(['default', 'high-contrast', 'custom']))

  store.update({ theme: 'custom' })
  expect(store.theme.name).toBe('Custom')
  expect(JSON.parse(fs.readFileSync(store.file, 'utf8'))).toEqual({ theme: 'custom' })

  fs.writeFileSync(store.file, '{ "theme": ')
  store.load()
  expect(store.settings.theme).toBe('custom')

  expect(() => store.update({ server: { port: 1 } })).toThrow(/server\.port/)
})

test('the Settings window: only well-formed actions reach main', () => {
  expect(validSettingsAction({ do: 'update', patch: { theme: 'x' } })).toBe(true)
  expect(validSettingsAction({ do: 'update', patch: [] })).toBe(false)
  expect(validSettingsAction({ do: 'agent', id: 'claude' })).toBe(true)
  expect(validSettingsAction({ do: 'agent', id: '../x' })).toBe(false)
  expect(validSettingsAction({ do: 'connector.set', id: 'weather', key: 'city', value: 'Cairo' })).toBe(true)
  expect(validSettingsAction({ do: 'open', what: 'C:/Windows' })).toBe(false)
  expect(validSettingsAction({ do: 'scene', scene: null })).toBe(true)
  expect(validSettingsAction({ do: 'rm -rf' })).toBe(false)
})

test('a key press becomes an Electron shortcut', () => {
  const k = (key: string, code: string, m: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
    accelerator({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key, code, ...m })
  expect(k('p', 'KeyP', { ctrlKey: true, altKey: true })).toBe('Control+Alt+P')
  expect(k('Control', 'ControlLeft', { ctrlKey: true })).toBeNull() // still choosing
  expect(k('p', 'KeyP')).toBeNull() // a plain letter would steal typing
  expect(k('F9', 'F9')).toBe('F9')
  expect(k(' ', 'Space', { metaKey: true })).toBe('Super+Space')
})

test("Pip's look: theme colours by default, an icon's, or your own (only real colours)", async () => {
  const { pipColors } = await import('../app/shared/pip')
  const tok = { pipBody: '#111111', pipVisor: '#222222' }
  expect(pipColors(DEFAULTS.pip, tok)).toEqual({ body: '#111111', visor: '#222222' })
  expect(pipColors({ ...DEFAULTS.pip, look: 'custom', body: '#ff0000', visor: '#00ff00' }, tok)).toEqual({ body: '#ff0000', visor: '#00ff00' })
  expect(pipColors({ ...DEFAULTS.pip, look: 'cream' }, tok).body).toBe('#f1e4cf')
  expect(parseSettings({ pip: { look: 'custom', body: 'red' } }).ok).toBe(false)
})

test('pages can be hidden (not Home or Agents), notifications switched by source, tips remembered', () => {
  expect(parseSettings({ island: { hiddenPages: ['chat', 'notes'] } }).ok).toBe(true)
  expect(parseSettings({ island: { hiddenPages: ['agents'] } }).ok).toBe(false)
  expect(parseSettings({ features: { notify: { done: false } } }).ok).toBe(true)
  expect(parseSettings({ general: { tipsSeen: ['ask', 'nope'] } }).ok).toBe(false)
})

test('a bug report opens a GitHub issue with the version and Windows filled in, nothing else', async () => {
  const { bugReportUrl } = await import('../app/main/settings-window')
  const u = new URL(bugReportUrl('0.3.0', 'Windows_NT 10.0.26300'))
  expect(u.origin + u.pathname).toBe('https://github.com/YousefYGhanem/Pebble/issues/new')
  expect(u.searchParams.get('body')).toContain('**Pebble** 0.3.0 on Windows_NT 10.0.26300')
  expect(DEFAULTS.general.micShortcut).toBe('Control+Alt+M')
}, 30_000) // the first import of the Settings window module is slow on a cold CI runner

test('theme "auto" follows Windows: Default when dark, Mist when light', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-auto-'))
  const store = new Store(dir)
  store.update({ theme: 'auto' })
  expect(store.theme.name).toBe(new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-d-'))).theme.name) // dark: Default
  store.prefersDark = () => false
  store.load()
  expect(store.theme.name).toMatch(/mist/i)
})
