import type { Settings, Theme } from './settings'
import type { Scene } from './island'

// The Settings window (app/renderer/settings): what it shows, and what it can ask main to do.

export interface ConnectorView {
  id: string
  name: string
  description: string
  builtIn: boolean
  enabled: boolean
  running: boolean
  problem?: string
  webhook: string | null
  fields: { key: string; label: string; type: string; required: boolean; secret: boolean; value: unknown; set: boolean; pick?: string }[]
}

export interface SettingsView {
  version: string
  settings: Settings
  theme: Theme
  themes: { id: string; name: string }[]
  displays: { id: number; label: string }[]
  agents: { id: string; name: string; available: boolean; connected: boolean }[]
  terminals: { id: string; on: boolean }[]
  connectors: ConnectorView[]
  chipWidgets: { id: string; label: string }[]
  pip: { done: number; wearable: string[]; custom: string[] }
  /** which chat providers have a key saved */
  chatKeys: Record<string, boolean>
  /** "Find values" for a connector setting: what was found at its address */
  connectorPick?: { id: string; key: string; items: { label: string; value: string; path: string }[]; loading?: boolean; error?: string }
  /** the chosen chat provider's models, fetched from it (Settings → Pip's chat → Model) */
  chatModels?: { provider: string; list: { id: string; name: string }[]; loading?: boolean; error?: string }
  /** pairing the browser extension: its key, and the folder to load it from */
  extension: { key: string; folder: string; port: number }
  scene: Scene | null
  /** Settings → General → Updates */
  update: { state: string; version?: string; percent?: number; error?: string }
  /** Settings → Advanced → Diagnostics */
  diagnostics?: { name: string; ok: boolean; detail?: string }[] | 'running'
  /** the last thing that could not be saved, in words */
  error?: string
}

export type SettingsAction =
  | { do: 'update'; patch: Record<string, unknown> }
  | { do: 'agent' | 'terminal' | 'connector'; id: string }
  | { do: 'connector.set'; id: string; key: string; value: unknown }
  | { do: 'copyWebhook'; id: string }
  | { do: 'open'; what: 'settings' | 'themes' | 'log' | 'connectors' | 'plugins' | 'outfits' | 'extension' }
  | { do: 'copyExtensionKey' | 'diagnose' | 'copyDiagnostics' | 'welcome' | 'welcome.clicked' | 'welcome.done' | 'update.check' | 'update.install' }
  | { do: 'history.clear' | 'restart' | 'quit' }
  | { do: 'scene'; scene: Scene | null }
  | { do: 'chat.key'; provider: string; value: string }
  | { do: 'chat.models' }
  | { do: 'connector.pick'; id: string; key: string }
  | { do: 'connector.pickClose' }

const OPEN = ['settings', 'themes', 'log', 'connectors', 'plugins', 'outfits', 'extension']

/** Only well-formed actions from the Settings window reach main (the patch itself is checked by the settings schema). */
export function validSettingsAction(a: unknown): a is SettingsAction {
  const o = a as Record<string, unknown>
  if (!o || typeof o !== 'object') return false
  const id = typeof o.id === 'string' && /^[\w-]{1,40}$/.test(o.id)
  switch (o.do) {
    case 'update': return !!o.patch && typeof o.patch === 'object' && !Array.isArray(o.patch)
    case 'agent': case 'terminal': case 'connector': case 'copyWebhook': return id
    case 'connector.set': return id && typeof o.key === 'string' && /^\w{1,40}$/.test(o.key)
    case 'open': return OPEN.includes(o.what as string)
    case 'history.clear': case 'restart': case 'quit': case 'copyExtensionKey': case 'diagnose': case 'copyDiagnostics': case 'welcome': case 'welcome.clicked': case 'welcome.done': case 'update.check': case 'update.install': return true
    case 'scene': return o.scene === null || typeof o.scene === 'string'
    case 'chat.models': case 'connector.pickClose': return true
    case 'connector.pick': return id && typeof o.key === 'string' && /^\w{1,40}$/.test(o.key)
    case 'chat.key': return typeof o.provider === 'string' && typeof o.value === 'string' && o.value.length < 500
    default: return false
  }
}

/** Ctrl+Shift+K from a key event → Electron's accelerator "Control+Shift+K" (null while only modifiers are held). */
export function accelerator(e: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean; key: string; code: string }): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null
  const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3)
    : /^Digit\d$/.test(e.code) ? e.code.slice(5)
    : /^F\d{1,2}$/.test(e.key) ? e.key
    : ({ Space: 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/' } as Record<string, string>)[e.code]
  if (!key) return null
  const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean)
  if (!mods.length && !/^F\d/.test(key)) return null // a shortcut needs a modifier (an F-key may stand alone)
  return [...mods, key].join('+')
}
