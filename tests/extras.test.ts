import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, test, expect } from 'vitest'
import { focusFinished, focusLeft, trimClips, looksSecret, lyricIndex, maskSecret, positionNow, type Media } from '../app/shared/extras'
import { Lyrics, parseLrc, plainTitle } from '../app/main/extras/lyrics'
import { guardActive, matchSite } from '../app/main/extras/guard'
import { DropServer, lanAddress, safeName } from '../app/main/extras/drop'
import { validAction } from '../app/main/extras'

const song: Media = { app: 'Spotify.exe', title: 'Song - Remastered 2011', artist: 'Band', album: 'LP', playing: true, positionMs: 10_000, durationMs: 200_000, updatedAt: 1000, canSeek: true, canNext: true, canPrevious: true }

test('LRC parsing: several stamps on a line, credits and empty lines skipped, sorted', () => {
  expect(parseLrc('[00:12.50]Hello\n[ar:Band]\n[00:05.00][00:20.00]Again\n[00:30.00]')).toEqual([
    { t: 5000, text: 'Again' }, { t: 12500, text: 'Hello' }, { t: 20000, text: 'Again' }
  ])
})

test('song titles are cleaned for the lookup', () => {
  expect(plainTitle('Song - Remastered 2011')).toBe('Song')
  expect(plainTitle('Song (feat. Someone)')).toBe('Song')
  expect(plainTitle('Artist - Song (Official Video)')).toBe('Artist - Song')
})

test('the line sung now, the position while playing, the focus time left', () => {
  const lines = [{ t: 1000, text: 'a' }, { t: 5000, text: 'b' }, { t: 9000, text: 'c' }]
  expect(lyricIndex(lines, 500)).toBe(-1)
  expect(lyricIndex(lines, 5000)).toBe(1)
  expect(lyricIndex(lines, 99_000)).toBe(2)
  expect(positionNow(song, 4000)).toBe(13_000)
  expect(positionNow({ ...song, playing: false }, 4000)).toBe(10_000)
  expect(positionNow(song, 10_000_000)).toBe(200_000) // never past the end
  expect(focusLeft({ seconds: 600, endsAt: 70_000 }, 10_000)).toBe(60)
  expect(focusLeft({ seconds: 600, left: 42 }, 10_000)).toBe(42)
})

test('lyrics are asked once per song and cached on disk (also "none")', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-lyrics-'))
  const asked: string[] = []
  const fake = async (url: string) => { asked.push(url); return url.includes('/get?') ? { syncedLyrics: '[00:01.00]One\n[00:02.00]Two' } : [] }
  const a = new Lyrics(dir, fake)
  expect(await a.get(song)).toEqual([{ t: 1000, text: 'One' }, { t: 2000, text: 'Two' }])
  expect(asked[0]).toContain('track_name=Song&artist_name=Band')
  const b = new Lyrics(dir, async () => { throw new Error('should come from disk') })
  expect(await b.get(song)).toHaveLength(2)
  // a browser video: "Artist - Song" in the title
  const c = new Lyrics(dir, async url => { asked.push(url); return null })
  expect(await c.get({ ...song, title: 'Other Band - Hit (Official Video)', artist: 'SomeChannel', album: '' })).toBeNull()
  expect(asked.at(-2)).toContain('track_name=Hit&artist_name=Other+Band')
})

test('a failed lookup is not cached, so it is asked again later', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-lyrics-'))
  let calls = 0
  const flaky = new Lyrics(dir, async () => { calls++; if (calls === 1) throw new Error('offline'); return { syncedLyrics: '[00:01.00]Back' } })
  await expect(flaky.get(song)).rejects.toThrow('offline')
  expect(await flaky.get(song)).toEqual([{ t: 1000, text: 'Back' }])
})

test('focus guard: apps by program, sites only by a browser tab title', () => {
  const sites = ['youtube', 'tiktok.com', 'Discord']
  expect(matchSite({ title: 'Funny cats - YouTube - Google Chrome', process: 'chrome' }, sites)).toBe('youtube')
  expect(matchSite({ title: 'TikTok - Make Your Day — Mozilla Firefox', process: 'firefox' }, sites)).toBe('tiktok.com')
  expect(matchSite({ title: 'General', process: 'Discord' }, sites)).toBe('Discord')
  expect(matchSite({ title: 'youtube-dl notes.txt - Notepad', process: 'notepad' }, sites)).toBeNull() // not a browser
  expect(matchSite({ title: 'YouTubers I like - Google Docs - Google Chrome', process: 'chrome' }, sites)).toBeNull() // whole words only
})

test('island actions are checked before they reach main', () => {
  expect(validAction({ do: 'media', action: 'toggle' })).toBe(true)
  expect(validAction({ do: 'media', action: 'rm -rf' })).toBe(false)
  expect(validAction({ do: 'volume', volume: 140 })).toBe(false)
  expect(validAction({ do: 'focus.start', seconds: 1500 })).toBe(true)
  expect(validAction({ do: 'focus.start', seconds: -1 })).toBe(false)
  expect(validAction({ do: 'notes.save', notes: [{ id: 'a', text: 'x', at: 1 }] })).toBe(true)
  expect(validAction({ do: 'notes.save', notes: [{ id: 'a', text: 5 }] })).toBe(false)
  expect(validAction({ do: 'shelf.add', paths: ['C:\\a.txt'] })).toBe(true)
  expect(validAction({ do: 'nope' })).toBe(false)
})

