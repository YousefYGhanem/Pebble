// RSS and Atom without a parser library: the <item>/<entry> blocks and their title, link and id.
function decode(s) {
  // tags go after the entities are decoded (an escaped <b> in a title is a tag too), &amp; last ("&amp;lt;" is the text "&lt;")
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
}

function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) || []
  return blocks.map(b => {
    const title = decode((b.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '')
    const link = (b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || decode((b.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '')
    const id = decode((b.match(/<(guid|id)[^>]*>([\s\S]*?)<\/\1>/) || [])[2] || '') || link || title
    return { title, link, id }
  }).filter(i => i.title)
}

module.exports = pebble => {
  pebble.every('15m', async () => {
    const all = []
    for (const url of pebble.settings.feeds || []) {
      try { all.push(...parseFeed(await pebble.fetchText(url)).slice(0, 10)) } catch (err) { pebble.log(`${url}: ${err.message}`) }
    }
    const seen = pebble.store.get('seen')
    if (seen && pebble.settings.notifyNew) {
      for (const i of all.filter(i => !seen.includes(i.id)).slice(0, 3)) pebble.notify({ title: 'New in your feeds', body: i.title, link: i.link })
    }
    pebble.store.set('seen', all.map(i => i.id).slice(0, 300))
    if (all.length) pebble.widget('card', { kind: 'card', title: 'News', icon: 'notes', text: all[0].title, lines: all.slice(1, 4).map(i => i.title), link: all[0].link })
  })
}
module.exports.parseFeed = parseFeed
