import en from '../../content/en'
import ar from '../../content/ar'
import type { Content } from '../../content/types'

// The page's language: saved choice, else the browser's. Switching re-renders every word and mirrors the layout.

export type Lang = 'en' | 'ar'
const ALL: Record<Lang, Content> = { en, ar }
const KEY = 'pebble-site-lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'ar') return saved
  } catch { /* storage blocked: fall through */ }
  return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

let lang = $state<Lang>(initial())

export const site = {
  get lang() { return lang },
  get c() { return ALL[lang] }
}
export const contentOf = (l: Lang) => ALL[l]

function apply() {
  const c = ALL[lang], html = document.documentElement
  html.lang = c.lang
  html.dir = c.dir
  document.title = c.meta.title
  document.querySelector('meta[name="description"]')?.setAttribute('content', c.meta.description)
}

export function setLang(l: Lang) {
  lang = l
  try { localStorage.setItem(KEY, l) } catch { /* not remembered, still switched */ }
  apply()
}

apply()
