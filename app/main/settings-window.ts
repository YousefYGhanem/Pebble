import path from 'node:path'
import { app, BrowserWindow, clipboard, ipcMain, shell } from 'electron'
import { validSettingsAction, type SettingsAction, type SettingsView } from '../shared/settings-ui'
import type { Scene } from '../shared/island'
import { report, type Check } from './diagnostics'
import { findValuesAt } from './connectors/pick'
import { logger } from './log'

const log = logger('settings')

export interface SettingsDeps {
  view(): Omit<SettingsView, 'error'>
  /** saves a settings.json change; returns the problem in words when it was refused */
  update(patch: Record<string, unknown>): string | undefined
  toggleAgent(id: string): void
  toggleTerminal(id: string): void
  toggleConnector(id: string): Promise<void>
  setConnector(id: string, key: string, value: unknown): Promise<void>
  webhook(id: string): string | null
  paths: Record<'settings' | 'themes' | 'log' | 'connectors' | 'plugins' | 'outfits' | 'extension', string>
  clearHistory(): void
  playScene(scene: Scene | null): void
  setChatKey(provider: string, key: string): void
  diagnose(): Promise<Check[]>
  /** the chosen chat provider and its models */
  chatModels(): { provider: string; list: Promise<{ id: string; name: string }[]> }
  updates: { check(): void; install(): void }
}

/**
 * The Settings window: everything the tray used to hold, as a normal window with its own taskbar button. Changes apply
 * at once (the same settings.json, checked by the same schema); the island updates live.
 */
export class SettingsWindow {
  private win?: BrowserWindow
  /** the welcome tour: the same view and actions, in a window of its own */
  private welcome?: BrowserWindow
  private error?: string
  private diagnostics?: Check[] | 'running'
  private models?: SettingsView['chatModels']
  private pick?: SettingsView['connectorPick']

  constructor(private d: SettingsDeps) {
    ipcMain.on('settings:ready', e => { if (this.from(e)) this.push() })
    ipcMain.on('settings:do', (e, a: unknown) => { if (this.from(e) && validSettingsAction(a)) void this.act(a) })
  }

  private from = (e: Electron.IpcMainEvent) => [this.win, this.welcome].some(w => !!w && !w.isDestroyed() && e.sender === w.webContents)

