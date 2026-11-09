// Undo for the island's destructive actions (Nielsen #3, #5): one at a time, for 5 s, shown by App above the page row.
// Either the action waits (commit runs when the time is up; the page hides what it will remove meanwhile), or it ran at
// once and undo puts things back. A new offer settles the previous one.

interface Offer { text: string; hides?: string; commit?: () => void; undo?: () => void; timer: ReturnType<typeof setTimeout> }
let current = $state<Offer | null>(null)

function settle() {
  const o = current
  if (!o) return
  clearTimeout(o.timer)
  current = null
  o.commit?.()
}

export const undo = {
  get text() { return current?.text ?? null },
  /** what the page should not show while it waits ("clipboard", "shelf", "shelf:<path>") */
  hides: (key: string) => !!current?.hides && (current.hides === key || key.startsWith(current.hides + ':')),
  offer(text: string, o: { hides?: string; commit?: () => void; undo?: () => void }) {
    settle()
    current = { text, ...o, timer: setTimeout(settle, 5000) }
  },
  /** the Undo button */
  take() {
    const o = current
    if (!o) return
    clearTimeout(o.timer)
    current = null
    o.undo?.()
  }
}
