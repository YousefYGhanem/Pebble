import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { app, clipboard, nativeImage, shell } from 'electron'
import type { Action, ExtrasState, Media, Note, ShelfFile } from '../../shared/extras'
import type { Settings } from '../../shared/settings'
import type { Native } from '../native'
import { Lyrics } from './lyrics'
import { writeJsonAtomic } from '../store'
import { logger } from '../log'

const log = logger('extras')
const MAX_SHELF = 24, MAX_CLIPS = 25, MAX_NOTES = 50
const IMAGE = /\.(png|jpe?g|gif|webp|bmp)$/i
// password managers mark what they copy like this; Windows' own clipboard history skips it too
const PRIVATE_FORMATS = ['ExcludeClipboardContentFromMonitorProcessing', 'Clipboard Viewer Ignore']

/**
 * The extras' state and what they do (shared/extras.ts). Emits 'change' when the island should redraw,
 * 'peak' (0–1, ~30 a second while music plays) and 'focus-done'.
 */
export class Extras extends EventEmitter {
  state: ExtrasState = { media: null, art: null, lyrics: null, shelf: [], clipboard: [], notes: [], focus: null, system: { cpu: 0, ram: 0 }, radios: null, drop: null, volume: null }
  private lyrics: Lyrics
  private songKey = ''
  private lastClip = ''
  private clipId = 0
  private cpuPrev = os.cpus()
  private focusTimer?: NodeJS.Timeout

  constructor(private dir: string, private native: Native, private settings: () => Settings) {
    super()
    this.lyrics = new Lyrics(dir)
    try { const v = JSON.parse(fs.readFileSync(this.file('notes'), 'utf8')); if (Array.isArray(v)) this.state.notes = v.slice(0, MAX_NOTES) } catch {}
    try {
      const v = JSON.parse(fs.readFileSync(this.file('shelf'), 'utf8'))
      if (Array.isArray(v)) void this.addToShelf(v.filter(f => typeof f?.path === 'string').map(f => f.path), v.map(f => f.addedAt))
    } catch {}
  }

  private file = (name: string) => path.join(this.dir, name + '.json')
  private changed = () => this.emit('change')

  start() {
    this.native.on('media', (m: Media | null) => void this.onMedia(m))
    this.native.on('peak', (p: number) => this.emit('peak', p))
    // Windows' volume, also when you change it elsewhere (keyboard keys, the taskbar)
    this.native.on('audio', (a: { volume: number; muted: boolean } | null) => { this.state.volume = a ? { level: a.volume, muted: a.muted } : null; this.changed() })
    this.native.on('ready', () => void this.readRadios())
    this.applySettings()
    setInterval(() => void this.readClipboard(), 1000).unref()
    setInterval(() => this.sampleSystem(), 3000).unref()
    setInterval(() => void this.readRadios(), 60_000).unref()
  }

  /** Music on/off from the settings. */
  applySettings() {
    const on = this.settings().music.enabled
    this.native.watch('media', on)
    this.native.watch('audio', on)
    if (!on && this.state.media) { this.state.media = null; this.state.art = null; this.state.lyrics = null; this.native.watch('peaks', false); this.changed() }
  }

  // ---------- music ----------

  private async onMedia(m: Media | null) {
    if (!this.settings().music.enabled) return
    const wasPlaying = !!this.state.media?.playing
    this.state.media = m && (m.title || m.artist) ? m : null
    const key = m ? `${m.app}\n${m.artist}\n${m.title}` : ''
    if (key !== this.songKey) {
      this.songKey = key
      this.state.art = null
      this.state.lyrics = null
      if (m) {
        this.native.request<string | null>('media.art').then(art => { if (this.songKey === key) { this.state.art = art; this.changed() } }).catch(() => {})
        if (this.settings().music.lyrics) {
          this.lyrics.get(m).then(lines => { if (this.songKey === key) { this.state.lyrics = lines; this.changed() } }).catch(() => {})
        }
      }
    }
    // the sound level only while something plays (the island's wave)
    if (!!this.state.media?.playing !== wasPlaying) this.native.watch('peaks', !!this.state.media?.playing)
    this.changed()
  }

  // ---------- the file shelf ----------

