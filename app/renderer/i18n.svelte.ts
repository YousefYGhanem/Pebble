import { translate, translateOr, WORDS } from '../shared/i18n'

// The language of a window's words (app/shared/i18n.ts). Reactive: switching language redraws the words at once.

export { LANGUAGES } from '../shared/i18n'

let language = $state('en')

/** mirror: lay the window out right to left for Arabic. The island does not (Pip sits at a fixed spot on the right):
 *  there only each line of text runs right to left. */
export function setLanguage(id: string, mirror = true) {
  language = id in WORDS ? id : 'en'
  document.documentElement.lang = language
  document.documentElement.dir = mirror && WORDS[language]!['language.dir'] === 'rtl' ? 'rtl' : 'ltr'
}

/** dates in the chosen language ("Friday 6 November", "الجمعة ٦ نوفمبر") */
export const locale = () => language

export const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars)
export const tOr = (key: string, fallback: string) => translateOr(language, key, fallback)
