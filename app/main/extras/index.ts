import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { app, clipboard, ClipboardItem, nativeImage, shell } from 'electron'
import type { RestLevel } from '../rest'
import { focusFinished, nextDue, noticesFor, toggleTodo, trimClips, type PcState, type Action, type ExtrasState, type Media, type Note, type ShelfFile } from '../../shared/extras'
import type { Settings } from '../../shared/settings'
import type { Native } from '../native'
import { Lyrics } from './lyrics'
import { writeJsonAtomic } from '../store'
import { logger } from '../log'

const log = logger('extras')
const MAX_SHELF = 24, MAX_CLIPS = 25, MAX_NOTES = 50, MAX_TODOS = 100
const IMAGE = /\.(png|jpe?g|gif|webp|bmp)$/i
// password managers mark what they copy like this; Windows' own clipboard history skips it too
const PRIVATE_FORMATS = ['ExcludeClipboardContentFromMonitorProcessing', 'Clipboard Viewer Ignore']

/**
 * The extras' state and what they do (shared/extras.ts). Emits 'change' when the island should redraw,
 * 'peak' (0–1, ~30 a second while music plays) and 'focus-done'.
 */
export class Extras extends EventEmitter {
  state: ExtrasState = { media: null, art: null, lyrics: null, shelf: [], clipboard: [], notes: [], focus: null, focusDone: null, todos: [], glasses: 0, power: null, strip: false, mic: null, system: { cpu: 0, ram: 0 }, radios: null, drop: null, volume: null }
  private lyrics: Lyrics
  private songKey = ''
  private lastClip = ''
  private clipId = 0
  private cpuPrev = os.cpus()
  private pc: PcState | null = null
  private focusTimer?: NodeJS.Timeout

  constructor(private dir: string, private native: Native, private settings: () => Settings) {
    super()
    this.lyrics = new Lyrics(dir)
    try { const v = JSON.parse(fs.readFileSync(this.file('notes'), 'utf8')); if (Array.isArray(v)) this.state.notes = v.slice(0, MAX_NOTES) } catch {}
    try { const v = JSON.parse(fs.readFileSync(this.file('todos'), 'utf8')); if (Array.isArray(v)) this.state.todos = v.slice(0, MAX_TODOS) } catch {}
    this.remind()
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
    this.native.on('audio', (a: { volume: number; muted: boolean } & PcState | null) => {
      this.state.volume = a ? { level: a.volume, muted: a.muted } : null
      this.state.mic = a?.mic ?? null
      // what changed on the PC: the island peeks at it (Settings → General → Peeks)
      if (a) { for (const n of noticesFor(this.pc, a)) this.emit('notice', n); this.pc = a }
      // Windows counts each copy: the clipboard is read only when the count moved
      const seq = (a as { clip?: number } | null)?.clip
      if (seq !== undefined && seq !== this.clipSeq) { this.clipSeq = seq; void this.readClipboard() }
      this.changed()
    })
    this.native.on('ready', () => { void this.readRadios(); this.readPower() })
    this.applySettings()
    // without the native helper (its PC poll tells when the clipboard changed), a check each second
    setInterval(() => { if (!this.native.available) void this.readClipboard() }, 1000).unref()
    setInterval(() => this.sampleSystem(), 3000).unref()
    setInterval(() => void this.readRadios(), 60_000).unref()
  }

  /** Music on/off from the settings. */
  applySettings() {
    const on = this.settings().music.enabled
    this.native.watch('media', on && this.rest !== 'off') // watching again sends the song playing now
    this.native.watch('audio', !this.deep()) // the volume (music), and the PC's changes the island peeks at
    if (!on && this.state.media) { this.state.media = null; this.state.art = null; this.state.lyrics = null; this.changed() }
    this.peaks()
  }

  /** Resting (rest.ts): 'light' stops the PC readings, 'deep' also the clipboard, the volume and the sound wave, 'off' music too. */
  rest: RestLevel = 'awake'
  private deep = () => this.rest === 'deep' || this.rest === 'off'
  setRest(level: RestLevel) {
    if (level === this.rest) return
    this.rest = level
    this.applySettings()
    if (level === 'awake') this.sampleSystem()
  }

