// `npm run pack:extensions`: the files to upload to the stores, in dist/extensions/.
//   pebble-chat-<version>.zip   Chrome Web Store and Microsoft Edge Add-ons (the same zip for both)
//   pebble-<version>.vsix       VS Code Marketplace and Open VSX (Cursor), copied from extensions/vscode
// Store listings and the privacy text are in docs/STORES.md. Uploading is done by hand from the store dashboards.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const out = 'dist/extensions'
fs.mkdirSync(out, { recursive: true })

const chat = JSON.parse(fs.readFileSync('extensions/chat/manifest.json', 'utf8'))
const zip = path.join(out, `pebble-chat-${chat.version}.zip`)
fs.rmSync(zip, { force: true })
// Windows' tar writes zip files with -a; manifest.json must sit at the top of the zip
const tar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') // Windows' own (Git's tar cannot write zip)
const r = spawnSync(tar, ['-a', '-c', '-f', path.resolve(zip), '-C', 'extensions/chat', '.'], { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)
console.log('wrote', zip)

for (const f of fs.readdirSync('extensions/vscode').filter(f => f.endsWith('.vsix'))) {
  fs.copyFileSync(path.join('extensions/vscode', f), path.join(out, f))
  console.log('copied', path.join(out, f))
}
