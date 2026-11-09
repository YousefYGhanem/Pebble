import { app, Menu, Tray } from 'electron'

export interface TrayActions {
  toggleIsland(): void
  toggleTuck(): void
  openSettings(): void
  /** the menu's words, in your language */
  t(key: string, vars?: Record<string, string | number>): string
  /** a downloaded update: its version, to offer "Restart to update" */
  update?: { version: string; install(): void }
  /** the island is tucked away (a checkmark) */
  tucked: boolean
  /** on/off switches people flip often (notifications, sounds) */
  switches: { label: string; checked: boolean; click(): void }[]
}

let tray: Tray | undefined

/** (Re)builds the tray menu; call again after anything it shows has changed. */
export function buildTray(a: TrayActions, icon: string) {
  tray ??= new Tray(icon) // a .ico: Windows picks the size for the display's scale
  tray.setImage(icon) // the icon you chose in Settings
  tray.removeAllListeners('click')
  tray.on('click', a.toggleIsland)
  // the most important first (an update waiting), on/off states as checkmarks; everything else lives in Settings
  tray.setContextMenu(Menu.buildFromTemplate([
    ...(a.update ? [{ label: a.t('m.tray.update', { version: a.update.version }), click: a.update.install }, { type: 'separator' as const }] : []),
    { label: a.t('m.tray.open'), click: a.toggleIsland },
    { label: a.t('m.tray.tucked'), type: 'checkbox', checked: a.tucked, click: a.toggleTuck },
    { type: 'separator' },
    ...a.switches.map(s => ({ label: s.label, type: 'checkbox' as const, checked: s.checked, click: s.click })),
    { type: 'separator' },
    { label: a.t('m.tray.settings'), click: a.openSettings },
    { label: a.t('m.tray.quit'), click: () => app.quit() }
  ]))
}

/** The tray's tooltip says what goes on ("Pebble · 2 agents working"), not only its name. */
export function trayStatus(text: string) { tray?.setToolTip(text) }
