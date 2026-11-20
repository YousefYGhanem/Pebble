// Builds native/publish/pebble-native.exe (NativeAOT; the installer takes it from there) and copies it to native/out,
// where `npm run dev` and the CLI use it. Needs the .NET 10 SDK and Visual Studio's "Desktop development with C++" (the
// linker). The AOT build finds the linker through vswhere.exe, which Visual Studio does not put on PATH.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const vswhere = path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer')
const r = spawnSync('dotnet', ['publish', 'native/PebbleNative.csproj', '-c', 'Release', '-o', 'native/publish', '-nologo'], {
  stdio: 'inherit',
  env: { ...process.env, PATH: `${process.env.PATH}${path.delimiter}${vswhere}` }
})
if (r.status !== 0) process.exit(r.status ?? 1)

fs.mkdirSync('native/out', { recursive: true })
// a running Pebble (or an agent's MCP server) keeps the old one open: Windows cannot overwrite it, but can rename it,
// so it moves aside and the new one takes its place (old copies are removed once nothing uses them)
const out = 'native/out/pebble-native.exe'
for (const f of fs.readdirSync('native/out').filter(f => /^pebble-native\.old-\d+\.exe$/.test(f))) { try { fs.rmSync(path.join('native/out', f), { force: true }) } catch { /* still in use: next time */ } }
try { fs.copyFileSync('native/publish/pebble-native.exe', out) }
catch {
  fs.renameSync(out, `native/out/pebble-native.old-${Date.now()}.exe`)
  fs.copyFileSync('native/publish/pebble-native.exe', out)
}
