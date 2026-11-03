import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { onPath, readConfig, stripGroups, writeConfig } from './config'

// Codex reads hooks from ~/.codex/hooks.json (the same shape as Claude Code, command hooks only). Each event runs
// curl.exe (part of Windows 10/11) in the background, which passes it to Pebble tagged agent=codex. Status only:
// Codex asks its permissions in its own UI. Codex asks you once to trust new hooks.
const HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
export const HOOKS_FILE = path.join(HOME, 'hooks.json')
export const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'SessionEnd'] as const

type Hook = { type?: string; command?: string; [k: string]: unknown }
type Config = { hooks?: Record<string, { hooks?: Hook[]; [k: string]: unknown }[]>; [k: string]: unknown }

const command = (port: number, token: string) =>
  `curl.exe -s -m 3 -H "X-Pebble-Token: ${token}" -H "Content-Type: application/json" --data-binary @- "http://127.0.0.1:${port}/hook?agent=codex"`
const isOurs = (h: Hook) => typeof h?.command === 'string' && h.command.includes('X-Pebble-Token') && h.command.includes('agent=codex')

/** Codex is on this PC: its command on the PATH, its folder in use, or the OpenAI app from the Microsoft Store. */
export function available(): boolean {
  const used = (() => { try { return fs.readdirSync(HOME).some(n => !/^(hooks\.json.*|tmp)$/i.test(n)) } catch { return false } })()
  const store = (() => { try { return fs.readdirSync(path.join(process.env.LOCALAPPDATA ?? '', 'Packages')).some(n => /^OpenAI\./i.test(n)) } catch { return false } })()
  return onPath('codex') || used || store
}

function strip(config: Config): Config {
  config.hooks = stripGroups(config.hooks, isOurs) as Config['hooks']
  if (!config.hooks) delete config.hooks
  return config
}

export function install(port: number, token: string, file = HOOKS_FILE) {
  const config = strip(readConfig<Config>(file))
  config.hooks ??= {}
  for (const event of EVENTS) (config.hooks[event] ??= []).push({ hooks: [{ type: 'command', command: command(port, token), timeout: 5, async: true, statusMessage: 'Pebble' }] })
  writeConfig(file, config)
}

export function remove(file = HOOKS_FILE) {
  if (fs.existsSync(file)) writeConfig(file, strip(readConfig<Config>(file)))
}

export function installed(port: number, token: string, file = HOOKS_FILE): boolean {
  try {
    const hooks = readConfig<Config>(file).hooks ?? {}, cmd = command(port, token)
    return EVENTS.every(e => (hooks[e] ?? []).some(g => (g.hooks ?? []).some(h => isOurs(h) && h.command === cmd)))
  } catch { return false }
}
