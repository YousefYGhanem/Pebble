import en from '../../i18n/en.json'

// Words on screen come from i18n/<language>.json ("nl.json", "ar.json"…): add a file to add a language. A missing
// word falls back to English. {name} in a text is filled in from vars.

const files = import.meta.glob<{ default: Record<string, string> }>('../../i18n/*.json', { eager: true })
const byId = Object.fromEntries(Object.entries(files).map(([p, m]) => [/([\w-]+)\.json$/.exec(p)![1]!, m.default]))

/** every language there is a file for: { id: "nl", name: "Nederlands" } */
export const LANGUAGES = Object.entries(byId).map(([id, words]) => ({ id, name: words['language.name'] ?? id }))

let words = $state<Record<string, string>>(en)

export function setLanguage(id: string) {
  words = byId[id] ?? en
  document.documentElement.lang = id
  document.documentElement.dir = words['language.dir'] === 'rtl' ? 'rtl' : 'ltr'
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const s = words[key] ?? (en as Record<string, string>)[key] ?? key
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
