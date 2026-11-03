import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { onPath, readConfig, relay, stripGroups, writeConfig } from './config'

// Gemini CLI reads hooks from ~/.gemini/settings.json (command hooks only, timeouts in milliseconds). Each event runs
// `pebble-native hook relay --agent gemini`. Status only: Gemini asks its permissions in its own terminal (its
// Notification hook can report that, not answer it); Pebble shows that it waits for you.
export const SETTINGS_FILE = path.join(os.homedir(), '.gemini', 'settings.json')
export const EVENTS = ['SessionStart', 'BeforeAgent', 'BeforeTool', 'AfterTool', 'AfterAgent', 'Notification', 'SessionEnd'] as const

type Hook = { name?: string; type?: string; command?: string; [k: string]: unknown }
type Settings = { hooks?: Record<string, { matcher?: string; hooks?: Hook[]; [k: string]: unknown }[]>; [k: string]: unknown }
export interface Install { port: number; token: string; nativeExe: string }

const isOurs = (h: Hook) => typeof h?.command === 'string' && h.command.includes('hook relay --agent gemini')
const strip = (s: Settings) => { s.hooks = stripGroups(s.hooks, isOurs) as Settings['hooks']; if (!s.hooks) delete s.hooks; return s }

export const available = () => onPath('gemini') || fs.existsSync(path.dirname(SETTINGS_FILE))

export function install(o: Install, file = SETTINGS_FILE) {
  const s = strip(readConfig<Settings>(file))
  s.hooks ??= {}
  for (const event of EVENTS) (s.hooks[event] ??= []).push({ hooks: [{ name: 'pebble', type: 'command', command: relay(o.nativeExe, 'gemini', o.port, o.token), timeout: 5000 }] })
  writeConfig(file, s)
}

export function remove(file = SETTINGS_FILE) {
  if (fs.existsSync(file)) writeConfig(file, strip(readConfig<Settings>(file)))
}

export function installed(o: Install, file = SETTINGS_FILE): boolean {
  try {
    const hooks = readConfig<Settings>(file).hooks ?? {}, cmd = relay(o.nativeExe, 'gemini', o.port, o.token)
    return EVENTS.every(e => (hooks[e] ?? []).some(g => (g.hooks ?? []).some(h => h.command === cmd)))
  } catch { return false }
}
