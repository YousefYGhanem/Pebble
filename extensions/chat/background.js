// Pebble's extension, background part: passes what a chat tab shows to Pebble on this PC (127.0.0.1 only), and hands
// your reply from the island back to that tab. Nothing leaves your computer.

async function config() {
  const { key = '', port = 47901 } = await chrome.storage.local.get(['key', 'port'])
  return { key, port }
}

async function report(tab, body) {
  const { key, port } = await config()
  if (!key) return { error: 'not paired' }
  try {
    const res = await fetch(`http://127.0.0.1:${port}/ext`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pebble-ext': key },
      body: JSON.stringify({ ...body, tab: String(tab) })
    })
    if (res.status === 403) return { error: 'wrong key' }
    return res.ok ? await res.json() : { error: `Pebble answered ${res.status}` }
  } catch { return { error: 'Pebble is not running' } }
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.type === 'state' && sender.tab?.id !== undefined) { report(sender.tab.id, msg.state).then(respond); return true }
  if (msg?.type === 'test') { report(0, { site: 'claude', title: '', streaming: false, answer: '', closed: true }).then(respond); return true }
})

chrome.tabs.onRemoved.addListener(id => { void report(id, { site: 'claude', closed: true }) })
