// Every 15 s: which open windows match your list. A match shows as an activity ("Teams · Meeting with Sam").
module.exports = pebble => {
  const rules = (pebble.settings.watch || []).map(r => {
    const [proc, words] = String(r).split(':').map(s => s.trim().toLowerCase())
    return { proc, words }
  })
  // since when the matched window has been open: the island counts the time (a call timer)
  let current = '', since = 0
  pebble.every('15s', async () => {
    const wins = await pebble.windows()
    const hit = wins.find(w => rules.some(r => w.process.toLowerCase().includes(r.proc) && (!r.words || w.title.toLowerCase().includes(r.words))))
    if (hit) {
      if (hit.process !== current) { current = hit.process; since = Date.now() }
      pebble.widget('open', { kind: 'activity', title: hit.process, text: hit.title || hit.process, icon: 'focus', since })
    } else { current = ''; pebble.remove('open') }
  })
}
