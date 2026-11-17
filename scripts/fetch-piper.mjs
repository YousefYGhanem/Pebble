// Piper, the offline speech engine Pebble reads messages aloud with (MIT; github.com/rhasspy/piper, its last Windows
// build). Downloaded once into build/piper, checked against this release's SHA-256, and packed with the app
// (electron-builder.yml → resources/piper). The voices themselves download per language when first used (main/voices.ts).
// Run on its own (npm run app) or imported by build-native.mjs: it never ends the process, it throws on a problem.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const URL = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip'
const SHA256 = 'f3c58906402b24f3a96d92145f58acba6d86c9b5db896d207f78dc80811efcea'
const dir = path.resolve('build/piper')

if (!fs.existsSync(path.join(dir, 'piper.exe'))) {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`piper: ${res.status} ${res.statusText}`)
  const zip = Buffer.from(await res.arrayBuffer())
  const sum = createHash('sha256').update(zip).digest('hex')
  if (sum !== SHA256) throw new Error(`piper: unexpected download (sha256 ${sum})`)
  const tmp = path.resolve('build/piper-download.zip'), out = path.resolve('build/piper-unzip')
  fs.writeFileSync(tmp, zip)
  fs.rmSync(out, { recursive: true, force: true })
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${tmp}' -DestinationPath '${out}' -Force`], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error('piper: could not unzip')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.renameSync(path.join(out, 'piper'), dir) // the zip holds one folder, piper/
  fs.rmSync(out, { recursive: true, force: true })
  fs.rmSync(tmp, { force: true })
  console.log('piper ready in build/piper')
}
