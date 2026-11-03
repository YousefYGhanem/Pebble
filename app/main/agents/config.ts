import fs from 'node:fs'
import path from 'node:path'

// Reading and writing other apps' config files, the same careful way for every agent:
// a file that is not valid JSON is never overwritten, a backup is made once (*.pebble-backup), writes are atomic.

export function readConfig<T extends object>(file: string): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {} as T
    throw new Error(`Cannot read ${file}: ${(err as Error).message}`)
  }
}

export function writeConfig(file: string, value: unknown) {
  backup(file)
  writeText(file, JSON.stringify(value, null, 2) + '\n')
}

export function backup(file: string) {
  const b = file + '.pebble-backup'
  if (fs.existsSync(file) && !fs.existsSync(b)) fs.copyFileSync(file, b)
}

export function writeText(file: string, text: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file + '.tmp', text)
  fs.renameSync(file + '.tmp', file)
}

/** A command (name.exe / .cmd / no extension) is on the PATH. */
export function onPath(name: string): boolean {
  return (process.env.PATH ?? '').split(path.delimiter).some(dir => dir && ['.exe', '.cmd', ''].some(ext => {
    try { return fs.statSync(path.join(dir, name + ext)).isFile() } catch { return false }
  }))
}

export const fwd = (p: string) => p.replace(/\\/g, '/') // works in Git Bash, cmd and PowerShell alike

// Pebble's lines in a text file you own (a shell profile, a YAML config), between two marker comments, so they can be
// found, updated and removed again without touching anything else. '#' starts a comment in all of them.
const START = '# >>> pebble >>>', END = '# <<< pebble <<<'

export function readBlock(file: string): string | null {
  let text: string
  try { text = fs.readFileSync(file, 'utf8') } catch { return null }
  const a = text.indexOf(START), b = text.indexOf(END)
  return a >= 0 && b > a ? text.slice(a, b + END.length) : null
}

/** Puts `body` between the markers (replacing an older block), or removes the block when body is null. */
export function setBlock(file: string, body: string | null, note: string) {
  let text = ''
  try { text = fs.readFileSync(file, 'utf8') } catch {}
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const a = text.indexOf(START), b = text.indexOf(END)
  if (a >= 0 && b > a) text = text.slice(0, a).replace(/(\r?\n)+$/, '') + text.slice(b + END.length).replace(/^\r?\n/, eol)
  if (body !== null) {
    const block = [`${START} ${note}`, ...body.split('\n'), END].join(eol)
    text = (text.trim() ? text.replace(/(\r?\n)*$/, eol + eol) : '') + block + eol
  }
  if (!text.trim() && !fs.existsSync(file)) return
  backup(file)
  writeText(file, text)
}

type Hook = { command?: string; [k: string]: unknown }
type Groups = Record<string, { hooks?: Hook[]; [k: string]: unknown }[]>

/** Removes the hooks that match from Claude-shaped `hooks` ({event: [{hooks: [...]}]}), dropping empty groups/events. */
export function stripGroups(hooks: Groups | undefined, ours: (h: Hook) => boolean): Groups | undefined {
  if (!hooks) return undefined
  for (const event of Object.keys(hooks)) {
    const groups = hooks[event]!.map(g => ({ ...g, hooks: (g.hooks ?? []).filter(h => !ours(h)) })).filter(g => g.hooks.length)
    if (groups.length) hooks[event] = groups
    else delete hooks[event]
  }
  return Object.keys(hooks).length ? hooks : undefined
}

/**
 * `pebble-native hook relay`: passes a hook's JSON to Pebble and prints what the agent expects back, even when Pebble is
 * not running: `{}`, or with reply=continue `{"continue":true}` (Cursor's beforeSubmitPrompt must answer that way).
 * A preset name instead of JSON, because quotes inside a hook command break differently in bash, cmd and PowerShell.
 */
export const relay = (exe: string, agent: string, port: number, token: string, reply?: 'continue') =>
  `"${fwd(exe)}" hook relay --agent ${agent} --port ${port} --token ${token}${reply ? ` --reply ${reply}` : ''}`
