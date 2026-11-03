import fs from 'node:fs'
import path from 'node:path'

// One log file in userData/logs (pebble.log, the previous one kept as pebble.old.log once it passes 1 MB).
// Secrets never reach it: tokens, API keys and bearer headers are masked before writing.
let file = ''
const MAX = 1024 * 1024

export function redact(text: string): string {
  return text
    .replace(/\b[a-f0-9]{48}\b/g, '[token]')
    .replace(/\b(sk|ghp|gho|github_pat)[-_][A-Za-z0-9_-]{8,}/g, '[key]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [hidden]')
    .replace(/((?:api[_-]?key|token|authorization|password)["']?\s*[=:]\s*["']?)[^\s"',;&]+/gi, '$1[hidden]')
}

export function initLog(dir: string): string {
  fs.mkdirSync(dir, { recursive: true })
  file = path.join(dir, 'pebble.log')
  try { if (fs.statSync(file).size > MAX) fs.renameSync(file, path.join(dir, 'pebble.old.log')) } catch {}
  return file
}

function write(level: string, scope: string, msg: unknown[]) {
  const text = msg.map(m => (m instanceof Error ? m.stack || m.message : typeof m === 'string' ? m : JSON.stringify(m))).join(' ')
  const line = redact(`${new Date().toISOString()} ${level} [${scope}] ${text}`)
  ;(level === 'ERROR' ? console.error : console.log)(line)
  if (file) try { fs.appendFileSync(file, line + '\n') } catch {}
}

export const logger = (scope: string) => ({
  info: (...m: unknown[]) => write('INFO', scope, m),
  warn: (...m: unknown[]) => write('WARN', scope, m),
  error: (...m: unknown[]) => write('ERROR', scope, m)
})
