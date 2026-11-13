import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { DEFAULTS, merge, parseSettings, themeSchema, type Settings, type Theme } from '../shared/settings'
import defaultTheme from '../../themes/default.json'
import highContrast from '../../themes/high-contrast.json'
import black from '../../themes/black.json'
import graphite from '../../themes/graphite.json'
import midnight from '../../themes/midnight.json'
import mist from '../../themes/mist.json'
import { logger } from './log'

const log = logger('store')
const BUILT_IN: Record<string, Theme> = {
  default: themeSchema.parse(defaultTheme), black: themeSchema.parse(black), graphite: themeSchema.parse(graphite),
  midnight: themeSchema.parse(midnight), mist: themeSchema.parse(mist), 'high-contrast': themeSchema.parse(highContrast)
}

export function writeJsonAtomic(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2))
  fs.renameSync(file + '.tmp', file)
}

/**
 * settings.json and the themes folder in userData, both watched: a save in any editor applies at once.
 * A broken edit is logged and ignored (the last good settings stay), so a typo never breaks the island.
 * Emits 'change' with no arguments; read store.settings / store.theme.
 */
export class Store extends EventEmitter {
  readonly file: string
  readonly themesDir: string
  settings: Settings = DEFAULTS
  theme: Theme = BUILT_IN.default!
  /** Windows is in dark mode (theme "auto" follows it: Default when dark, Mist when light); index.ts sets it */
  prefersDark = () => true
  private timer?: NodeJS.Timeout

  constructor(dir: string) {
    super()
    this.file = path.join(dir, 'settings.json')
    this.themesDir = path.join(dir, 'themes')
    // a starting point to edit: a copy of the default theme as "custom" (select it with "theme": "custom")
    const custom = path.join(this.themesDir, 'custom.json')
    if (!fs.existsSync(custom)) writeJsonAtomic(custom, { ...defaultTheme, name: 'Custom' })
    if (!fs.existsSync(this.file)) writeJsonAtomic(this.file, { theme: 'default' })
    this.load()
  }

  /** All theme ids: built-in plus every valid .json in the themes folder (a user file wins over a built-in of the same id). */
  themes(): Record<string, Theme> {
    const all = { ...BUILT_IN }
    for (const f of fs.readdirSync(this.themesDir).filter(f => f.endsWith('.json'))) {
      try { all[f.slice(0, -5)] = themeSchema.parse(JSON.parse(fs.readFileSync(path.join(this.themesDir, f), 'utf8'))) }
      catch (err) { log.warn(`theme ${f} ignored:`, err instanceof Error ? err.message : err) }
    }
    return all
  }

  load() {
    let user: unknown
    try { user = JSON.parse(fs.readFileSync(this.file, 'utf8')) }
    catch (err) { log.warn('settings.json unreadable, keeping the last good settings:', (err as Error).message); return }
    const r = parseSettings(user)
    if (!r.ok) { log.warn('settings.json has problems, keeping the last good settings:', r.problems.join('; ')); return }
    this.settings = r.value
    const themes = this.themes()
    const id = r.value.theme === 'auto' ? (this.prefersDark() ? 'default' : 'mist') : r.value.theme
    this.theme = themes[id] ?? BUILT_IN.default!
    if (!themes[id]) log.warn(`theme "${id}" not found, using default`)
  }

  /** Saves a partial change (only what differs from the defaults is kept on disk). */
  update(patch: unknown) {
    let user: unknown = {}
    try { user = JSON.parse(fs.readFileSync(this.file, 'utf8')) } catch {}
    const next = merge(user, patch)
    const r = parseSettings(next)
    if (!r.ok) throw new Error(r.problems.join('; '))
    writeJsonAtomic(this.file, next)
    this.load()
    this.emit('change')
  }

  /**
   * Your own colours (Settings → Look): themes/custom.json, started from the theme in use, and selected.
   * The tokens are checked by validSettingsAction (colours, radius) and again by the theme schema here.
   */
  editTheme(tokens: Partial<Theme['tokens']>) {
    const base = this.theme
    const next = themeSchema.parse({ ...base, name: 'Custom', tokens: { ...base.tokens, ...tokens } })
    writeJsonAtomic(path.join(this.themesDir, 'custom.json'), next)
    if (this.settings.theme !== 'custom') this.update({ theme: 'custom' })
    else { this.load(); this.emit('change') }
  }

  /** Watches settings.json and the themes folder (Windows fires several events per save: settle for 150 ms). */
  watch() {
    const reload = () => { clearTimeout(this.timer); this.timer = setTimeout(() => { this.load(); this.emit('change') }, 150) }
    fs.watch(path.dirname(this.file), (_e, name) => { if (name === 'settings.json') reload() })
    fs.watch(this.themesDir, reload)
  }
}
