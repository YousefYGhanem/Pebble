// Pebble for VS Code and Cursor (plain JavaScript: no build step).
//  - vscode://pebble.pebble/focus?pids=1,2,3 (or cursor://…): shows the terminal tab whose shell is one of those
//    processes. Pebble opens this URL from "Jump to terminal" when an agent runs in this editor.
//  - optional: tells Pebble when a long terminal command finishes (terminal shell integration, VS Code 1.93+).
const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const http = require('http')

/** Pebble's port and token (%APPDATA%\Pebble), or null when Pebble is not set up. */
function pebble() {
  const dir = path.join(process.env.APPDATA || '', 'Pebble')
  try {
    const token = fs.readFileSync(path.join(dir, 'hook-token'), 'utf8').trim()
    let port = 47901
    try { port = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).server?.port ?? port } catch {}
    return { port, token }
  } catch { return null }
}

function notify(body) {
  const p = pebble()
  if (!p) return
  const data = Buffer.from(JSON.stringify(body))
  const req = http.request({ host: '127.0.0.1', port: p.port, path: '/notify', method: 'POST', timeout: 3000,
    headers: { 'X-Pebble-Token': p.token, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length } })
  req.on('error', () => {}) // Pebble not running: nothing to do
  req.on('timeout', () => req.destroy())
  req.end(data)
}

const duration = s => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)

function activate(context) {
  context.subscriptions.push(vscode.window.registerUriHandler({
    async handleUri(uri) {
      if (uri.path !== '/focus') return
      const pids = (new URLSearchParams(uri.query).get('pids') || '').split(',').map(Number).filter(Boolean)
      for (const terminal of vscode.window.terminals) {
        const pid = await terminal.processId
        if (pid && pids.includes(pid)) { terminal.show(false); return }
      }
    }
  }))

  const started = new WeakMap()
  context.subscriptions.push(vscode.window.onDidStartTerminalShellExecution(e => started.set(e.execution, Date.now())))
  context.subscriptions.push(vscode.window.onDidEndTerminalShellExecution(e => {
    const cfg = vscode.workspace.getConfiguration('pebble')
    const t0 = started.get(e.execution)
    if (!cfg.get('notifyLongCommands') || !t0) return
    const s = Math.round((Date.now() - t0) / 1000)
    if (s < cfg.get('minSeconds', 10)) return
    notify({
      title: vscode.env.appName,
      text: `${e.execution.commandLine.value.slice(0, 80)} - ${duration(s)}`,
      kind: e.exitCode === undefined || e.exitCode === 0 ? 'done' : 'error'
    })
  }))
}

module.exports = { activate, deactivate() {} }
