import fs from 'node:fs'
import path from 'node:path'
import type { Agent } from '../shared/state'
import type { Usage } from '../shared/ipc'
import { addTask, addUsage, daysAt, emptyDay, type Days } from '../shared/today'
import { writeJsonAtomic } from './store'

/** What your agents did today (and yesterday), kept on this PC only (userData/today.json). */
export class Today {
  private days: Days
  private file: string

  constructor(dir: string) {
    this.file = path.join(dir, 'today.json')
    let d: Days = { today: emptyDay(Date.now()), yesterday: null }
    try { const v = JSON.parse(fs.readFileSync(this.file, 'utf8')); if (v?.today?.day) d = v } catch {}
    this.days = d
  }

  view(): Days { return daysAt(this.days, Date.now()) }
  task(t: { agent: Agent; seconds: number; files: number }) { this.save(addTask(this.days, Date.now(), t)) }
  usage(agent: Agent, u: Usage) { this.save(addUsage(this.days, Date.now(), agent, u)) }

  private save(d: Days) {
    if (JSON.stringify(d) === JSON.stringify(this.days)) return
    this.days = d
    try { writeJsonAtomic(this.file, d) } catch {}
  }
}
