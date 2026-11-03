// POST JSON to the address shown in the tray (Connectors → Webhook inbox → Copy address):
//   {"title": "Deploy", "text": "Done"}                    → a notification
//   {"title": "Backup", "text": "Uploading", "progress": 40} → live in the island until progress reaches 100
module.exports = pebble => {
  pebble.onWebhook(body => {
    if (!body || typeof body !== 'object') return
    const title = String(body.title || 'Webhook').slice(0, 60), text = String(body.text || '').slice(0, 200)
    const id = 'in-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
    if (typeof body.progress === 'number' && body.progress < 100) {
      pebble.widget(id, { kind: 'activity', title, text: text || `${Math.round(body.progress)}%`, progress: body.progress, icon: 'agents' })
    } else {
      pebble.remove(id)
      pebble.notify({ title, body: text || 'Done', link: typeof body.link === 'string' ? body.link : undefined })
    }
  })
}
