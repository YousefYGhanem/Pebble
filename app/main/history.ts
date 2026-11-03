import fs from 'node:fs'
import path from 'node:path'
import type { HistoryItem } from '../shared/ipc'
import type { Session } from '../shared/state'
import { writeJsonAtomic } from './store'

const MAX = 40

/** What your agents did: the last 40 finished turns, kept on this PC only (userData/history.json). */
export class History {
  items: HistoryItem[] = []
  private file: string

  constructor(dir: string) {
    this.file = path.join(dir, 'history.json')
    try { const v = JSON.parse(fs.readFileSync(this.file, 'utf8')); if (Array.isArray(v)) this.items = v.slice(0, MAX) } catch {}
  }

  add(s: Session) {
    if (!s.prompt || s.agent === 'cli') return
    this.items = [{
      at: Date.now(), agent: s.agent, project: s.project, cwd: s.cwd, prompt: s.prompt.slice(0, 500),
      result: (s.message ?? '').slice(0, 1000), files: s.files.length,
      seconds: s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0
    }, ...this.items].slice(0, MAX)
    try { writeJsonAtomic(this.file, this.items) } catch {}
  }

  clear() {
    this.items = []
    try { writeJsonAtomic(this.file, []) } catch {}
  }
}
