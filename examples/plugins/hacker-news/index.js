// The example from docs/PLUGINS.md, copied from the guide as it is (tests/connectors.test.ts runs it).
module.exports = pebble => {
  pebble.every('10m', async () => {
    const ids = await pebble.fetchJSON('https://hacker-news.firebaseio.com/v0/topstories.json')
    const top = await pebble.fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${ids[0]}.json`)
    pebble.widget('top', { kind: 'card', title: 'Hacker News', icon: 'notes', text: top.title, lines: [`${top.score} points`], link: top.url })
    pebble.widget('score', { kind: 'chip', text: `HN ${top.score}` })
    if (top.score >= pebble.settings.minScore && pebble.store.get('told') !== top.id) {
      pebble.notify({ title: 'Big on Hacker News', body: top.title, link: top.url })
      pebble.store.set('told', top.id)
    }
  })
}
