// The next events from an iCal (.ics) link. The address itself is a secret (anyone who has it can read your calendar):
// Pebble keeps it encrypted and puts it in when this script fetches "secret:ics".
// shortcut: a repeating event (RRULE) shows only its first date, and named time zones are read as this PC's local
// time; a full iCal engine would handle both.
function unfold(text) { return text.replace(/\r?\n[ \t]/g, '') }

function when(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v.trim())
  if (!m) return null
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m
  return z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s)
}

function parseIcs(text) {
  return (unfold(text).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []).map(b => {
    const get = k => { const m = new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'm').exec(b); return m ? m[1].trim() : '' }
    return {
      title: get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ') || '(no title)',
      start: when(get('DTSTART')),
      allDay: /DTSTART;VALUE=DATE:/.test(b)
    }
  }).filter(e => e.start)
}

module.exports = pebble => {
  pebble.every('5m', async () => {
    const events = parseIcs(await pebble.fetchText('secret:ics'))
      .filter(e => e.start.getTime() > Date.now() - 60_000)
      .sort((a, b) => a.start - b.start)
    const next = events[0]
    if (!next) { pebble.remove('card'); pebble.remove('next'); return }
    const mins = Math.round((next.start - Date.now()) / 60000)
    const soon = mins < 60 && !next.allDay
    const at = next.allDay ? next.start.toLocaleDateString() : next.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    pebble.widget('card', { kind: 'card', title: 'Next', icon: 'focus', text: next.title, lines: [soon ? `in ${mins} min` : at, ...events.slice(1, 3).map(e => e.title)] })
    pebble.widget('next', { kind: 'chip', text: soon ? `${next.title.slice(0, 18)} · ${mins}m` : at })
    const remind = Number(pebble.settings.remindMinutes ?? 5), key = next.title + next.start.getTime()
    if (!next.allDay && mins <= remind && mins >= 0 && pebble.store.get('reminded') !== key) {
      pebble.notify({ title: next.title, body: `Starts in ${mins} minute${mins === 1 ? '' : 's'}` })
      pebble.store.set('reminded', key)
    }
  })
}
module.exports.parseIcs = parseIcs
