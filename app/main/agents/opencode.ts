import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { onPath, writeText } from './config'

// OpenCode loads every .js file in ~/.config/opencode/plugins at start. Pebble writes one small plugin there that passes
// OpenCode's events to Pebble in Claude Code's shape. OpenCode runs any provider, DeepSeek too: the model of the turn
// goes along, so the island shows it. Status only: OpenCode asks its permissions in its own UI.
export const PLUGIN_FILE = path.join(os.homedir(), '.config', 'opencode', 'plugins', 'pebble.js')
export interface Install { port: number; token: string }

export function plugin(o: Install): string {
  return `// Pebble for OpenCode: shows what OpenCode does in the Pebble island. Written by Pebble; untick OpenCode in Pebble's
// tray (or delete this file) to remove it.
const URL = 'http://127.0.0.1:${o.port}/hook?agent=opencode'
const TOKEN = '${o.token}'
const assistant = new Set(), lastText = new Map(), model = new Map()
const send = body => fetch(URL, {
  method: 'POST', headers: { 'X-Pebble-Token': TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...body, _pid: process.pid }), signal: AbortSignal.timeout(2000)
}).catch(() => {}) // Pebble not running: OpenCode goes on as if nothing happened

export const Pebble = async ({ directory }) => ({
  event: async ({ event }) => {
    const p = event.properties ?? {}
    const id = p.sessionID ?? p.info?.sessionID ?? p.info?.id ?? p.part?.sessionID
    if (!id) return
    const base = { session_id: id, cwd: directory }
    switch (event.type) {
      case 'session.created': return send({ ...base, hook_event_name: 'SessionStart' })
      case 'message.updated':
        if (p.info?.role === 'assistant') { assistant.add(p.info.id); if (p.info.modelID) model.set(id, [p.info.providerID, p.info.modelID].filter(Boolean).join('/')) }
        return
      case 'message.part.updated':
        if (p.part?.type === 'text' && assistant.has(p.part.messageID)) lastText.set(id, p.part.text)
        return
      case 'session.idle': {
        const text = lastText.get(id); lastText.delete(id)
        return send({ ...base, hook_event_name: 'Stop', last_assistant_message: text, _model: model.get(id) })
      }
      case 'session.error': return send({ ...base, hook_event_name: 'StopFailure', error: p.error?.data?.message ?? p.error?.name ?? 'OpenCode stopped with an error' })
      case 'session.deleted': return send({ ...base, hook_event_name: 'SessionEnd' })
      case 'permission.asked':
      case 'permission.updated':
        return send({ ...base, hook_event_name: 'PermissionRequest', tool_name: p.type ?? p.permission ?? 'a tool', tool_input: { description: p.title ?? '' } })
    }
  },
  'chat.message': async (input, output) => {
    const text = (output?.parts ?? []).filter(x => x.type === 'text').map(x => x.text).join('\\n')
    if (input?.sessionID && text) send({ session_id: input.sessionID, cwd: directory, hook_event_name: 'UserPromptSubmit', prompt: text })
  },
  'tool.execute.before': async (input, output) =>
    send({ session_id: input.sessionID, cwd: directory, hook_event_name: 'PreToolUse', tool_name: input.tool, tool_input: output?.args ?? {} }),
  'tool.execute.after': async input =>
    send({ session_id: input.sessionID, cwd: directory, hook_event_name: 'PostToolUse', tool_name: input.tool })
})
`
}

export const available = () => onPath('opencode') || fs.existsSync(path.dirname(path.dirname(PLUGIN_FILE)))
export function install(o: Install, file = PLUGIN_FILE) { writeText(file, plugin(o)) }
export function remove(file = PLUGIN_FILE) { try { fs.unlinkSync(file) } catch {} }
export function installed(o: Install, file = PLUGIN_FILE) { try { return fs.readFileSync(file, 'utf8') === plugin(o) } catch { return false } }
