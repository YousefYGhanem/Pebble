// One value from a JSON API (a dotted path) or a page (a regular expression with one group).
function pick(text, path) {
  try {
    const json = JSON.parse(text)
    const v = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), json)
    if (v !== undefined) return typeof v === 'object' ? JSON.stringify(v) : String(v)
  } catch {}
  const m = new RegExp(path).exec(text)
  return m ? (m[1] ?? m[0]).trim() : undefined
}

/** A value as a number ("$1,234.50" → 1234.5), or NaN. */
const num = v => Number(String(v ?? '').replace(/[^\d.\-]/g, ''))

/** Did the value just go past a limit you set? 'above', 'below', or null (also the first reading, or no limits). */
function crossed(before, value, above, below) {
  const a = num(before), b = num(value), hi = num(above), lo = num(below)
  if (!Number.isFinite(a) || !Number.isFinite(b) || before === undefined) return null
  if (above !== '' && above != null && Number.isFinite(hi) && a <= hi && b > hi) return 'above'
  if (below !== '' && below != null && Number.isFinite(lo) && a >= lo && b < lo) return 'below'
  return null
}

module.exports = pebble => {
  const { url, path, label, every, above, below } = pebble.settings
  const limits = (above !== undefined && above !== '') || (below !== undefined && below !== '')
  pebble.every(every || '5m', async () => {
    const value = pick(await pebble.fetchText(url), path)
    if (value === undefined) throw new Error(`"${path}" found nothing at ${url}`)
    const before = pebble.store.get('value')
    const outside = limits && ((above !== '' && above != null && num(value) > num(above)) || (below !== '' && below != null && num(value) < num(below)))
    pebble.widget('value', { kind: 'chip', text: `${label} ${value}`, tone: outside ? 'warn' : undefined })
    pebble.widget('card', { kind: 'card', title: label, icon: 'agents', text: value, tone: outside ? 'warn' : undefined,
      lines: [...(before !== undefined && before !== value ? [`was ${before}`] : []), ...(limits ? [[above !== '' && above != null ? `above ${above}` : '', below !== '' && below != null ? `below ${below}` : ''].filter(Boolean).join(' · ') + ': tell me'] : [])],
      link: url })
    // with limits: only when it goes past one; without: every change
    const went = crossed(before, value, above, below)
    if (went) pebble.notify({ title: `${label} is ${went} ${went === 'above' ? above : below}`, body: `${before} → ${value}`, link: url })
    else if (!limits && before !== undefined && before !== value) pebble.notify({ title: `${label} changed`, body: `${before} → ${value}`, link: url })
    pebble.store.set('value', value)
  })
}
module.exports.pick = pick
module.exports.crossed = crossed
