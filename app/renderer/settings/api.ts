import type { SettingsAction, SettingsView } from '../../shared/settings-ui'

// window.settingsApi (app/preload/settings.ts), used by the Settings window and the welcome tour.
declare global {
  interface Window { settingsApi: { ready(): void; onView(fn: (v: SettingsView) => void): void; act(a: SettingsAction): void } }
}

export {}
