import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { logger } from './log'

const log = logger('update')

export type UpdateState =
  | { state: 'off' } // running from source (npm run dev): nothing to update
  | { state: 'idle' | 'checking' | 'latest' }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; error: string }

/**
 * Updates from GitHub Releases (electron-builder.yml → publish). Checks a minute after start and every 6 hours, downloads
 * in the background, and installs when you choose "Restart to update" (or the next time Pebble quits).
 * Emits 'change' with the new state.
 */
export class Updater extends EventEmitter {
  // from source, or a local build (npm run app writes no app-update.yml: only the installer build says where updates come from)
  status: UpdateState = { state: app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml')) ? 'idle' : 'off' }
  private timer?: NodeJS.Timeout

  constructor(private enabled: () => boolean) {
    super()
    if (this.status.state === 'off') return
    const u = electronUpdater.autoUpdater
    u.logger = { info: (m: unknown) => log.info(String(m)), warn: (m: unknown) => log.warn(String(m)), error: (m: unknown) => log.error(String(m)), debug: () => {} }
    u.autoDownload = true
    u.autoInstallOnAppQuit = true
    u.on('checking-for-update', () => this.set({ state: 'checking' }))
    u.on('update-not-available', () => this.set({ state: 'latest' }))
    u.on('update-available', info => this.set({ state: 'downloading', version: info.version, percent: 0 }))
    u.on('download-progress', p => { if (this.status.state === 'downloading') this.set({ ...this.status, percent: Math.round(p.percent) }) })
    u.on('update-downloaded', info => this.set({ state: 'ready', version: info.version }))
    u.on('error', err => this.set({ state: 'error', error: err.message.split('\n')[0]!.slice(0, 200) }))
  }

  private set(s: UpdateState) { this.status = s; this.emit('change', s) }

  /** Starts (or stops) the regular checks, as the settings say. */
  apply() {
    if (this.status.state === 'off') return
    if (this.enabled() && !this.timer) {
      setTimeout(() => this.check(), 60_000).unref()
      this.timer = setInterval(() => this.check(), 6 * 3600_000)
      this.timer.unref()
    }
    if (!this.enabled() && this.timer) { clearInterval(this.timer); this.timer = undefined }
  }

  check() {
    if (this.status.state === 'off' || this.status.state === 'downloading' || this.status.state === 'ready') return
    electronUpdater.autoUpdater.checkForUpdates().catch(err => this.set({ state: 'error', error: (err as Error).message.slice(0, 200) }))
  }

  /** Quits, installs quietly, and starts the new Pebble. */
  install() {
    if (this.status.state === 'ready') electronUpdater.autoUpdater.quitAndInstall(true, true)
  }
}
