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
try { fs.copyFileSync('native/publish/pebble-native.exe', 'native/out/pebble-native.exe') }
catch (err) {
  // a running Pebble (or an agent's MCP server) holds the old one: the new one is in native/publish meanwhile
  console.warn(`native/out/pebble-native.exe is in use (${err.code}); quit Pebble and run this again to update it there.`)
}
