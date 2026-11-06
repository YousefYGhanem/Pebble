import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fwd, readConfig, stripGroups, writeConfig } from './config'

// Adds or removes Pebble in ~/.claude/settings.json. Only Pebble's own entries are touched; a backup is made once.
//  - an HTTP hook on every event (recognised by its X-Pebble-Token header)
//  - `pebble-native hook window` (async, SessionStart + UserPromptSubmit): reports which window runs the session
//  - `pebble-native hook reply` (asyncRewake, Stop): waits for a reply typed in the island, wakes Claude with it (exit 2)
//  - the status line: usage for the ring. Your own status line keeps working: Pebble's helper runs it and prints
//    what it prints (its command is kept inside Pebble's, base64, and put back when Pebble is removed)
// Older installs ran PowerShell scripts (pebble-*.ps1) for the two hooks; those are recognised and replaced.
export const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json')
export const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'PermissionRequest', 'Notification', 'Stop', 'StopFailure', 'SessionEnd'] as const
const PERMISSION_WAIT_S = 300
const REPLY_WAIT_S = 1800

type Hook = { type?: string; url?: string; command?: string; headers?: Record<string, string>; [k: string]: unknown }
type Group = { matcher?: string; hooks?: Hook[]; [k: string]: unknown }
type ClaudeSettings = { hooks?: Record<string, Group[]>; statusLine?: { type?: string; command?: string }; [k: string]: unknown }

export interface Install { port: number; token: string; nativeExe: string }

const hookUrl = (port: number) => `http://127.0.0.1:${port}/hook`
const COMMANDS = /pebble-(reply|window)\.ps1|pebble-native(\.exe)?"? hook /
const isOurs = (h: Hook) => (typeof h?.url === 'string' && /^http:\/\/127\.0\.0\.1:\d+\/hook$/.test(h.url) && !!h.headers?.['X-Pebble-Token'])
  || (typeof h?.command === 'string' && COMMANDS.test(h.command))
const isOurStatus = (s: ClaudeSettings['statusLine']) => typeof s?.command === 'string'
  && ((s.command.includes('X-Pebble-Token') && s.command.includes('/status')) || / hook status --port \d+ --token /.test(s.command))
const statusCommand = (o: Install) => `"${fwd(o.nativeExe)}" hook status --port ${o.port} --token ${o.token}`
/** Your own status line command, kept inside Pebble's (undefined when there was none). */
const ownStatus = (s: ClaudeSettings['statusLine']) => {
  const b64 = / --then-b64 (\S+)/.exec(s?.command ?? '')?.[1]
  return b64 ? Buffer.from(b64, 'base64').toString('utf8') : undefined
}
const hook = (o: Install, kind: 'window' | 'reply') => `"${fwd(o.nativeExe)}" hook ${kind} --port ${o.port} --token ${o.token}`

function strip(settings: ClaudeSettings): ClaudeSettings {
  settings.hooks = stripGroups(settings.hooks, isOurs) as ClaudeSettings['hooks']
  if (!settings.hooks) delete settings.hooks
  if (isOurStatus(settings.statusLine)) {
    const own = ownStatus(settings.statusLine)
    if (own) settings.statusLine = { ...settings.statusLine, command: own } // yours again, as it was
    else delete settings.statusLine
  }
  return settings
}

export function install(o: Install, file = SETTINGS_FILE) {
  const settings = strip(readConfig<ClaudeSettings>(file))
  settings.hooks ??= {}
  const add = (event: string, hook: Hook) => (settings.hooks![event] ??= []).push({ hooks: [hook] })
  const headers = { 'X-Pebble-Token': o.token }
  for (const event of EVENTS) add(event, { type: 'http', url: hookUrl(o.port), timeout: event === 'PermissionRequest' ? PERMISSION_WAIT_S + 5 : 2, headers })
  add('SessionStart', { type: 'command', command: hook(o, 'window'), async: true, timeout: 10 })
  add('UserPromptSubmit', { type: 'command', command: hook(o, 'window'), async: true, timeout: 10 })
  add('Stop', { type: 'command', command: hook(o, 'reply'), asyncRewake: true, timeout: REPLY_WAIT_S + 10 })
  // the usage ring needs the status line's data; your own status line (if any) runs inside Pebble's and still shows
  const own = settings.statusLine?.command
  settings.statusLine = { type: 'command', ...settings.statusLine, command: statusCommand(o) + (own ? ` --then-b64 ${Buffer.from(own, 'utf8').toString('base64')}` : '') }
  writeConfig(file, settings)
}

export function remove(file = SETTINGS_FILE) {
  if (fs.existsSync(file)) writeConfig(file, strip(readConfig<ClaudeSettings>(file)))
}

/** True when everything is installed exactly as install(o) would write it now (port, token and helper path). */
export function installed(o: Install, file = SETTINGS_FILE): boolean {
  const hooks = readConfig<ClaudeSettings>(file).hooks ?? {}
  const has = (event: string, test: (h: Hook) => boolean) => (hooks[event] ?? []).some(g => (g.hooks ?? []).some(test))
  return EVENTS.every(e => has(e, h => isOurs(h) && h.url === hookUrl(o.port) && h.headers?.['X-Pebble-Token'] === o.token))
    && has('Stop', h => h.command === hook(o, 'reply'))
    && has('UserPromptSubmit', h => h.command === hook(o, 'window'))
    && (readConfig<ClaudeSettings>(file).statusLine?.command ?? '').startsWith(statusCommand(o))
}

