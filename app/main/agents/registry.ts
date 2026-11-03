import * as claude from './claude'
import * as codex from './codex'
import * as gemini from './gemini'
import * as cursor from './cursor'
import * as opencode from './opencode'
import * as aider from './aider'

/** Everything Pebble connects to, the same way: the tray lists them, start-up connects the ones found on this PC. */
export interface Adapter {
  id: 'claude' | 'codex' | 'gemini' | 'cursor' | 'opencode' | 'aider'
  name: string
  /** on this PC (Claude Code always counts: it also runs inside the Claude app) */
  available(): boolean
  installed(): boolean
  /** false: left alone on purpose (e.g. your own Aider notifications-command) */
  install(): boolean | void
  remove(): void
}

export function adapters(c: { port: number; token: string; nativeExe: string }): Adapter[] {
  return [
    { id: 'claude', name: 'Claude Code', available: () => true, installed: () => claude.installed(c), install: () => claude.install(c), remove: () => claude.remove() },
    { id: 'codex', name: 'Codex', available: codex.available, installed: () => codex.installed(c.port, c.token), install: () => codex.install(c.port, c.token), remove: () => codex.remove() },
    { id: 'gemini', name: 'Gemini CLI', available: gemini.available, installed: () => gemini.installed(c), install: () => gemini.install(c), remove: () => gemini.remove() },
    { id: 'cursor', name: 'Cursor', available: cursor.available, installed: () => cursor.installed(c), install: () => cursor.install(c), remove: () => cursor.remove() },
    { id: 'opencode', name: 'OpenCode', available: opencode.available, installed: () => opencode.installed(c), install: () => opencode.install(c), remove: () => opencode.remove() },
    { id: 'aider', name: 'Aider', available: aider.available, installed: () => aider.installed(c), install: () => aider.install(c), remove: () => aider.remove() }
  ]
}
