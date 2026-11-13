import path from 'node:path'
import { app, BrowserWindow, screen, type Display } from 'electron'
import type { Settings } from '../shared/settings'
import { WINDOW_HEIGHT, windowWidth } from '../shared/island'

/** The display the island lives on: the chosen one while it is connected, else Windows' main screen. */
export function islandDisplay(settings: Settings): Display {
  const want = settings.island.display
  return (want !== 'main' && screen.getAllDisplays().find(d => d.id === want)) || screen.getPrimaryDisplay()
}

/** One fixed see-through window at the top of the screen; the island is drawn inside it (see app/shared/island.ts). */
export function createIsland(settings: Settings, offscreen = false): BrowserWindow {
  const win = new BrowserWindow({
    width: windowWidth(settings.island),
    height: WINDOW_HEIGHT,
    frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, show: false, focusable: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/island.js'),
      contextIsolation: true,
      sandbox: true,
      offscreen, // --capture renders without ever showing the window
      backgroundThrottling: false // the island animates while another app has focus
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  // clicks go through until the renderer says the mouse is on the island (catchMouse); moves are still forwarded
  win.setIgnoreMouseEvents(true, { forward: true })
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/island/index.html`)
  else win.loadFile(path.join(__dirname, '../renderer/island/index.html'))
  return win
}

export function placeIsland(win: BrowserWindow, settings: Settings) {
  const area = islandDisplay(settings).workArea
  const width = windowWidth(settings.island)
  // the island sits in the middle of its window: toward a side, the window touches that edge so the open island still fits
  const free = area.width - width
  const x = settings.island.position === 'left' ? 0 : settings.island.position === 'right' ? free : free / 2
  win.setBounds({ x: Math.round(area.x + (settings.island.position === 'left' ? Math.max(0, x) : x)), y: area.y, width, height: WINDOW_HEIGHT })
}
