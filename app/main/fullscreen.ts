import { EventEmitter } from 'node:events'
import { screen, type Rectangle } from 'electron'
import type { Native, WinInfo } from './native'

// Game mode needs to know when something runs full screen (a game, a video, a presentation). The native helper
// reports the window in front whenever it changes (real pixels); it counts when it covers its whole display.

/** True when the window covers the whole display (borderless and exclusive full screen both do). */
export function coversDisplay(win: Rectangle, display: Rectangle): boolean {
  const slack = 2
  return win.x <= display.x + slack && win.y <= display.y + slack
    && win.x + win.width >= display.x + display.width - slack && win.y + win.height >= display.y + display.height - slack
}

/** Emits 'change' with the id of the display that something covers full screen, or null. */
export class FullscreenWatch extends EventEmitter {
  current: number | null = null
  private active = false

  constructor(private native: Native) {
    super()
    native.on('foreground', (w: WinInfo | null) => {
      if (!this.active) return
      if (!w) { this.set(null); return }
      const dip = screen.screenToDipRect(null, { x: w.rect.x, y: w.rect.y, width: w.rect.w, height: w.rect.h })
      const display = screen.getDisplayMatching(dip)
      this.set(coversDisplay(dip, display.bounds) ? display.id : null)
    })
  }

  start() { if (!this.active) { this.active = true; this.native.watch('foreground', true, 'fullscreen') } }

  stop() {
    if (!this.active) return
    this.active = false
    this.native.watch('foreground', false, 'fullscreen')
    this.set(null)
  }

  private set(id: number | null) {
    if (id === this.current) return
    this.current = id
    this.emit('change', id)
  }
}
