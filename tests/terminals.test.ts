import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from 'vitest'
import { snippet } from '../app/main/agents/terminals'

const hasBash = (() => { try { execFileSync('bash', ['--version']); return true } catch { return false } })()

/** The DEBUG trap an interactive bash ends up with after reading this .bashrc. */
function trapAfter(rc: string): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-bash-')), 'rc')
  fs.writeFileSync(file, rc)
  return execFileSync('bash', ['--rcfile', file, '-i', '-c', 'trap -p DEBUG'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

test.skipIf(!hasBash)('the bash snippet runs after a DEBUG trap you already have, and is added only once', () => {
  const pebble = snippet('bash', { nativeExe: 'C:/x/pebble-native.exe', minSeconds: 10 })
  expect(trapAfter(`trap 'echo "it'\\''s" >/dev/null' DEBUG\n${pebble}`)).toBe(`trap -- '__pebble_start; echo "it'\\''s" >/dev/null' DEBUG`)
  expect(trapAfter(`${pebble}\n${pebble}`)).toBe("trap -- '__pebble_start' DEBUG")
  // bash-preexec owns the trap: Pebble joins its list instead
  expect(execFileSync('bash', ['-c', `bash_preexec_imported=defined; preexec_functions=(x)\n${pebble}\n${pebble}\necho "\${preexec_functions[*]}"`], { encoding: 'utf8' }).trim()).toBe('x __pebble_start')
}, 30000)