  private async addToShelf(paths: string[], addedAt: number[] = []) {
    for (const [i, p] of paths.entries()) {
      if (this.state.shelf.some(f => f.path === p)) continue
      let st: fs.Stats
      try { st = fs.statSync(p) } catch { continue }
      if (!st.isFile()) continue
      let icon = ''
      try {
        icon = IMAGE.test(p)
          ? (await nativeImage.createThumbnailFromPath(p, { width: 120, height: 120 })).toDataURL()
          : (await app.getFileIcon(p, { size: 'large' })).toDataURL()
      } catch {}
      this.state.shelf = [{ path: p, name: path.basename(p), icon, size: st.size, addedAt: addedAt[i] ?? Date.now() } satisfies ShelfFile, ...this.state.shelf].slice(0, MAX_SHELF)
    }
    this.saveShelf()
  }

  private saveShelf() {
    try { writeJsonAtomic(this.file('shelf'), this.state.shelf.map(f => ({ path: f.path, addedAt: f.addedAt }))) } catch {}
    this.changed()
  }

  /** Adds a file (also from the phone drop). */
  shelve(paths: string[]) { return this.addToShelf(paths) }

  // ---------- clipboard: kept in memory only, never written to disk ----------

  private reading = false
  private async readClipboard() {
    if (!this.settings().clipboard.enabled) { if (this.state.clipboard.length) { this.state.clipboard = []; this.changed() } return }
    if (this.reading) return
    this.reading = true
    let text = ''
    try {
      for (const f of PRIVATE_FORMATS) if (await clipboard.has(`electron application/osclipboard;format="${f}"`)) return
      text = await clipboard.readText()
    } catch { return } finally { this.reading = false }
    if (!text.trim() || text === this.lastClip) return
    this.lastClip = text
    this.state.clipboard = [{ id: ++this.clipId, text: text.slice(0, 5000), at: Date.now() }, ...this.state.clipboard.filter(c => c.text !== text.slice(0, 5000))].slice(0, MAX_CLIPS)
    this.changed()
  }

  // ---------- PC ----------

  private sampleSystem() {
    const now = os.cpus()
    let busy = 0, total = 0
    now.forEach((c, i) => {
      const p = this.cpuPrev[i]?.times, t = c.times
      if (!p) return
      const d = (k: keyof typeof t) => t[k] - p[k]
      const all = d('user') + d('nice') + d('sys') + d('idle') + d('irq')
      busy += all - d('idle'); total += all
    })
    this.cpuPrev = now
    const cpu = total ? Math.round((busy / total) * 100) : 0
    const ram = Math.round((1 - os.freemem() / os.totalmem()) * 100)
    if (Math.abs(cpu - this.state.system.cpu) >= 2 || Math.abs(ram - this.state.system.ram) >= 1) { this.state.system = { cpu, ram }; this.changed() }
  }

  private async readRadios() {
    if (!this.native.available) return
    try {
      const list = await this.native.request<{ kind: string; on: boolean }[]>('radios.get')
      const r = { wifi: list.find(x => x.kind === 'wifi')?.on, bluetooth: list.find(x => x.kind === 'bluetooth')?.on }
      if (JSON.stringify(r) !== JSON.stringify(this.state.radios)) { this.state.radios = r; this.changed() }
    } catch (err) { log.warn('radios:', (err as Error).message) }
  }

  // ---------- focus timer ----------

  private schedule() {
    clearTimeout(this.focusTimer)
    const f = this.state.focus
    if (!f?.endsAt) return
    this.focusTimer = setTimeout(() => {
      this.state.focus = null
      this.emit('focus-done', f.seconds)
      this.changed()
    }, Math.max(0, f.endsAt - Date.now()))
  }

  // ---------- actions from the island ----------

