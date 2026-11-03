import fs from 'node:fs'
import path from 'node:path'
import { finishTask, type PipStats } from '../shared/pip'
import { writeJsonAtomic } from './store'

const MAX_SVG = 200 * 1024

/** Pip's stats (tasks done, achievements) in userData/pip.json, and your own outfits in userData/outfits/*.svg. */
export class PipStore {
  stats: PipStats = { done: 0, achievements: [] }
  custom: { id: string; data: string }[] = []
  private file: string
  readonly outfitsDir: string

  constructor(dir: string) {
    this.file = path.join(dir, 'pip.json')
    this.outfitsDir = path.join(dir, 'outfits')
    try {
      const v = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      if (typeof v?.done === 'number' && Array.isArray(v.achievements)) this.stats = { done: v.done, achievements: v.achievements.filter((a: unknown) => typeof a === 'string') }
    } catch {}
    fs.mkdirSync(this.outfitsDir, { recursive: true })
    this.loadOutfits()
  }

  /** Counts a finished task; returns the achievements it earned. */
  finish(seconds: number): string[] {
    const r = finishTask(this.stats, { at: Date.now(), seconds })
    this.stats = r.stats
    try { writeJsonAtomic(this.file, this.stats) } catch {}
    return r.earned
  }

  /** Reads every .svg in the outfits folder (as data: URLs; files over 200 KB are skipped). */
  loadOutfits() {
    this.custom = []
    for (const f of fs.readdirSync(this.outfitsDir).filter(f => f.toLowerCase().endsWith('.svg'))) {
      try {
        const buf = fs.readFileSync(path.join(this.outfitsDir, f))
        if (buf.length <= MAX_SVG) this.custom.push({ id: f.slice(0, -4), data: 'data:image/svg+xml;base64,' + buf.toString('base64') })
      } catch {}
    }
  }
}
