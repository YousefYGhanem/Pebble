import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readConfig, relay, writeConfig } from './config'

// Cursor (agent chat in the editor and cursor-agent in a terminal) reads ~/.cursor/hooks.json: {version: 1, hooks:
// {event: [{command}]}}. Pebble only uses hooks that observe; its permission hooks (beforeShellExecution …) must answer
// allow/deny/ask and a missing answer blocks, so Cursor keeps asking in its own UI. beforeSubmitPrompt has to answer
// {"continue": true}: the relay always prints that, also when Pebble is not running.
export const HOOKS_FILE = path.join(os.homedir(), '.cursor', 'hooks.json')
export const EVENTS = ['sessionStart', 'beforeSubmitPrompt', 'afterShellExecution', 'afterFileEdit', 'afterMCPExecution', 'afterAgentResponse', 'stop', 'sessionEnd'] as const

type Hook = { command?: string; [k: string]: unknown }
type Config = { version?: number; hooks?: Record<string, Hook[]>; [k: string]: unknown }
export interface Install { port: number; token: string; nativeExe: string }

const isOurs = (h: Hook) => typeof h?.command === 'string' && h.command.includes('hook relay --agent cursor')
const command = (o: Install, event: string) => relay(o.nativeExe, 'cursor', o.port, o.token, event === 'beforeSubmitPrompt' ? 'continue' : undefined)

function strip(c: Config): Config {
  for (const event of Object.keys(c.hooks ?? {})) {
    const left = c.hooks![event]!.filter(h => !isOurs(h))
    if (left.length) c.hooks![event] = left
    else delete c.hooks![event]
  }
  if (c.hooks && !Object.keys(c.hooks).length) delete c.hooks
  return c
}

export const available = () => fs.existsSync(path.dirname(HOOKS_FILE)) || fs.existsSync(path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'cursor'))

export function install(o: Install, file = HOOKS_FILE) {
  const c = strip(readConfig<Config>(file))
  c.version ??= 1
  c.hooks ??= {}
  for (const event of EVENTS) (c.hooks[event] ??= []).push({ command: command(o, event) })
  writeConfig(file, c)
}

export function remove(file = HOOKS_FILE) {
  if (!fs.existsSync(file)) return
  const c = strip(readConfig<Config>(file))
  writeConfig(file, c)
}

export function installed(o: Install, file = HOOKS_FILE): boolean {
  try {
    const hooks = readConfig<Config>(file).hooks ?? {}
    return EVENTS.every(e => (hooks[e] ?? []).some(h => h.command === command(o, e)))
  } catch { return false }
}
