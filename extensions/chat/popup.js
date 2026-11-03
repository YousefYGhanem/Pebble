const key = document.getElementById('key'), port = document.getElementById('port'), status = document.getElementById('status')

chrome.storage.local.get(['key', 'port']).then(c => { key.value = c.key ?? ''; port.value = c.port ?? 47901 })

document.getElementById('save').onclick = async () => {
  await chrome.storage.local.set({ key: key.value.trim(), port: Number(port.value) || 47901 })
  const r = await chrome.runtime.sendMessage({ type: 'test' })
  status.textContent = r?.error ? `Not connected: ${r.error}` : 'Connected to Pebble. Open a chat site and it shows up in the island.'
}
