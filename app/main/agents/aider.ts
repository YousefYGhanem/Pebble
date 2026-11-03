import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fwd, onPath, readBlock, setBlock } from './config'

// Aider has no hooks. It can run a command when it waits for you (notifications-command in ~/.aider.conf.yml):
// Pebble sets that to `pebble-native cli notify`, so the island and a Windows notification tell you. Your own
// notifications-command is never replaced (then Pebble stays out).
export const CONF_FILE = path.join(os.homedir(), '.aider.conf.yml')
export interface Install { nativeExe: string }

const NOTE = '(added by Pebble; untick Aider in its tray to remove)'
const body = (o: Install) => [
  'notifications: true',
  `notifications-command: '"${fwd(o.nativeExe).replace(/'/g, "''")}" cli notify "Aider is waiting for you" --title Aider'`
].join('\n')

/** You set notifications-command yourself (outside Pebble's block). */
export function ownCommand(file = CONF_FILE): boolean {
  let text = ''
  try { text = fs.readFileSync(file, 'utf8') } catch { return false }
  const mine = readBlock(file) ?? ''
  return /^notifications-command\s*:/m.test(text.replace(mine, ''))
}

export const available = () => onPath('aider') || fs.existsSync(CONF_FILE)

/** false when your own notifications-command is there (nothing changed). */
export function install(o: Install, file = CONF_FILE): boolean {
  if (ownCommand(file)) return false
  setBlock(file, body(o), NOTE)
  return true
}
export function remove(file = CONF_FILE) { setBlock(file, null, NOTE) }
export function installed(o: Install, file = CONF_FILE) { return readBlock(file)?.includes(body(o)) ?? false }