  // the sound level only while something plays (the island's wave), and not while resting deeply
  private peaksOn = false
  private peaks() {
    const on = !!this.state.media?.playing && !this.deep()
    if (on !== this.peaksOn) { this.peaksOn = on; this.native.watch('peaks', on) }
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
    if (!!this.state.media?.playing !== wasPlaying) this.peaks()
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
  private clipSeq = -1
  /** copied pictures, by clip id (memory only; the state carries a small preview) */
  private images = new Map<number, Electron.NativeImage>()
  private lastImage = ''
  private async readClipboard() {
    if (!this.settings().clipboard.enabled) { if (this.state.clipboard.length) { this.state.clipboard = []; this.changed() } return }
    if (this.reading || this.deep()) return // away or in a game: nothing new gets copied
    this.reading = true
    let text = '', picture: Electron.NativeImage | null = null
    try {
      text = await clipboard.readText()
      if (!text.trim() && await clipboard.has('image/png')) {
        const item = (await clipboard.read()).find(i => i.types.includes('image/png'))
        if (item) picture = nativeImage.createFromBuffer(Buffer.from(await (await item.getType('image/png')).arrayBuffer()))
      }
      else {
        if (text === this.lastClip) return // nothing new (the format checks only for new text)
        this.lastClip = text
      }
      for (const f of PRIVATE_FORMATS) if (await clipboard.has(`electron application/osclipboard;format="${f}"`)) return
    } catch { return } finally { this.reading = false }
    if (picture && !picture.isEmpty()) return this.addPicture(picture)
    if (!text.trim()) return
    this.state.clipboard = trimClips([{ id: ++this.clipId, text: text.slice(0, 5000), at: Date.now() }, ...this.state.clipboard.filter(c => c.text !== text.slice(0, 5000))], MAX_CLIPS)
    this.changed()
  }

  /** A copied picture: a small preview in the list, the picture itself kept here (the newest 8). */
  private addPicture(img: Electron.NativeImage) {
    const { width, height } = img.getSize()
    const small = img.resize({ width: Math.min(160, width), quality: 'good' })
    const preview = `data:image/jpeg;base64,${small.toJPEG(72).toString('base64')}`
    if (preview === this.lastImage) return // the same picture again (copied back from the list)
    this.lastImage = preview
    const id = ++this.clipId
    this.images.set(id, img)
    let list = trimClips([{ id, text: '', image: preview, size: `${width}×${height}`, at: Date.now() }, ...this.state.clipboard], MAX_CLIPS)
    // pictures are big: the newest 8 (pinned ones stay)
    const pictures = list.filter(c => c.image && !c.pinned)
    for (const old of pictures.slice(8)) list = list.filter(c => c.id !== old.id)
    for (const key of [...this.images.keys()]) if (!list.some(c => c.id === key)) this.images.delete(key)
    this.state.clipboard = list
    this.changed()
  }

  // ---------- PC ----------

  /** the game strip shows the PC's readings, so they go on during a game */
  setStrip(on: boolean) {
    if (on === this.state.strip) return
    this.state.strip = on
    if (on) this.sampleSystem()
    this.changed()
  }
  /** Windows' power mode, read again when Home asks (it can change elsewhere) */
  readPower() { this.native.request<string | null>('power.get').then(p => { if (p !== this.state.power) { this.state.power = p as ExtrasState['power']; this.changed() } }).catch(() => {}) }

  private sampleSystem() {
    if (this.rest !== 'awake' && !this.state.strip) return
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
    if (Math.abs(cpu - this.state.system.cpu) >= 5 || Math.abs(ram - this.state.system.ram) >= 1) { this.state.system = { cpu, ram }; this.changed() }
  }

  private async readRadios() {
    if (!this.native.available || this.deep()) return
    try {
      const list = await this.native.request<{ kind: string; on: boolean }[]>('radios.get')
      const r = { wifi: list.find(x => x.kind === 'wifi')?.on, bluetooth: list.find(x => x.kind === 'bluetooth')?.on }
      if (JSON.stringify(r) !== JSON.stringify(this.state.radios)) { this.state.radios = r; this.changed() }
    } catch (err) { log.warn('radios:', (err as Error).message) }
  }

  // ---------- focus timer ----------

  // ---------- tasks: one timer, for the next task with a time ----------

  private todoTimer?: NodeJS.Timeout
  private saveTodos() {
    try { writeJsonAtomic(this.file('todos'), this.state.todos) } catch {}
    this.remind()
    this.changed()
  }
  /** Sets the timer for the next due task; when it fires, the island shows it (Done / Snooze) and Windows notifies. */
  private remind() {
    clearTimeout(this.todoTimer)
    const t = nextDue(this.state.todos)
    if (!t?.due) return
    // timers longer than about 24 days overflow: wake up a day before and look again
    this.todoTimer = setTimeout(() => {
      if (t.due! > Date.now() + 1000) return this.remind()
      this.emit('notice', { kind: 'todo', id: t.id, text: t.text })
      // fired once: it comes back only if snoozed (or its next day, if it repeats)
      this.state.todos = this.state.todos.map(x => (x.id === t.id ? { ...x, due: x.daily ? toggleTodo({ ...x, done: false }, Date.now()).due : undefined } : x))
      this.saveTodos()
    }, Math.min(Math.max(0, t.due - Date.now()), 86_400_000))
    this.todoTimer.unref?.()
  }

  private schedule() {
    clearTimeout(this.focusTimer)
    const f = this.state.focus
    if (!f?.endsAt) return
    this.focusTimer = setTimeout(() => {
      this.state.focus = null
      this.state.focusDone = focusFinished(this.state.focusDone, f, Date.now())
      this.emit('focus-done', f.seconds)
      this.changed()
    }, Math.max(0, f.endsAt - Date.now()))
  }

  // ---------- actions from the island ----------

  async act(a: Action) {
    const s = this.state
    switch (a.do) {
      case 'media': return this.native.request('media.control', { action: a.action, positionMs: a.positionMs ?? 0 })
      case 'volume': return this.native.request('audio.set', { ...(a.volume !== undefined ? { volume: Math.round(a.volume) } : {}), ...(a.muted !== undefined ? { muted: a.muted } : {}) })
      case 'shelf.add': return this.addToShelf(a.paths)
      case 'shelf.open': if (s.shelf.some(f => f.path === a.path)) await shell.openPath(a.path); return
      case 'shelf.reveal': if (s.shelf.some(f => f.path === a.path)) shell.showItemInFolder(a.path); return
      case 'shelf.remove': s.shelf = s.shelf.filter(f => f.path !== a.path); return this.saveShelf()
      case 'shelf.clear': s.shelf = []; return this.saveShelf()
      case 'clip.copy': {
        const c = s.clipboard.find(x => x.id === a.id)
        const img = c?.image ? this.images.get(c.id) : undefined
        if (img) { this.lastImage = c!.image!; await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(img.toPNG())], { type: 'image/png' }) })]) }
        else if (c) { this.lastClip = c.text; await clipboard.writeText(c.text) }
        return
      }
      case 'clip.clear': s.clipboard = s.clipboard.filter(c => c.pinned); return this.changed() // pinned ones stay
      case 'clip.pin': s.clipboard = trimClips(s.clipboard.map(c => (c.id === a.id ? { ...c, pinned: !c.pinned } : c)), MAX_CLIPS); return this.changed()
      case 'clip.remove': s.clipboard = s.clipboard.filter(c => c.id !== a.id); return this.changed()
      case 'todo.add': s.todos = [{ id: randomUUID(), text: a.text.trim().slice(0, 300), at: Date.now(), done: false, due: a.due, daily: a.daily || undefined }, ...s.todos].slice(0, MAX_TODOS); return this.saveTodos()
      case 'todo.toggle': s.todos = s.todos.map(t => (t.id === a.id ? toggleTodo(t, Date.now()) : t)); return this.saveTodos()
      case 'todo.remove': s.todos = s.todos.filter(t => t.id !== a.id); return this.saveTodos()
      case 'todo.snooze': s.todos = s.todos.map(t => (t.id === a.id ? { ...t, due: Date.now() + a.minutes * 60_000 } : t)); return this.saveTodos()
      case 'notes.save':
        s.notes = a.notes.slice(0, MAX_NOTES)
        try { writeJsonAtomic(this.file('notes'), s.notes) } catch {}
        return this.changed()
      case 'focus.start': s.focus = { seconds: a.seconds, endsAt: Date.now() + a.seconds * 1000, break: a.break || undefined }; this.schedule(); return this.changed()
      case 'focus.pause':
        if (s.focus?.endsAt) { s.focus = { seconds: s.focus.seconds, left: Math.max(0, Math.round((s.focus.endsAt - Date.now()) / 1000)), break: s.focus.break }; this.schedule() }
        return this.changed()
      case 'focus.resume':
        if (s.focus?.left !== undefined) { s.focus = { seconds: s.focus.seconds, endsAt: Date.now() + s.focus.left * 1000, break: s.focus.break }; this.schedule() }
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
    case 'volume': return (o.volume === undefined || (typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 100)) && (o.muted === undefined || typeof o.muted === 'boolean') && (o.volume !== undefined || o.muted !== undefined)
    case 'shelf.add': return Array.isArray(o.paths) && o.paths.length <= 50 && o.paths.every(str)
    case 'shelf.open': case 'shelf.reveal': case 'shelf.remove': case 'shelf.drag': return str(o.path)
    case 'clip.copy': case 'clip.remove': case 'clip.pin': return Number.isInteger(o.id)
    case 'wellness': return (o.what === 'water' || o.what === 'stand') && typeof o.done === 'boolean'
    case 'update.install': case 'mic.toggle': case 'pebble.sounds': return true
    case 'power': return ['efficiency', 'balanced', 'performance'].includes(o.mode as string)
    case 'focus.sound': return ['off', 'rain', 'deep', 'waves'].includes(o.sound as string)
    case 'tip.seen': return o.id === 'ask' || o.id === 'tuck' || o.id === 'drop'
    case 'todo.add': return typeof o.text === 'string' && !!o.text.trim() && o.text.length <= 300
      && (o.due === undefined || (typeof o.due === 'number' && o.due > 0)) && (o.daily === undefined || typeof o.daily === 'boolean')
    case 'todo.toggle': case 'todo.remove': return typeof o.id === 'string' && o.id.length <= 64
    case 'todo.snooze': return typeof o.id === 'string' && o.id.length <= 64 && Number.isInteger(o.minutes) && (o.minutes as number) >= 1 && (o.minutes as number) <= 24 * 60
    case 'notes.save': return Array.isArray(o.notes) && o.notes.length <= MAX_NOTES
      && o.notes.every((n: Note) => n && typeof n.id === 'string' && typeof n.text === 'string' && n.text.length <= 20000 && typeof n.at === 'number')
    case 'settings.open': return o.tab === undefined || o.tab === 'connectors'
    case 'focus.start': return Number.isInteger(o.seconds) && (o.seconds as number) >= 1 && (o.seconds as number) <= 24 * 3600 && (o.break === undefined || typeof o.break === 'boolean')
    case 'radio': return (o.kind === 'wifi' || o.kind === 'bluetooth') && typeof o.on === 'boolean'
    case 'open': return o.what === 'wifi' || o.what === 'bluetooth'
    case 'shelf.clear': case 'clip.clear': case 'focus.pause': case 'focus.resume': case 'focus.stop': case 'drop.start': case 'drop.stop': case 'drop.allow': case 'drop.network': case 'chat.stop': case 'chat.clear': case 'chat.signIn': case 'chat.windows': case 'chat.dictate': return true
    case 'chat.look': return Number.isSafeInteger(o.hwnd)
    case 'chat.say': return o.at === null || Number.isFinite(o.at)
    case 'word.check': case 'word.close': return true
    case 'word.apply': return Array.isArray(o.picks) && o.picks.length <= 25 && o.picks.every(Number.isInteger)
    case 'chat.send': return typeof o.text === 'string' && o.text.length <= 20000
    case 'widget.open': return str(o.plugin) && str(o.id)
    default: return false
  }
}
