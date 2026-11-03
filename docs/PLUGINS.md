# Writing a Pebble connector

A connector brings another app or web service into the island: a chip next to Pip, a card on Home and the Widgets
page, a live "activity" in the small island, and notifications. It is a folder with two files:

```
%APPDATA%\Pebble\plugins\
  hacker-news\
    plugin.json
    index.js
```

Put the folder there (Settings → Connectors → *Add your own connector*), then switch it on there. Pebble shows
what it may do and asks you once (and again whenever its permissions change).

## plugin.json

```json
{
  "id": "hacker-news",
  "name": "Hacker News",
  "description": "The top story, every 10 minutes.",
  "permissions": { "net": ["hacker-news.firebaseio.com"], "notify": true },
  "settings": [
    { "key": "minScore", "label": "Tell me about stories above this score", "type": "number", "default": 500 }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | lower-case letters, digits and `-`; unique |
| `main` | the script (default `index.js`) |
| `permissions.net` | the hosts `pebble.fetch` may reach: `api.example.com`, `*.example.com`, or `*` for any site |
| `permissions.secrets` | setting keys that are secrets (tokens, private links): stored encrypted, never given to your script |
| `permissions.notify` | may show notifications |
| `permissions.webhook` | gets its own local address other programs can POST to |
| `permissions.windows` | may read the titles and programs of open windows |
| `settings` | what the user fills in, in `%APPDATA%\Pebble\connectors.json` (`type`: string, number, boolean, list; `required`; `default`) |

## index.js

The script exports one function; Pebble calls it with `pebble`:

```js
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
```

That is this whole connector: it is in [examples/plugins/hacker-news](../examples/plugins/hacker-news).

## The `pebble` object

| | |
| --- | --- |
| `pebble.settings` | the user's settings (secrets left out) |
| `pebble.every(interval, fn)` | runs `fn` now and then every `'30s'`, `'5m'`, `'1h'` (at least 15 s); errors are logged and shown, the next run still happens |
| `pebble.after(ms, fn)` | runs `fn` once, later |
| `pebble.fetchJSON(url, options?)` | GET and parse JSON (throws on a non-2xx answer) |
| `pebble.fetchText(url, options?)` | GET as text |
| `pebble.fetch(url, options?)` | `{ status, ok, text(), json() }`; options: `method`, `headers`, `body` (a string) |
| `options.auth` | adds a secret without your script seeing it: `'token'` → `Authorization: Bearer <token>`, or `{ header: 'X-Api-Key', secret: 'key', prefix: '' }` |
| `pebble.fetchText('secret:ics')` | the address itself is a secret (a private calendar link) |
| `pebble.widget(id, w)` | shows or updates a widget (below) |
| `pebble.remove(id)` | takes a widget away (an activity that ended) |
| `pebble.notify({ title, body, link? })` | a Windows notification; a click opens `link` |
| `pebble.onWebhook(body => …)` | messages POSTed to the connector's address (Settings → Connectors → *Copy its webhook address*) |
| `pebble.windows()` | `[{ title, process }]` of open windows |
| `pebble.store.get(key)` / `.set(key, value)` | a little memory that survives restarts (what you already told the user…) |
| `pebble.log(…)` | a line in Pebble's log |

### Widgets

```js
pebble.widget('id', {
  kind: 'card',         // 'chip': next to Pip (Settings → Island → Resting island) · 'activity': the small island while it lasts · 'card': Home and the Widgets page
  title: 'GitHub',
  text: '2 reviews for you',
  icon: 'agents',       // an icon name (agents, music, files, notes, focus, grid, phone…) or one emoji: '⚽'
  tone: 'warn',         // 'ok' | 'warn' | 'error' | 'info': the card's colour line
  lines: ['Review: Fix cart total'],  // up to 6 smaller lines (cards)
  progress: 40,         // 0–100 (activities)
  link: 'https://…'     // opened on a click (http/https)
})
```

## What a connector can and cannot do

Each connector runs in its own process, in a context that has only `pebble`: no `require`, no `process`, no files,
no network except through `pebble.fetch` to the hosts it declared, and redirects are checked against them too. That
keeps mistakes contained (a crash or a hang stops only that connector, which Pebble restarts up to 5 times). It is
**not** a wall against hostile code: only add connectors you trust, the same as any program.
