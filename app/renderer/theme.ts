import type { Theme } from '../shared/settings'

/** Theme tokens → CSS variables on :root (fontSize → --font-size; numbers become px). */
export function applyTheme(theme: Theme, extra: Record<string, string | number> = {}) {
  const root = document.documentElement.style
  for (const [k, v] of Object.entries({ ...theme.tokens, ...extra })) {
    root.setProperty('--' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), typeof v === 'number' ? `${v}px` : v)
  }
}
