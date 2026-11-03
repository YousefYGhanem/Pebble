import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fwd, onPath, readBlock, setBlock } from './config'

// "A long command finished": a few lines in your shell's start-up file time each command and, when it took at least
// minSeconds, run `pebble-native cli notify` (the island + a Windows notification; red when it failed). Works in every
// terminal (Windows Terminal, VS Code, the old console). Added and removed from the tray (Terminals).
//   PowerShell 5.1 and 7: wraps your prompt function (kept as it was) in their profile files
//   Git Bash: a DEBUG trap + PROMPT_COMMAND in ~/.bashrc (it replaces another DEBUG trap you may have, e.g. bash-preexec)
// Plain ASCII only: Windows PowerShell 5.1 reads a profile without a BOM in the old code page.
export interface Install { nativeExe: string; minSeconds: number }
export type Shell = 'powershell' | 'pwsh' | 'bash'

const NOTE = '(added by Pebble: tells you when a long command finishes; tray -> Terminals to remove)'

export function profileFile(shell: Shell, documents: string): string {
  if (shell === 'powershell') return path.join(documents, 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
  if (shell === 'pwsh') return path.join(documents, 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
  return path.join(os.homedir(), '.bashrc')
}

/** Shells on this PC (Windows PowerShell always). */
export function shells(documents: string): Shell[] {
  const list: Shell[] = ['powershell']
  if (onPath('pwsh') || fs.existsSync(path.join(documents, 'PowerShell'))) list.push('pwsh')
  if (onPath('bash') || fs.existsSync(path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe'))) list.push('bash')
  return list
}

export function snippet(shell: Shell, o: Install): string {
  if (shell === 'bash') {
    const exe = fwd(o.nativeExe).replace(/^([A-Za-z]):/, (_, d: string) => '/' + d.toLowerCase()) // C:/x -> /c/x
    return [
      '__pebble_start() { [ -n "$__pebble_prompting" ] && return; [ -z "$__pebble_t" ] && { __pebble_t=$SECONDS; __pebble_cmd=$BASH_COMMAND; }; }',
      '__pebble_done() {',
      '  local code=$? s; __pebble_prompting=1',
      '  if [ -n "$__pebble_t" ]; then',
      '    s=$((SECONDS - __pebble_t))',
      `    if [ "$s" -ge ${o.minSeconds} ]; then`,
      `      ("${exe}" cli notify "\${__pebble_cmd:0:80} - \${s}s" --title Terminal --kind "$([ $code -eq 0 ] && echo done || echo error)" >/dev/null 2>&1 &)`,
      '    fi',
      '  fi',
      '  unset __pebble_t',
      '}',
      "trap '__pebble_start' DEBUG",
      '[[ "$PROMPT_COMMAND" == *__pebble_done* ]] || PROMPT_COMMAND="__pebble_done${PROMPT_COMMAND:+; $PROMPT_COMMAND}; unset __pebble_prompting"'
    ].join('\n')
  }
  const exe = o.nativeExe.replace(/'/g, "''")
  return [
    'if (-not (Test-Path variable:global:__pebblePrompt)) {',
    '  $global:__pebblePrompt = $function:prompt',
    '  function global:prompt {',
    '    $ok = $?',
    '    $h = Get-History -Count 1',
    '    if ($h -and $h.Id -ne $global:__pebbleLast) {',
    '      $global:__pebbleLast = $h.Id',
    '      $s = [int]($h.EndExecutionTime - $h.StartExecutionTime).TotalSeconds',
    `      if ($s -ge ${o.minSeconds}) {`,
    "        $t = if ($s -ge 60) { '{0}m {1}s' -f [math]::Floor($s / 60), ($s % 60) } else { \"$($s)s\" }",
    '        $c = $h.CommandLine -replace \'"\', "\'"',
    "        if ($c.Length -gt 80) { $c = $c.Substring(0, 77) + '...' }",
    "        $k = if ($ok) { 'done' } else { 'error' }",
    `        & '${exe}' cli notify "$c - $t" --title Terminal --kind $k *> $null`,
    '      }',
    '    }',
    '    & $global:__pebblePrompt',
    '  }',
    '}'
  ].join('\n')
}

export function install(shell: Shell, o: Install, documents: string, file = profileFile(shell, documents)) { setBlock(file, snippet(shell, o), NOTE) }
export function remove(shell: Shell, documents: string, file = profileFile(shell, documents)) { if (readBlock(file)) setBlock(file, null, NOTE) }
export function installed(shell: Shell, documents: string, file = profileFile(shell, documents)) { return readBlock(file) !== null }
