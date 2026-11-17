// Local servers: every 15 seconds, which of your dev servers answer on this PC. Any answer (even a 404) means it is
// up; no answer means it is not running. Nothing leaves the PC.

/** The ports to watch, from the setting ("5173", ":5173", "localhost:5173"): whole numbers 1–65535, each once. */
function ports(list) {
  const out = []
  for (const p of list || []) {
    const n = Number(String(p).trim().replace(/^(https?:\/\/)?(localhost|127\.0\.0\.1)?:?/i, '').replace(/\/.*$/, ''))
    if (Number.isInteger(n) && n > 0 && n < 65536 && !out.includes(n)) out.push(n)
  }
  return out.slice(0, 12)
}

module.exports = pebble => {
  const watch = ports(pebble.settings.ports)
  pebble.every('15s', async () => {
    const up = []
    for (const port of watch) {
      try { await pebble.fetch(`http://localhost:${port}/`); up.push(port) } catch { /* not running */ }
    }
    if (up.length) {
      pebble.widget('chip', { kind: 'chip', text: `● ${up.map(p => ':' + p).join(' ')}`, tone: 'ok', link: `http://localhost:${up[0]}/` })
    } else pebble.remove('chip')
    pebble.widget('card', {
      kind: 'card', title: 'Local servers', icon: 'web', tone: up.length ? 'ok' : 'info',
      text: up.length ? `${up.length} running` : 'None running',
      lines: watch.map(p => `${up.includes(p) ? '●' : '○'} localhost:${p}`),
      link: up.length ? `http://localhost:${up[0]}/` : undefined
    })
    // one that was up and stopped answering
    const was = pebble.store.get('up') || []
    if (pebble.settings.stopped !== false) for (const p of was) if (!up.includes(p)) pebble.notify({ title: 'A local server stopped', body: `localhost:${p} is not answering any more` })
    if (JSON.stringify(was) !== JSON.stringify(up)) pebble.store.set('up', up)
  })
}
module.exports.ports = ports
