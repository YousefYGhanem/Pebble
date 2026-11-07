// "Find values" for a connector setting (Watch a value): everything that looks like a value at an address, as a list to
// pick from. The pick is saved in the form the watch connector reads: a dotted path for JSON, a regular expression with
// one group for a web page. So nobody has to write either by hand.

export interface Found { label: string; value: string; path: string }

const MAX = 300

/** The same reading the watch connector does (plugins/watch: pick). */
export function readValue(text: string, path: string): string | undefined {
  try {
    const v = path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), JSON.parse(text))
    if (v !== undefined) return typeof v === 'object' ? JSON.stringify(v) : String(v)
  } catch {}
  try { const m = new RegExp(path).exec(text); return m ? (m[1] ?? m[0]).trim() : undefined } catch { return undefined }
}

function fromJson(json: unknown): Found[] {
  const out: Found[] = []
  const walk = (v: unknown, path: string[]) => {
    if (out.length >= MAX) return
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) walk(x, [...path, k]); return }
    if (v === null || v === undefined || path.length === 0) return
    const s = String(v)
    if (s.length > 120) return
    out.push({ label: path.join(' › '), value: s, path: path.join('.') })
  }
  walk(json, [])
  return out
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NUMBER = '(\\d[\\d.,]*\\d|\\d)'

/** Numbers on a web page, each with the words just before it ("Price: 1,234.50" → "Price: (\d[\d.,]*\d|\d)"). */
function fromPage(html: string): Found[] {
  const text = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/td|\/th)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') // &amp; last: "&amp;lt;" is the text "&lt;"
  const out: Found[] = [], seen = new Set<string>()
  let prev = ''
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line) continue
    if (line.length <= 160 && /\d/.test(line)) {
      for (const m of line.matchAll(/\d[\d.,]*\d|\d/g)) {
        if (out.length >= MAX) return out
        // the words before the number; a number alone in its table cell takes the cell before it ("Euro" | "0.86")
        const own = line.slice(0, m.index).trim()
        const before = (own || prev).split(' ').filter(Boolean)
        // the longest run of words before the number that still finds this value in the page itself
        for (let words = Math.min(4, before.length); words >= 1; words--) {
          const path = escape(before.slice(-words).join(' ')) + '(?:\\s|&nbsp;|<[^>]*>)*' + NUMBER
          const label = own ? line : `${prev} ${line}`
          if (seen.has(path) || seen.has(label + m[0]) || readValue(html, path) !== m[0]) continue
          seen.add(path).add(label + m[0])
          out.push({ label, value: m[0], path })
          break
        }
      }
    }
    prev = line.slice(-80)
  }
  return out
}

/** The values found in a response: its JSON leaves, or the numbers on its page. */
export function findValues(text: string): Found[] {
  try { return fromJson(JSON.parse(text)) } catch { return fromPage(text) }
}

export async function findValuesAt(url: string): Promise<Found[]> {
  if (!/^https?:\/\//i.test(url)) throw new Error('enter the address first (starting with https://)')
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Pebble (watch a value)' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const text = (await res.text()).slice(0, 3_000_000)
  const found = findValues(text)
  if (!found.length) throw new Error('no values found there (a page that builds itself with scripts shows nothing until it runs)')
  return found
}
