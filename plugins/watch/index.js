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

module.exports = pebble => {
  const { url, path, label, every } = pebble.settings
  pebble.every(every || '5m', async () => {
    const value = pick(await pebble.fetchText(url), path)
    if (value === undefined) throw new Error(`"${path}" found nothing at ${url}`)
    const before = pebble.store.get('value')
    pebble.widget('value', { kind: 'chip', text: `${label} ${value}` })
    pebble.widget('card', { kind: 'card', title: label, icon: 'agents', text: value, lines: before !== undefined && before !== value ? [`was ${before}`] : [], link: url })
    if (before !== undefined && before !== value) pebble.notify({ title: `${label} changed`, body: `${before} → ${value}`, link: url })
    pebble.store.set('value', value)
  })
}
module.exports.pick = pick
