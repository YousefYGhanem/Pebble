import { contextBridge, ipcRenderer } from 'electron'
import type { SettingsAction, SettingsView } from '../shared/settings-ui'

// The Settings window's bridge: the view from main, and actions back.
contextBridge.exposeInMainWorld('settingsApi', {
  ready: () => ipcRenderer.send('settings:ready'),
  onView: (fn: (v: SettingsView) => void) => { ipcRenderer.on('settings:view', (_e, v: SettingsView) => fn(v)) },
  act: (a: SettingsAction) => ipcRenderer.send('settings:do', a),
  onIsland: (fn: (what: string) => void) => { ipcRenderer.on('settings:island', (_e, what: string) => fn(what)) }
})
