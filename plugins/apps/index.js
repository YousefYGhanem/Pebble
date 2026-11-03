// Every 15 s: which open windows match your list. A match shows as an activity ("Teams · Meeting with Sam").
module.exports = pebble => {
  const rules = (pebble.settings.watch || []).map(r => {
    const [proc, words] = String(r).split(':').map(s => s.trim().toLowerCase())
    return { proc, words }
  })
  pebble.every('15s', async () => {
    const wins = await pebble.windows()
    const hit = wins.find(w => rules.some(r => w.process.toLowerCase().includes(r.proc) && (!r.words || w.title.toLowerCase().includes(r.words))))
    if (hit) pebble.widget('open', { kind: 'activity', title: hit.process, text: hit.title || hit.process, icon: 'focus' })
    else pebble.remove('open')
  })
}