  private load(w: BrowserWindow, page: string) {
    w.setMenu(null)
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void w.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}/index.html`)
    else void w.loadFile(path.join(__dirname, `../renderer/${page}/index.html`))
    // links open in the browser, never inside Pebble's windows
    w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) void shell.openExternal(url); return { action: 'deny' } })
    w.webContents.on('will-navigate', e => e.preventDefault())
  }

  /** First start: the welcome tour. It stays on top until it gets its first click (so it never opens hidden behind other windows). */
  openWelcome(offscreen = false) {
    if (this.welcome && !this.welcome.isDestroyed()) { this.welcome.focus(); return this.welcome }
    this.welcome = new BrowserWindow({
      width: 600, height: 560, resizable: false, maximizable: false, minimizable: false, title: 'Welcome to Pebble', show: false, alwaysOnTop: true,
      backgroundColor: this.d.view().theme.tokens.background,
      webPreferences: { preload: path.join(__dirname, '../preload/settings.js'), contextIsolation: true, sandbox: true, offscreen }
    })
    this.load(this.welcome, 'welcome')
    if (!offscreen) this.welcome.once('ready-to-show', () => this.welcome?.show())
    this.welcome.on('closed', () => { this.welcome = undefined; if (!this.d.view().settings.general.welcomed && !offscreen) this.d.update({ general: { welcomed: true } }) })
    return this.welcome
  }

  /** offscreen: never shown (screenshots for the docs) */
  open(offscreen = false) {
    if (this.win && !this.win.isDestroyed()) { if (this.win.isMinimized()) this.win.restore(); this.win.focus(); return this.win }
    this.win = new BrowserWindow({
      width: 940, height: 680, minWidth: 760, minHeight: 520, title: 'Pebble Settings', show: false, autoHideMenuBar: true,
      backgroundColor: this.d.view().theme.tokens.background,
      webPreferences: { preload: path.join(__dirname, '../preload/settings.js'), contextIsolation: true, sandbox: true, offscreen }
    })
    this.load(this.win, 'settings')
    if (!offscreen) this.win.once('ready-to-show', () => this.win?.show())
    this.win.on('closed', () => { this.win = undefined; this.error = undefined })
    return this.win
  }

  /** Call whenever anything it shows changed (settings, agents, connectors…). */
  push() {
    const open = [this.win, this.welcome].filter(w => w && !w.isDestroyed()) as BrowserWindow[]
    if (!open.length) return
    const view = { ...this.d.view(), chatModels: this.models, connectorPick: this.pick, diagnostics: this.diagnostics, error: this.error } satisfies SettingsView
    for (const w of open) w.webContents.send('settings:view', view)
  }

  private async act(a: SettingsAction) {
    this.error = undefined
    try {
      switch (a.do) {
        case 'update': this.error = this.d.update(a.patch); break
        case 'agent': this.d.toggleAgent(a.id); break
        case 'terminal': this.d.toggleTerminal(a.id); break
        case 'connector': await this.d.toggleConnector(a.id); break
        case 'connector.set': await this.d.setConnector(a.id, a.key, a.value); if (this.pick?.id === a.id && this.pick.key === a.key) this.pick = undefined; break
        case 'connector.pickClose': this.pick = undefined; break
        case 'connector.pick': {
          const c = this.d.view().connectors.find(x => x.id === a.id), field = c?.fields.find(f => f.key === a.key)
          const url = String(c?.fields.find(f => f.key === field?.pick)?.value ?? '')
          if (!field?.pick) break
          this.pick = { id: a.id, key: a.key, items: [], loading: true }
          this.push()
          try { this.pick = { id: a.id, key: a.key, items: await findValuesAt(url) } } catch (err) { this.pick = { id: a.id, key: a.key, items: [], error: (err as Error).message } }
          break
        }
        case 'copyWebhook': { const u = this.d.webhook(a.id); if (u) clipboard.writeText(u); break }
        case 'open': void shell.openPath(this.d.paths[a.what]); break
        case 'history.clear': this.d.clearHistory(); break
        case 'scene': this.d.playScene(a.scene); break
        case 'copyExtensionKey': clipboard.writeText(this.d.view().extension.key); break
        case 'chat.key': this.d.setChatKey(a.provider, a.value); this.models = undefined; break // a new key: list its models again
        case 'chat.models': {
          const { provider, list } = this.d.chatModels()
          this.models = { provider, list: [], loading: true }
          this.push()
          try { this.models = { provider, list: await list } } catch (err) { this.models = { provider, list: [], error: (err as Error).message } }
          break
        }
        case 'restart': app.relaunch(); app.quit(); return
        case 'quit': app.quit(); return
        case 'diagnose':
          this.diagnostics = 'running'
          this.push()
          this.diagnostics = await this.d.diagnose().catch(err => [{ name: 'Diagnostics', ok: false, detail: (err as Error).message }])
          break
        case 'copyDiagnostics': if (Array.isArray(this.diagnostics)) clipboard.writeText(report(this.diagnostics)); break
        case 'welcome': this.openWelcome(); break
        case 'update.check': this.d.updates.check(); break
        case 'update.install': this.d.updates.install(); return
        case 'welcome.clicked': this.welcome?.setAlwaysOnTop(false); return
        case 'welcome.done': this.error = this.d.update({ general: { welcomed: true } }); this.welcome?.close(); break
      }
    } catch (err) {
      this.error = (err as Error).message
      log.warn(a.do, this.error)
    }
    this.push()
  }
}
