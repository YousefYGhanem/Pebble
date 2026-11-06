import { app, Menu, nativeImage, Tray } from 'electron'

export interface TrayActions {
  toggleIsland(): void
  toggleTuck(): void
  openSettings(): void
  /** the menu's words, in your language */
  t(key: string, vars?: Record<string, string | number>): string
  /** a downloaded update: its version, to offer "Restart to update" */
  update?: { version: string; install(): void }
}

/** A round dot in the theme's accent colour, drawn here so no icon file is needed yet. */
function dot(hex: string) {
  const size = 32, buf = Buffer.alloc(size * size * 4)
  const c = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '7c5cff'
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16))
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, d = Math.hypot(x - 15.5, y - 15.5)
    buf[i] = b!; buf[i + 1] = g!; buf[i + 2] = r!
    buf[i + 3] = Math.round(255 * Math.max(0, Math.min(1, 14.5 - d))) // soft edge
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 2 })
}

let tray: Tray | undefined

/** (Re)builds the tray menu; call again after anything it shows has changed. */
export function buildTray(a: TrayActions, accent: string) {
  tray ??= new Tray(dot(accent))
  tray.setImage(dot(accent))
  tray.setToolTip('Pebble')
  tray.removeAllListeners('click')
  tray.on('click', a.toggleIsland)
  // everything else lives in the Settings window
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Pebble', enabled: false },
    { label: a.t('m.tray.open'), click: a.toggleIsland },
    { label: a.t('m.tray.tuck'), click: a.toggleTuck },
    { label: a.t('m.tray.settings'), click: a.openSettings },
    ...(a.update ? [{ label: a.t('m.tray.update', { version: a.update.version }), click: a.update.install }] : []),
    { type: 'separator' },
    { label: a.t('m.tray.restart'), click: () => { app.relaunch(); app.quit() } },
    { label: a.t('m.tray.quit'), click: () => app.quit() }
  ]))
}
