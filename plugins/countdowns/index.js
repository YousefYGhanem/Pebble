// Countdowns: days until the dates you listed, worked out on this PC every hour (and at midnight).

/** "Name: 2026-12-31" or "Name: 2026-12-01 09:00" → { name, at } (local time); lines that are not dates are left out. */
function parse(lines) {
  const out = []
  for (const line of lines || []) {
    const m = /^(.*?)[:\-–]\s*(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?\s*$/.exec(String(line).trim())
    if (!m) continue
    const at = new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]), Number(m[5] || 0), Number(m[6] || 0)).getTime()
    if (Number.isFinite(at)) out.push({ name: m[1].trim() || 'Countdown', at })
  }
  return out.sort((a, b) => a.at - b.at)
}

/** "today", "tomorrow", "in 12 days" (whole calendar days), or "in 3 h" on the day itself when a time was given. */
function left(at, now) {
  const day = d => { const x = new Date(d); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86_400_000 }
  const days = day(at) - day(now)
  if (days === 0 && at > now && new Date(at).getHours() + new Date(at).getMinutes() > 0) return `in ${Math.max(1, Math.round((at - now) / 3_600_000))} h`
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
}

module.exports = pebble => {
  const dates = parse(pebble.settings.dates)
  const show = () => {
    const now = Date.now()
    const next = dates.filter(d => d.at >= now - 86_400_000) // a date stays "today" for its whole day
    if (!next.length) { pebble.remove('chip'); pebble.widget('card', { kind: 'card', title: 'Countdowns', icon: 'focus', text: 'Nothing ahead', lines: ['Add dates in Settings → Connectors'] }); return }
    const first = next[0]
    pebble.widget('chip', { kind: 'chip', text: `${first.name} · ${left(first.at, now)}`, tone: left(first.at, now) === 'today' ? 'ok' : 'info' })
    pebble.widget('card', { kind: 'card', title: 'Countdowns', icon: 'focus', text: `${first.name}: ${left(first.at, now)}`, lines: next.slice(1, 5).map(d => `${d.name}: ${left(d.at, now)}`) })
    // the day (or the moment) arrives: once
    const told = pebble.store.get('told') || []
    for (const d of dates) if (d.at <= now && now - d.at < 86_400_000 && !told.includes(d.name + d.at)) { pebble.notify({ title: d.name, body: 'It is today!' }); told.push(d.name + d.at) }
    pebble.store.set('told', told.slice(-50))
  }
  pebble.every('1h', show)
  // and right after midnight, so "tomorrow" turns into "today" on time
  const midnight = new Date(); midnight.setHours(24, 0, 5, 0)
  pebble.after(midnight.getTime() - Date.now(), show)
}
module.exports.parse = parse
module.exports.left = left
