import path from 'node:path'
import { app, BrowserWindow, ipcMain, screen } from 'electron'
import type { Settings } from '../../shared/settings'
import type { Native, WinInfo } from '../native'
import { logger } from '../log'

const log = logger('guard')
const BROWSERS = /^(chrome|msedge|firefox|brave|opera|vivaldi|arc|chromium|zen|floorp|waterfox|librewolf)$/i

/**
 * Which of your distracting sites/apps this window is: an app by its program name; a site only in a browser, by the
 * tab title (browsers put the page title in the window title). null: not one of yours.
 */
export function matchSite(w: { title?: string; process?: string }, sites: string[]): string | null {
  const title = (w.title ?? '').toLowerCase(), proc = (w.process ?? '').toLowerCase().replace(/\.exe$/, '')
  for (const raw of sites) {
    const site = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
    if (!site) continue
    if (proc === site) return raw
    const name = site.replace(/\.(com|org|net|tv|io|app)$/, '') // "youtube.com" also matches a "YouTube" title
    if (BROWSERS.test(proc) && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(title)) return raw
  }
  return null
}

/** Whether the guard acts now: switched on, and (unless set to always) while a focus timer runs. */
export const guardActive = (g: Settings['focusGuard'], focusing: boolean) => g.enabled && (!g.onlyDuringFocus || focusing)

/**
 * The focus guard ("one sec"): when you open a site or app from your list, a calm screen asks you to breathe once; then
 * go back (the window is minimised) or open it anyway (left alone for snoozeMinutes). Looks only at the title and
 * program of the window in front, on this PC; nothing is kept but today's counts, in memory.
 */
export class FocusGuard {
  private win?: BrowserWindow
  private snoozed = new Map<string, number>()
  private shownFor = 0 // the window it is shown for (hwnd)
  today: Record<string, number> = {}

  constructor(private native: Native, private settings: () => Settings, private focusing: () => boolean, private preload: string, private page: () => { url?: string; file: string }) {
    native.on('foreground', (w: WinInfo | null) => this.check(w))
    ipcMain.on('guard:choose', (e, choice: unknown) => {
      if (!this.win || e.sender !== this.win.webContents) return
      this.choose(choice === 'anyway' ? 'anyway' : 'back')
    })
  }

  /** Watches the window in front only while the guard may act (call again when the settings or the focus timer change). */
  apply() { this.native.watch('foreground', guardActive(this.settings().focusGuard, this.focusing()), 'guard') }

  private site = ''
  private check(w: WinInfo | null) {
    const g = this.settings().focusGuard
    if (!guardActive(g, this.focusing()) || !w || this.win) return
    const site = matchSite(w, g.sites)
    if (!site || (this.snoozed.get(site) ?? 0) > Date.now()) return
    this.site = site
    this.shownFor = w.hwnd
    this.today[site] = (this.today[site] ?? 0) + 1
    this.show(w)
  }

  private show(w: WinInfo) {
    const display = screen.getDisplayMatching(screen.screenToDipRect(null, { x: w.rect.x, y: w.rect.y, width: w.rect.w, height: w.rect.h }))
    this.win = new BrowserWindow({
      ...display.bounds, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, alwaysOnTop: true,
      show: false, webPreferences: { preload: this.preload, contextIsolation: true, sandbox: true }
    })
    this.win.setAlwaysOnTop(true, 'screen-saver')
    const p = this.page()
    if (p.url) this.win.loadURL(`${p.url}/guard/index.html#${encodeURIComponent(this.site)}`)
    else this.win.loadFile(p.file, { hash: encodeURIComponent(this.site) })
    this.win.once('ready-to-show', () => { this.win?.show(); this.win?.focus() })
    this.win.on('closed', () => { this.win = undefined })
    log.info(`guard: ${this.site}`)
  }

  private choose(choice: 'back' | 'anyway') {
    if (choice === 'anyway') this.snoozed.set(this.site, Date.now() + this.settings().focusGuard.snoozeMinutes * 60_000)
    else this.native.request('window.minimize', { hwnd: this.shownFor }).catch(() => {})
    this.win?.close()
  }
}

export const guardPreload = () => path.join(__dirname, '../preload/guard.js')
export const guardPage = () => ({ url: !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined, file: path.join(__dirname, '../renderer/guard/index.html') })