  async act(a: Action) {
    const s = this.state
    switch (a.do) {
      case 'media': return this.native.request('media.control', { action: a.action, positionMs: a.positionMs ?? 0 })
      case 'volume': return this.native.request('audio.set', { volume: Math.round(a.volume) })
      case 'shelf.add': return this.addToShelf(a.paths)
      case 'shelf.open': if (s.shelf.some(f => f.path === a.path)) await shell.openPath(a.path); return
      case 'shelf.reveal': if (s.shelf.some(f => f.path === a.path)) shell.showItemInFolder(a.path); return
      case 'shelf.remove': s.shelf = s.shelf.filter(f => f.path !== a.path); return this.saveShelf()
      case 'shelf.clear': s.shelf = []; return this.saveShelf()
      case 'clip.copy': {
        const c = s.clipboard.find(x => x.id === a.id)
        if (c) { this.lastClip = c.text; await clipboard.writeText(c.text) }
        return
      }
      case 'clip.clear': s.clipboard = []; return this.changed()
      case 'notes.save':
        s.notes = a.notes.slice(0, MAX_NOTES)
        try { writeJsonAtomic(this.file('notes'), s.notes) } catch {}
        return this.changed()
      case 'focus.start': s.focus = { seconds: a.seconds, endsAt: Date.now() + a.seconds * 1000 }; this.schedule(); return this.changed()
      case 'focus.pause':
        if (s.focus?.endsAt) { s.focus = { seconds: s.focus.seconds, left: Math.max(0, Math.round((s.focus.endsAt - Date.now()) / 1000)) }; this.schedule() }
        return this.changed()
      case 'focus.resume':
        if (s.focus?.left !== undefined) { s.focus = { seconds: s.focus.seconds, endsAt: Date.now() + s.focus.left * 1000 }; this.schedule() }
        return this.changed()
      case 'focus.stop': s.focus = null; this.schedule(); return this.changed()
      case 'radio':
        if (!(await this.native.request<boolean>('radios.set', { kind: a.kind, on: a.on }))) {
          // Windows did not let Pebble switch it: open Windows' own switches
          void shell.openExternal(a.kind === 'wifi' ? 'ms-settings:network-wifi' : 'ms-settings:bluetooth')
        }
        return this.readRadios()
      case 'open': return shell.openExternal(a.what === 'wifi' ? 'ms-availablenetworks:' : 'ms-settings:bluetooth')
      default: return // drop.* and shelf.drag are handled in index.ts (they need the window)
    }
  }
}

/** Only well-formed actions from the island reach the extras. */
export function validAction(a: unknown): a is Action {
  const o = a as Record<string, unknown>
  if (!o || typeof o !== 'object' || typeof o.do !== 'string') return false
  const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 4096
  switch (o.do) {
    case 'media': return ['toggle', 'next', 'previous', 'seek'].includes(o.action as string) && (o.positionMs === undefined || (typeof o.positionMs === 'number' && o.positionMs >= 0))
    case 'volume': return typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 100
    case 'shelf.add': return Array.isArray(o.paths) && o.paths.length <= 50 && o.paths.every(str)
    case 'shelf.open': case 'shelf.reveal': case 'shelf.remove': case 'shelf.drag': return str(o.path)
    case 'clip.copy': return Number.isInteger(o.id)
    case 'notes.save': return Array.isArray(o.notes) && o.notes.length <= MAX_NOTES
      && o.notes.every((n: Note) => n && typeof n.id === 'string' && typeof n.text === 'string' && n.text.length <= 20000 && typeof n.at === 'number')
    case 'focus.start': return Number.isInteger(o.seconds) && (o.seconds as number) >= 1 && (o.seconds as number) <= 24 * 3600
    case 'radio': return (o.kind === 'wifi' || o.kind === 'bluetooth') && typeof o.on === 'boolean'
    case 'open': return o.what === 'wifi' || o.what === 'bluetooth'
    case 'shelf.clear': case 'clip.clear': case 'focus.pause': case 'focus.resume': case 'focus.stop': case 'drop.start': case 'drop.stop': case 'drop.allow': case 'drop.network': case 'settings.open': case 'chat.stop': case 'chat.clear': case 'chat.signIn': case 'chat.windows': case 'chat.dictate': return true
    case 'chat.look': return Number.isSafeInteger(o.hwnd)
    case 'chat.say': return o.at === null || Number.isFinite(o.at)
    case 'word.check': case 'word.close': return true
    case 'word.apply': return Array.isArray(o.picks) && o.picks.length <= 25 && o.picks.every(Number.isInteger)
    case 'chat.send': return typeof o.text === 'string' && o.text.length <= 20000
    case 'widget.open': return str(o.plugin) && str(o.id)
    default: return false
  }
}
