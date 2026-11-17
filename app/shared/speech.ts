// Which language a message is in, for reading it aloud with a voice of that language (a voice reading another
// language's words mispronounces them). Pure and small: the script most letters are in, and for Latin letters the
// common little words of each language.

const LATIN: Record<string, string[]> = {
  en: ['the', 'and', 'is', 'you', 'to', 'of', 'it', 'that', 'in', 'for', 'with', 'this', 'are', 'what', 'your'],
  fr: ['le', 'la', 'les', 'et', 'est', 'vous', 'de', 'des', 'un', 'une', 'pour', 'que', 'pas', 'je', 'bonjour'],
  es: ['el', 'la', 'los', 'y', 'es', 'que', 'de', 'en', 'un', 'una', 'para', 'por', 'con', 'no', 'hola'],
  de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'sie', 'mit', 'ein', 'eine', 'zu', 'auf', 'für', 'auch'],
  it: ['il', 'lo', 'gli', 'e', 'è', 'che', 'di', 'un', 'una', 'per', 'non', 'sono', 'ciao', 'della', 'con'],
  pt: ['o', 'os', 'as', 'e', 'é', 'que', 'de', 'um', 'uma', 'para', 'não', 'com', 'você', 'olá', 'do'],
  nl: ['de', 'het', 'en', 'is', 'een', 'van', 'niet', 'je', 'ik', 'dat', 'met', 'voor', 'op', 'zijn', 'hallo'],
  tr: ['ve', 'bir', 'bu', 'da', 'de', 'için', 'ile', 'ne', 'mi', 'çok', 'gibi', 'var', 'yok', 'merhaba', 'ben']
}

/** "ar", "en", "fr"… for the text (English when it cannot tell). */
export function speechLanguage(text: string): string {
  const count = (re: RegExp) => (text.match(re) ?? []).length
  const scripts: [string, number][] = [
    [/[پچژگک]/.test(text) && count(/[؀-ۿ]/g) > 0 ? 'fa' : 'ar', count(/[؀-ۿ]/g)],
    ['he', count(/[֐-׿]/g)], ['ru', count(/[Ѐ-ӿ]/g)], ['el', count(/[Ͱ-Ͽ]/g)],
    ['hi', count(/[ऀ-ॿ]/g)], ['ja', count(/[぀-ヿ]/g) * 3], ['ko', count(/[가-힯]/g)],
    ['zh', count(/[一-鿿]/g)], ['latin', count(/[A-Za-zÀ-ÿĞğİıŞş]/g)]
  ]
  const [script, letters] = scripts.sort((a, b) => b[1] - a[1])[0]!
  if (!letters) return 'en' // no letters at all (numbers, symbols)
  if (script !== 'latin') return script
  const words = text.toLowerCase().match(/[a-zà-ÿğıiş]+/g) ?? []
  let best = 'en', score = 0
  for (const [lang, list] of Object.entries(LATIN)) {
    const s = words.filter(w => list.includes(w)).length
    if (s > score) { best = lang; score = s }
  }
  return best
}
