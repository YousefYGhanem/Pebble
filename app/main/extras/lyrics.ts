import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { LyricLine, Media } from '../../shared/extras'
import { logger } from '../log'

const log = logger('lyrics')

// Timed lyrics from LRCLIB (lrclib.net: free and open, no account or key). Only the song's title, artist, album and
// length go there, nothing about you. Every song is asked once: the answer (also "none") is kept in userData/lyrics.

/** "[01:02.50] words" (also several times on one line) → sorted lines. Credits and empty lines are left out. */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    if (!text) continue
    for (const m of stamps) lines.push({ t: Math.round((+m[1]! * 60 + +m[2]!) * 1000), text })
  }
  return lines.sort((a, b) => a.t - b.t)
}

/** "Song - Remastered 2011", "Song (feat. X)", "Artist - Song (Official Video)" → the plain name. */
export function plainTitle(title: string): string {
  return title
    .replace(/\s*[([](official|lyric|audio|video|visualizer|hd|4k|feat\.?|ft\.?|with)[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+(remaster(ed)?|live|radio edit|single version|mono|stereo)\b.*$/i, '')
    .trim()
}

export class Lyrics {
  private dir: string
  private pending = new Map<string, Promise<LyricLine[] | null>>()

  constructor(userData: string, private fetchJson: (url: string) => Promise<unknown> = defaultFetch) {
    this.dir = path.join(userData, 'lyrics')
    fs.mkdirSync(this.dir, { recursive: true })
  }

  /** The song's timed lyrics, or null (none, or not a song). Cached on disk. */
  get(m: Media): Promise<LyricLine[] | null> {
    let title = plainTitle(m.title), artist = m.artist
    // a browser video: "Artist - Song" in the title, the channel as artist
    if (!m.album && / - /.test(title)) { const [a, ...t] = title.split(' - '); artist = a!.trim(); title = t.join(' - ').trim() }
    if (!title || !artist) return Promise.resolve(null)
    const key = createHash('sha1').update(`${artist}\n${title}`.toLowerCase()).digest('hex').slice(0, 16)
    const file = path.join(this.dir, key + '.json')
    try { return Promise.resolve(JSON.parse(fs.readFileSync(file, 'utf8')).lines ?? null) } catch {}
    if (!this.pending.has(key)) {
      this.pending.set(key, this.lookup(title, artist, m.album, m.durationMs)
        .then(lines => { try { fs.writeFileSync(file, JSON.stringify({ artist, title, lines })) } catch {} return lines })
        .finally(() => this.pending.delete(key)))
    }
    return this.pending.get(key)!
  }

  /** The exact song first, then a search (same length within 3 s when known). */
  private async lookup(title: string, artist: string, album: string, durationMs: number): Promise<LyricLine[] | null> {
    const q = (o: Record<string, string>) => new URLSearchParams(o).toString()
    try {
      const exact = await this.fetchJson(`https://lrclib.net/api/get?${q({ track_name: title, artist_name: artist, album_name: album, ...(durationMs ? { duration: String(Math.round(durationMs / 1000)) } : {}) })}`) as { syncedLyrics?: string } | null
      if (exact?.syncedLyrics) return parseLrc(exact.syncedLyrics)
      const found = await this.fetchJson(`https://lrclib.net/api/search?${q({ track_name: title, artist_name: artist })}`) as { syncedLyrics?: string; duration?: number }[] | null
      const hit = (found ?? []).find(r => r.syncedLyrics && (!durationMs || !r.duration || Math.abs(r.duration * 1000 - durationMs) < 3000))
      return hit?.syncedLyrics ? parseLrc(hit.syncedLyrics) : null
    } catch (err) {
      log.warn('LRCLIB:', (err as Error).message)
      throw err // not cached: asked again next time
    }
  }
}

async function defaultFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Pebble/0.6 (desktop app)' }, signal: AbortSignal.timeout(8000) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
