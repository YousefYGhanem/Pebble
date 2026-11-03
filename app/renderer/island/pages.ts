// The island's pages, in order (the dots at the bottom and ‹ › follow this order).
export const PAGES = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'agents', label: 'Agents', icon: 'agents' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'music', label: 'Music', icon: 'music' },
  { id: 'files', label: 'Files', icon: 'files' },
  { id: 'clipboard', label: 'Clipboard', icon: 'clipboard' },
  { id: 'notes', label: 'Notes', icon: 'notes' },
  { id: 'focus', label: 'Focus', icon: 'focus' },
  { id: 'widgets', label: 'Widgets', icon: 'grid' }
] as const

export type Page = (typeof PAGES)[number]['id']

/** "3:07" / "1:02:07" */
export function clock(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** "just now", "4 min ago", "2 h ago" */
export function ago(at: number, now: number): string {
  const m = Math.round((now - at) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(at).toLocaleDateString()
}

/** The album's main colour (average of the cover, kept bright enough to glow on black), as "r, g, b". */
export async function albumColor(dataUrl: string): Promise<string | null> {
  const img = new Image()
  img.src = dataUrl
  try { await img.decode() } catch { return null }
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, 16, 16)
  const d = ctx.getImageData(0, 0, 16, 16).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i]!, d[i + 1]!, d[i + 2]!), min = Math.min(d[i]!, d[i + 1]!, d[i + 2]!)
    const w = 1 + (max - min) / 32 // colourful pixels count more than grey ones
    r += d[i]! * w; g += d[i + 1]! * w; b += d[i + 2]! * w; n += w
  }
  r /= n; g /= n; b /= n
  const lift = Math.max(1, 150 / Math.max(r, g, b, 1)) // dark covers still glow
  return [r, g, b].map(v => Math.min(255, Math.round(v * lift))).join(', ')
}