test('phone drop helpers: the LAN address, safe file names', () => {
  const net = (address: string) => [{ address, family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null }] as unknown as os.NetworkInterfaceInfo[]
  expect(lanAddress({ 'vEthernet (WSL)': net('172.20.1.1'), 'Wi-Fi': net('192.168.1.20') })).toBe('192.168.1.20')
  expect(lanAddress({ 'Ethernet': net('8.8.8.8') })).toBeNull()
  expect(safeName('..\\..\\Windows\\evil.exe')).toBe('evil.exe')
  expect(safeName('a:b?.png')).toBe('a_b_.png')
  expect(safeName('')).toBe('file')
})

describe.skipIf(!lanAddress())('phone drop server', () => {
  test('lists the shelf, serves a file, takes an upload, refuses a wrong key', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pebble-drop-'))
    const shelfFile = path.join(dir, 'report.txt')
    fs.writeFileSync(shelfFile, 'hello phone')
    const downloads = path.join(dir, 'Downloads')
    const drop = new DropServer(() => [{ path: shelfFile, name: 'report.txt', icon: '', size: 11, addedAt: 0 }], downloads)
    await drop.start()
    try {
      const u = new URL(drop.state!.url)
      const base = `http://127.0.0.1:${u.port}${u.pathname}`
      expect(drop.state!.qr.startsWith('data:image/svg+xml;base64,')).toBe(true)
      expect((await fetch(`http://127.0.0.1:${u.port}/wrongkey`)).status).toBe(404)
      const page = await (await fetch(base)).text()
      expect(page).toContain('report.txt')
      expect(drop.state!.connected).toBe(true)
      expect(await (await fetch(`${base}/file/0`)).text()).toBe('hello phone')
      const received = new Promise<string[]>(r => drop.once('received', r))
      expect((await fetch(`${base}/upload?name=${encodeURIComponent('../photo.jpg')}`, { method: 'PUT', body: 'jpegbytes' })).status).toBe(200)
      const [saved] = await received
      expect(path.dirname(saved!)).toBe(downloads)
      expect(fs.readFileSync(saved!, 'utf8')).toBe('jpegbytes')
      expect(drop.state!.received).toBe(1)
    } finally { drop.stop() }
    expect(drop.state).toBeNull()
  })
})

test('focus guard: only while a focus timer runs, unless set to always', () => {
  const g = { enabled: true, onlyDuringFocus: true, sites: [], snoozeMinutes: 5 }
  expect(guardActive(g, false)).toBe(false)
  expect(guardActive(g, true)).toBe(true)
  expect(guardActive({ ...g, onlyDuringFocus: false }, false)).toBe(true)
  expect(guardActive({ ...g, enabled: false }, true)).toBe(false)
})

test('clipboard: keys and tokens are masked, ordinary text, paths and addresses are not', () => {
  for (const s of ['sk-ant-api03-abcdefghijklmnop', 'ghp_1234567890abcdefghijklmnop', 'eyJhbGciOiJIUzI1NiJ9.e30.abc', 'Zq8Lm3Pw9Xr2Tk7Vb4Nc6Hd1Fs5Gj0Yy']) expect(looksSecret(s)).toBe(true)
  for (const s of ['hello world, this is a sentence', 'C:\Users\Yousef\Projects\Pebble2', 'https://github.com/YousefYGhanem/Pebble', 'short', 'ComponentName.svelte2X']) expect(looksSecret(s)).toBe(false)
  expect(maskSecret('sk-ant-api03-abcdefghijklmnop')).toBe('sk-a••••••mnop')
})

test('focus: a finished round counts toward today and is offered again; a break does not count', () => {
  const at = new Date('2026-11-09T10:00').getTime()
  let d = focusFinished(null, { seconds: 1500 }, at)
  expect([d.today, d.round, d.wasBreak]).toEqual([1, 1500, false])
  d = focusFinished(d, { seconds: 300, break: true }, at + 1_800_000)
  expect([d.today, d.round, d.wasBreak]).toEqual([1, 1500, true])
  d = focusFinished(d, { seconds: 2700 }, at + 5_000_000)
  expect([d.today, d.round]).toEqual([2, 2700])
  expect(focusFinished(d, { seconds: 1500 }, new Date('2026-11-10T09:00').getTime()).today).toBe(1) // a new day
})

test('actions: removing one clip, a break, and Settings on a tab are checked', () => {
  expect(validAction({ do: 'clip.remove', id: 3 })).toBe(true)
  expect(validAction({ do: 'clip.remove', id: 'x' })).toBe(false)
  expect(validAction({ do: 'focus.start', seconds: 300, break: true })).toBe(true)
  expect(validAction({ do: 'focus.start', seconds: 300, break: 'yes' })).toBe(false)
  expect(validAction({ do: 'settings.open', tab: 'connectors' })).toBe(true)
  expect(validAction({ do: 'settings.open', tab: 'advanced' })).toBe(false)
})

test('clipboard: pinned entries stay first and are never pushed out', () => {
  const list = [{ id: 3, text: 'c', at: 3 }, { id: 2, text: 'b', at: 2, pinned: true }, { id: 1, text: 'a', at: 1 }]
  expect(trimClips(list, 1).map(c => c.id)).toEqual([2, 3])
  expect(validAction({ do: 'clip.pin', id: 2 })).toBe(true)
  expect(validAction({ do: 'tip.seen', id: 'ask' })).toBe(true)
  expect(validAction({ do: 'tip.seen', id: 'other' })).toBe(false)
})
