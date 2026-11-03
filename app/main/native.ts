import fs from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { logger } from './log'

const log = logger('native')

/** Where pebble-native.exe lives: next to the app when installed, native/out in the repo (npm run build:native). */
export function nativeExe(appPath: string, packaged: boolean, resourcesPath = process.resourcesPath): string {
  return packaged ? path.join(resourcesPath, 'native', 'pebble-native.exe') : path.join(appPath, 'native', 'out', 'pebble-native.exe')
}

/** One captured window/point: real pixels. */
export interface WinInfo { hwnd: number; pid: number; class: string; title?: string; process?: string; rect: { x: number; y: number; w: number; h: number } }

/**
 * Pebble's native helper (native/Server.cs): one long-running process, JSON lines both ways.
 * request(cmd, args) → Promise of the result. watch(topic) switches on events ('foreground', 'media', 'audio', 'peak'),
 * which this emitter re-emits under the same name. Restarts by itself (with a growing pause) if the helper dies.
 */
export class Native extends EventEmitter {
  private child?: ChildProcess
  private next = 1
  private calls = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()
  private topics = new Map<string, Set<string>>() // topic → who wants it (game mode and the focus guard share "foreground")
  private restarts = 0
  private stopped = false
  available = false

  constructor(private exe: string) { super() }

  start() {
    this.stopped = false
    if (this.child) return
    if (!fs.existsSync(this.exe)) { log.warn(`${this.exe} is missing (npm run build:native): screen, media and jump features are off`); return }
    const child = spawn(this.exe, ['serve', '--owner', String(process.pid)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child
    let buf = ''
    child.stdout!.setEncoding('utf8')
    child.stdout!.on('data', chunk => {
      buf += chunk
      let i
      while ((i = buf.indexOf('\n')) >= 0) { this.line(buf.slice(0, i)); buf = buf.slice(i + 1) }
    })
    child.stderr!.on('data', d => log.warn(String(d).trim()))
    child.on('error', err => log.error('cannot start the native helper:', err.message))
    child.on('exit', code => {
      this.child = undefined
      this.available = false
      for (const [, c] of this.calls) { clearTimeout(c.timer); c.reject(new Error('native helper stopped')) }
      this.calls.clear()
      if (this.stopped) return
      const wait = Math.min(30_000, 500 * 2 ** this.restarts++)
      log.warn(`native helper stopped (${code}); restarting in ${wait} ms`)
      setTimeout(() => this.start(), wait).unref()
    })
  }

  stop() {
    this.stopped = true
    this.child?.stdin?.end() // the helper ends when its stdin closes
    this.child = undefined
  }

  request<T = unknown>(cmd: string, args: Record<string, unknown> = {}, timeoutMs = 10_000): Promise<T> {
    if (!this.child?.stdin?.writable) return Promise.reject(new Error('native helper not running'))
    const id = this.next++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.calls.delete(id); reject(new Error(`${cmd} timed out`)) }, timeoutMs)
      this.calls.set(id, { resolve: v => resolve(v as T), reject, timer })
      this.child!.stdin!.write(JSON.stringify({ id, cmd, args }) + '\n')
    })
  }

  /** Switches a stream of events on or off for `owner`; on while anyone wants it, kept across helper restarts. */
  watch(topic: string, on = true, owner = 'main') {
    const owners = this.topics.get(topic) ?? new Set<string>()
    const before = owners.size > 0
    on ? owners.add(owner) : owners.delete(owner)
    this.topics.set(topic, owners)
    const after = owners.size > 0
    if (after !== before && this.available) this.request('watch', { topic, on: after }).catch(err => log.warn(`watch ${topic}:`, err.message))
  }

  private line(text: string) {
    let msg: { id?: number; ok?: boolean; result?: unknown; error?: string; event?: string; data?: unknown }
    try { msg = JSON.parse(text) } catch { log.warn('bad line from the native helper:', text.slice(0, 200)); return }
    if (msg.event === 'ready') {
      this.available = true
      this.restarts = 0
      log.info(`native helper ${(msg.data as { version?: string })?.version} ready`)
      for (const [t, owners] of this.topics) if (owners.size) this.request('watch', { topic: t, on: true }).catch(() => {})
      this.emit('ready')
      return
    }
    if (msg.event) { this.emit(msg.event, msg.data); return }
    const call = msg.id !== undefined ? this.calls.get(msg.id) : undefined
    if (!call) return
    this.calls.delete(msg.id!)
    clearTimeout(call.timer)
    msg.ok ? call.resolve(msg.result) : call.reject(new Error(msg.error ?? 'failed'))
  }
}
