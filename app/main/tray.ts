import { app, Menu, Tray } from 'electron'

export interface TrayActions {
  toggleIsland(): void
  toggleTuck(): void
  openSettings(): void
  /** the menu's words, in your language */
  t(key: string, vars?: Record<string, string | number>): string
  /** a downloaded update: its version, to offer "Restart to update" */
  update?: { version: string; install(): void }
}

let tray: Tray | undefined

/** (Re)builds the tray menu; call again after anything it shows has changed. */
export function buildTray(a: TrayActions, icon: string) {
  tray ??= new Tray(icon) // a .ico: Windows picks the size for the display's scale
  tray.setImage(icon) // the icon you chose in Settings
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
