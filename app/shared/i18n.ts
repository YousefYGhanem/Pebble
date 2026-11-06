import en from '../../i18n/en.json'
import ar from '../../i18n/ar.json'

// Words on screen come from i18n/<language>.json. To add a language, add its file there and a line below. A missing
// word falls back to English. {name} in a text is filled in from vars. (i18n/drafts holds languages not offered yet.)

export const WORDS: Record<string, Record<string, string>> = { en, ar }

/** the languages Pebble offers: { id: "ar", name: "العربية" } */
export const LANGUAGES = Object.entries(WORDS).map(([id, words]) => ({ id, name: words['language.name'] ?? id }))

export function translate(language: string, key: string, vars: Record<string, string | number> = {}): string {
  const s = WORDS[language]?.[key] ?? WORDS.en![key] ?? key
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** The word for key, or fallback when no language has one (a connector's own name, for example). */
export function translateOr(language: string, key: string, fallback: string): string {
  return WORDS[language]?.[key] ?? WORDS.en![key] ?? fallback
}
