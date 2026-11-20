// `npm run app`: builds Pebble and starts it as dist/win-unpacked/Pebble.exe, the real app (its name and icon in Task
// Manager, the firewall and the taskbar) instead of electron.exe. A Pebble already started this way is closed first.
// For editing with hot reload, `npm run dev` stays the quicker way.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const exe = path.resolve('dist/win-unpacked/Pebble.exe')
const sh = cmd => execFileSync(cmd, { stdio: 'inherit', shell: true })

if (fs.existsSync(exe)) {
  spawnSync(exe, ['--quit']) // asks the running Pebble to quit (starts nothing when none runs)
  // wait until its files are free, or the build cannot replace them
  for (let i = 0; i < 20 && spawnSync('tasklist', ['/FI', 'IMAGENAME eq Pebble.exe', '/NH']).stdout.toString().includes('Pebble.exe'); i++) {
    await new Promise(r => setTimeout(r, 250))
  }
}
if (!fs.existsSync('native/publish/pebble-native.exe')) sh('npm run build:native')
sh('npx electron-vite build')
sh('npx electron-builder --win --dir --publish never')
spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
console.log(`Pebble started: ${exe}`)
