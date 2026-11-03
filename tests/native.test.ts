// The native helper as Pebble uses it: one `serve` process, requests and events (Windows, after npm run build:native).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Native, nativeExe } from '../app/main/native'

const EXE = nativeExe(path.join(__dirname, '..'), false)

describe.skipIf(process.platform !== 'win32' || !fs.existsSync(EXE))('native helper', () => {
  const native = new Native(EXE)
  beforeAll(async () => { const ready = new Promise(r => native.once('ready', r)); native.start(); await ready })
  afterAll(() => native.stop())

  test('selftest passes', () => {
    const r = spawnSync(EXE, ['selftest'], { encoding: 'utf8' })
    const report = JSON.parse(r.stdout)
    expect(report.checks.filter((c: { ok: boolean }) => !c.ok)).toEqual([])
    expect(r.status).toBe(0)
  }, 30000)

  test('requests: ping, unknown command, the process tree, audio and media', async () => {
    expect(await native.request('ping')).toBe('pong')
    await expect(native.request('nope')).rejects.toThrow(/unknown command/)
    const own = await native.request<{ pid: number }>('window.ofProcess', { pid: process.pid })
    expect(typeof own.pid).toBe('number')
    const audio = await native.request<{ volume: number; muted: boolean }>('audio.get')
    expect(audio.volume).toBeGreaterThanOrEqual(0)
    expect(audio.volume).toBeLessThanOrEqual(100)
    const media = await native.request('media.get')
    expect(media === null || typeof media === 'object').toBe(true)
  }, 20000)

  test('a screen region becomes a PNG file', async () => {
    const file = path.join(os.tmpdir(), `pebble-cap-${process.pid}.png`)
    await native.request('screen.capture', { x: 0, y: 0, w: 16, h: 16, file })
    expect(fs.readFileSync(file).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    fs.unlinkSync(file)
  })

  test('watching the foreground sends a first event right away', async () => {
    const event = new Promise(r => native.once('foreground', r))
    native.watch('foreground')
    const w = await event as { rect?: object } | null
    expect(w === null || typeof w.rect === 'object').toBe(true)
    native.watch('foreground', false)
  })

  test('a crashed helper comes back by itself', async () => {
    const ready = new Promise(r => native.once('ready', r))
    // @ts-expect-error reaching in to kill the child, as a crash would
    native.child.kill()
    await ready
    expect(await native.request('ping')).toBe('pong')
  }, 10000)
})
