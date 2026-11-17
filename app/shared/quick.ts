// The quick bar's answers, worked out as you type (pure, so it is tested): a calculator, unit and currency
// conversion, time zones, and what to translate (main asks Pip's chat provider for that).

export type Answer =
  | { kind: 'calc' | 'unit' | 'currency' | 'time' | 'tool'; text: string; sub: string }
  | { kind: 'color'; text: string; sub: string; color: string }
  | { kind: 'translate'; text: string; to: string }
  | { kind: 'rates' } // a currency question: main fetches the day's rates first
  | { kind: 'hash'; algo: 'SHA-1' | 'SHA-256' | 'SHA-512'; text: string } // worked out by the bar (Web Crypto is async)
  | { kind: 'pick' } // the colour under the mouse: main reads it
  | { kind: 'clip' } // a clipboard tool, with nothing copied yet
  | { kind: 'ai'; how: 'ask' | 'explain' | 'summarize'; text: string } // Pip's chat provider, on Enter (explain/summarize: what you copied)
  | { kind: 'timer'; seconds: number; name: string } // started on Enter
  | { kind: 'timers' } // the running ones, to stop

export interface Ctx {
  /** units per 1 EUR (ECB rates), once fetched */
  rates: Record<string, number> | null
  now: number
  /** the app's language: number and time formats */
  locale: string
  /** the text on the clipboard (clipboard tools work on it) */
  clip?: string
  /** Settings → Pip: the language translations go into ('auto': Arabic ↔ English) */
  translateTo?: string
  /** Settings → Pip: the clipboard tools (json, base64…) and explain/summarize (they send what you copied) */
  tools?: boolean
  copyToAi?: boolean
}

export function answer(q: string, c: Ctx): Answer | null {
  const s = natural(q.trim())
  if (!s) return null
  return tool(s, c) ?? color(s) ?? translate(s, c) ?? zones(s, c) ?? currency(s, c) ?? units(s, c) ?? stamp(s, c) ?? calc(s, c)
}

// ---------- plain words: "what's 15% of 80", "translate hi to French", "set a timer for 10 minutes" ----------

/** language names (English and Arabic) → codes */
const LANG_WORDS: Record<string, string> = {
  english: 'en', arabic: 'ar', french: 'fr', spanish: 'es', german: 'de', italian: 'it', portuguese: 'pt', turkish: 'tr', russian: 'ru', chinese: 'zh',
  japanese: 'ja', korean: 'ko', hindi: 'hi', urdu: 'ur', persian: 'fa', farsi: 'fa', hebrew: 'he', dutch: 'nl', indonesian: 'id',
  'الإنجليزية': 'en', 'الانجليزية': 'en', 'الإنكليزية': 'en', 'العربية': 'ar', 'الفرنسية': 'fr', 'الإسبانية': 'es', 'الاسبانية': 'es', 'الألمانية': 'de', 'الالمانية': 'de',
  'الإيطالية': 'it', 'الايطالية': 'it', 'البرتغالية': 'pt', 'التركية': 'tr', 'الروسية': 'ru', 'الصينية': 'zh', 'اليابانية': 'ja', 'الكورية': 'ko', 'الهندية': 'hi',
  'الأردية': 'ur', 'الاردية': 'ur', 'الفارسية': 'fa', 'العبرية': 'he', 'الهولندية': 'nl', 'الإندونيسية': 'id'
}
const LANG_RE = Object.keys(LANG_WORDS).sort((a, b) => b.length - a.length).join('|')
/** currency names → codes ("pounds" is a weight unless the other side is a currency) */
const MONEY: Record<string, string> = {
  dollar: 'USD', dollars: 'USD', '$': 'USD', euro: 'EUR', euros: 'EUR', '€': 'EUR', sterling: 'GBP', '£': 'GBP', yen: 'JPY', yuan: 'CNY', rupee: 'INR', rupees: 'INR',
  shekel: 'ILS', shekels: 'ILS', nis: 'ILS', lira: 'TRY', liras: 'TRY', franc: 'CHF', francs: 'CHF', won: 'KRW', real: 'BRL', reais: 'BRL', rand: 'ZAR', ringgit: 'MYR',
  peso: 'MXN', pesos: 'MXN', krona: 'SEK', kronor: 'SEK', 'دولار': 'USD', 'يورو': 'EUR', 'شيكل': 'ILS', 'ين': 'JPY', 'ليرة': 'TRY', 'روبية': 'INR'
}
const ARABIC_UNITS: Record<string, string> = { 'ثانية': 's', 'ثواني': 's', 'ثوان': 's', 'دقيقة': 'm', 'دقائق': 'm', 'دقيقتين': 'm', 'ساعة': 'h', 'ساعات': 'h', 'ساعتين': 'h' }

/** A request in plain words, rewritten into the bar's own short forms (anything else stays as it was). */
export function natural(input: string): string {
  let s = input.trim().replace(/[?؟!.]+$/, '').trim()
  // polite openings: "hey pip, please", "can you", "could you"
  s = s.replace(/^(?:(?:hey|hi|ok|okay)\s+)?(?:pip[,:]?\s+)?(?:please\s+|pls\s+|(?:can|could|would) you\s+)?(?:please\s+)?/i, '').replace(/^(?:من فضلك|لو سمحت)\s+/, '')
  let m: RegExpExecArray | null
  // translate: "translate X to/into French", "how do you say X in French", "X in French please" is left to Pip
  if ((m = new RegExp(`^(?:translate|ترجم)\\s+(.+?)\\s+(?:to|into|in|إلى|الى|ل)\\s*(${LANG_RE})$`, 'is').exec(s))) return `tr ${LANG_WORDS[m[2]!.toLowerCase()]} ${m[1]}`
  if ((m = new RegExp(`^how (?:do|would) (?:you|i) say\\s+(.+?)\\s+in\\s+(${LANG_RE})$`, 'is').exec(s))) return `tr ${LANG_WORDS[m[2]!.toLowerCase()]} ${m[1]}`
  if ((m = /^translate\s+(.+)$/is.exec(s))) return `tr ${m[1]}`
  // timers: "set a timer for 10 minutes (for tea)", "a 25 minute timer", "remind me in 5 min to stretch", "مؤقت 10 دقائق"
  const unitOf = (u: string) => ARABIC_UNITS[u] ?? u
  if ((m = /^(?:set |start )?(?:a |an )?timer (?:for |of )?(\d+(?:\.\d+)?)\s*([a-z]+)?(?:\s+(?:for|called|named)\s+(.+))?$/i.exec(s))) return `timer ${m[1]}${m[2] ? m[2][0] : 'm'} ${m[3] ?? ''}`.trim()
  if ((m = /^(?:set |start )?(?:a |an )?(\d+(?:\.\d+)?)[ -]?(second|sec|minute|min|hour|hr)s? timer(?:\s+(?:for|called|named)\s+(.+))?$/i.exec(s))) return `timer ${m[1]}${m[2]![0]} ${m[3] ?? ''}`.trim()
  if ((m = /^remind me in (\d+(?:\.\d+)?)\s*([a-z]+)(?:\s+(?:to|about)\s+(.+))?$/i.exec(s))) return `timer ${m[1]}${m[2]![0]} ${m[3] ?? ''}`.trim()
  if ((m = /^(?:مؤقت|ذكرني بعد)\s+(\d+(?:\.\d+)?)?\s*(\S+)(?:\s+(?:لـ|ل|عن)?\s*(.+))?$/.exec(s)) && ARABIC_UNITS[m[2]!]) return `timer ${m[1] ?? (/ين$/.test(m[2]!) ? '2' : '1')}${unitOf(m[2]!)} ${m[3] ?? ''}`.trim()
  // the time somewhere: "what time is it in Tokyo"
  if ((m = /^what(?:'s| is)? the time in\s+(.+)$|^what time is it in\s+(.+)$/i.exec(s))) return `time in ${m[1] ?? m[2]}`
  // clipboard: "explain this", "summarize what I copied", "format the json"
  if (/^(?:explain|اشرح)\s+(?:this|it|that|what i copied|the clipboard|هذا|ما نسخته)$/i.test(s)) return 'explain'
  if (/^(?:summari[sz]e|sum up|لخص|لخّص)\s+(?:this|it|that|what i copied|the clipboard|هذا|ما نسخته)$/i.test(s)) return 'summarize'
  if (/^(?:format|pretty ?print|beautify)\s+(?:the |this |my )?json$/i.test(s)) return 'json'
  if ((m = /^(?:make it |to |convert (?:it|this) to )(upper|lower|title|camel|snake|kebab)\s*case$/i.exec(s))) return m[1]!.toLowerCase()
  // sums and conversions: "what's 15% of 80", "calculate 12 times 8", "how much is 100 dollars in euros", "how many miles is 5 km"
  s = s.replace(/^(?:what(?:'s| is)|whats|how much is|how much are|calculate|calc|compute|convert|كم يساوي|كم|احسب|حوّل|حول|ما هو|ما هي)\s+/i, '')
  if ((m = /^how many\s+(.+?)\s+(?:is|are|in)\s+(.+)$/i.exec(s))) s = `${m[2]} in ${m[1]}`
  s = s.replace(/(\d)\s*(?:percent|per cent|٪)/gi, '$1%').replace(/\s+(?:times|multiplied by)\s+/gi, ' * ').replace(/\s+divided by\s+/gi, ' / ')
    .replace(/\s+plus\s+/gi, ' + ').replace(/\s+minus\s+/gi, ' - ').replace(/(\d)\s*x\s*(\d)/gi, '$1*$2').replace(/\s+(?:into|إلى|الى|بال|ب)\s+/g, ' in ')
  // money words: "100 dollars in euros" → "100 usd in eur"; "$100 to €" works too
  const money = (w: string) => MONEY[w.toLowerCase()] ?? (/^[a-z]{3}$/i.test(w) ? w.toUpperCase() : undefined)
  const pound = (w: string) => /^pounds?$/i.test(w)
  if ((m = /^([$€£]?)\s*([\d.,]+)\s*([^\s\d]+)?\s+(?:in|to)\s+([^\s\d]+)$/i.exec(s))) {
    const left = m[1] || m[3] || '', right = m[4]!, named = (w: string) => !!MONEY[w.toLowerCase()]
    let from = money(left), to = money(right)
    if (pound(left) && named(right)) from = 'GBP' // "pounds" is money only next to money
    if (pound(right) && named(left)) to = 'GBP'
    // rewritten only when a money word or sign was used (codes like "usd" already work as typed)
    if (from && to && (named(left) || named(right) || (pound(left) && named(right)) || (pound(right) && named(left)))) return `${m[2]} ${from.toLowerCase()} in ${to.toLowerCase()}`
  }
  return s
}

const fmt = (n: number, c: Ctx, digits = 10) => n.toLocaleString(c.locale, { maximumFractionDigits: Math.abs(n) >= 1 ? Math.min(digits, 6) : digits })

// ---------- translate ----------

export const LANG_NAMES: Record<string, string> = { en: 'English', ar: 'Arabic', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', tr: 'Turkish',
  ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', hi: 'Hindi', ur: 'Urdu', fa: 'Persian', he: 'Hebrew', nl: 'Dutch', id: 'Indonesian' }
const LANGS = Object.keys(LANG_NAMES)
const ARABIC = /[؀-ۿ]/

function translate(s: string, c: Ctx): Answer | null {
  const m = /^(?:tr|translate|ترجم)\s+(.+)$/is.exec(s)
  if (!m) return null
  let text = m[1]!.trim(), to = ''
  const lang = /^([a-z]{2})\s+(.+)$/is.exec(text)
  if (lang && LANGS.includes(lang[1]!.toLowerCase())) { to = lang[1]!.toLowerCase(); text = lang[2]!.trim() }
  // Arabic becomes English; anything else becomes the app's language, or Arabic when that is English already
  to ||= c.translateTo && c.translateTo !== 'auto' ? c.translateTo : ARABIC.test(text) ? 'en' : c.locale.startsWith('ar') ? 'ar' : /^[\x00-\x7F]*$/.test(text) ? 'ar' : 'en'
  return text ? { kind: 'translate', text, to } : null
}

// ---------- time zones: "time in tokyo", "9am tokyo in hebron", "15:30 london to new york" ----------

let ZONES: string[] | undefined
function zone(name: string): string | undefined {
  ZONES ??= (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  const key = name.trim().toLowerCase().replace(/\s+/g, '_')
  if (key === 'utc' || key === 'gmt') return 'UTC'
  return ZONES.find(z => z.toLowerCase() === key || z.toLowerCase().endsWith('/' + key))
}

/** minutes the zone is ahead of UTC at that moment */
function offset(tz: string, at: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    .formatToParts(at).map(x => [x.type, Number(x.value)]))
  return (Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!) - Math.floor(at / 60_000) * 60_000) / 60_000
}

const clock = (at: number, tz: string, c: Ctx) => new Date(at).toLocaleTimeString(c.locale, { timeZone: tz, hour: '2-digit', minute: '2-digit' })
const place = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ')

function zones(s: string, c: Ctx): Answer | null {
  const now = /^(?:time|الوقت|الساعة)\s+(?:in|at|في)\s+(.+)$/i.exec(s)
  if (now) {
    const tz = zone(now[1]!)
    return tz ? { kind: 'time', text: clock(c.now, tz, c), sub: place(tz) } : null
  }
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:in\s+)?(.+?)\s+(?:in|to)\s+(.+)$/i.exec(s)
  if (!m) return null
  const from = zone(m[4]!), to = zone(m[5]!)
  if (!from || !to) return null
  let h = Number(m[1]), min = Number(m[2] ?? 0)
  const ampm = m[3]?.toLowerCase()
  if (h > 23 || min > 59 || (ampm && (h < 1 || h > 12))) return null
  if (ampm === 'pm' && h < 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  // that wall-clock time today in the first zone, as one moment
  const day = new Date(c.now + offset(from, c.now) * 60_000)
  const guess = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, min)
  const at = guess - offset(from, guess) * 60_000
  return { kind: 'time', text: clock(at, to, c), sub: `${place(to)} · ${clock(at, from, c)} ${place(from)}` }
}

// ---------- currency: "100 usd in eur" ----------

function currency(s: string, c: Ctx): Answer | null {
  const m = /^([\d.,]+)\s*([a-z]{3})\s+(?:in|to)\s+([a-z]{3})$/i.exec(s)
  if (!m) return null
  const from = m[2]!.toUpperCase(), to = m[3]!.toUpperCase(), n = Number(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(n) || from === to) return null
  if (!c.rates) return /^[A-Z]{3}$/.test(from) && !UNIT_NAMES.has(from.toLowerCase()) ? { kind: 'rates' } : null
  const a = c.rates[from], b = c.rates[to]
  if (!a || !b) return null
  const v = (n / a) * b
  return { kind: 'currency', text: `${fmt(v, c, 2)} ${to}`, sub: `${fmt(n, c, 2)} ${from} · 1 ${from} = ${fmt(b / a, c, 4)} ${to}` }
}

// ---------- units: "5 km in miles", "70 f to c" ----------

const U: Record<string, [string, number]> = {
  // length (metres)
  mm: ['len', 0.001], cm: ['len', 0.01], m: ['len', 1], km: ['len', 1000], in: ['len', 0.0254], ft: ['len', 0.3048], yd: ['len', 0.9144], mi: ['len', 1609.344],
  // mass (grams)
  mg: ['mass', 0.001], g: ['mass', 1], kg: ['mass', 1000], t: ['mass', 1e6], oz: ['mass', 28.349523125], lb: ['mass', 453.59237],
  // volume (litres)
  ml: ['vol', 0.001], l: ['vol', 1], tsp: ['vol', 0.00492892], tbsp: ['vol', 0.0147868], cup: ['vol', 0.24], floz: ['vol', 0.0295735], gal: ['vol', 3.785411784],
  // data (bytes)
  b: ['data', 1], kb: ['data', 1e3], mb: ['data', 1e6], gb: ['data', 1e9], tb: ['data', 1e12], kib: ['data', 1024], mib: ['data', 1024 ** 2], gib: ['data', 1024 ** 3], tib: ['data', 1024 ** 4],
  // time (seconds)
  ms: ['time', 0.001], s: ['time', 1], min: ['time', 60], h: ['time', 3600], d: ['time', 86400], wk: ['time', 604800],
  // speed (metres per second)
  kmh: ['speed', 1 / 3.6], mph: ['speed', 0.44704], mps: ['speed', 1], kn: ['speed', 0.514444]
}
const ALIAS: Record<string, string> = {
  meter: 'm', meters: 'm', metre: 'm', metres: 'm', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km', centimeter: 'cm', centimeters: 'cm',
  millimeter: 'mm', millimeters: 'mm', inch: 'in', inches: 'in', foot: 'ft', feet: 'ft', yard: 'yd', yards: 'yd', mile: 'mi', miles: 'mi',
  gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', ton: 't', tons: 't', tonne: 't', tonnes: 't', ounce: 'oz', ounces: 'oz', pound: 'lb', pounds: 'lb', lbs: 'lb',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l', milliliter: 'ml', milliliters: 'ml', gallon: 'gal', gallons: 'gal', cups: 'cup',
  byte: 'b', bytes: 'b', sec: 's', secs: 's', second: 's', seconds: 's', mins: 'min', minute: 'min', minutes: 'min', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  day: 'd', days: 'd', week: 'wk', weeks: 'wk', 'km/h': 'kmh', kph: 'kmh', 'm/s': 'mps', knot: 'kn', knots: 'kn',
  c: 'c', '°c': 'c', celsius: 'c', f: 'f', '°f': 'f', fahrenheit: 'f', k: 'k', kelvin: 'k'
}
const UNIT_NAMES = new Set([...Object.keys(U), ...Object.keys(ALIAS)])
const unit = (u: string) => { const k = u.trim().toLowerCase(); return ALIAS[k] ?? (k in U ? k : undefined) }
const TEMP = new Set(['c', 'f', 'k'])

function units(s: string, c: Ctx): Answer | null {
  const m = /^(-?[\d.,]+)\s*([a-z°/]+(?:\s?[a-z]+)?)\s+(?:in|to)\s+([a-z°/]+)$/i.exec(s)
  if (!m) return null
  const n = Number(m[1]!.replace(/,/g, '')), from = unit(m[2]!), to = unit(m[3]!)
  if (!Number.isFinite(n) || !from || !to || from === to) return null
  let v: number
  if (TEMP.has(from) || TEMP.has(to)) {
    if (!TEMP.has(from) || !TEMP.has(to)) return null
    const kelvin = from === 'c' ? n + 273.15 : from === 'f' ? (n - 32) * 5 / 9 + 273.15 : n
    v = to === 'c' ? kelvin - 273.15 : to === 'f' ? (kelvin - 273.15) * 9 / 5 + 32 : kelvin
  } else {
    const a = U[from]!, b = U[to]!
    if (a[0] !== b[0]) return null
    v = (n * a[1]) / b[1]
  }
  const label = (u: string) => (TEMP.has(u) ? (u === 'k' ? 'K' : `°${u.toUpperCase()}`) : u)
  return { kind: 'unit', text: `${fmt(v, c, 6)} ${label(to)}`, sub: `${fmt(n, c)} ${label(from)}` }
}

// ---------- calculator: + - * / ^ %, brackets, sqrt sin cos tan log ln abs round, pi e, "15% of 80" ----------

const FN: Record<string, (x: number) => number> = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil }

/** The value of an arithmetic expression, or null (a small parser: never eval). */
export function evaluate(src: string): number | null {
  const s = src.toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/,(?=\d{3}\b)/g, '').replace(/\s+/g, '')
  const pct = /^(-?[\d.]+)%of(.+)$/.exec(s) // "15% of 80"
  if (pct) { const of = evaluate(pct[2]!); return of === null ? null : (Number(pct[1]) / 100) * of }
  let i = 0
  const peek = () => s[i], eat = (ch: string) => (s[i] === ch ? (i++, true) : false)
  function primary(): number {
    if (eat('(')) { const v = sum(); if (!eat(')')) throw 0; return v }
    if (eat('-')) return -factor()
    if (eat('+')) return factor()
    const num = /^\d*\.?\d+(e[+-]?\d+)?/.exec(s.slice(i))
    if (num) { i += num[0].length; return Number(num[0]) }
    const word = /^[a-z]+/.exec(s.slice(i))?.[0]
    if (!word) throw 0
    i += word.length
    if (word === 'pi') return Math.PI
    if (word === 'e') return Math.E
    const f = FN[word]
    if (!f || peek() !== '(') throw 0
    return f(primary())
  }
  function factor(): number {
    let v = primary()
    while (eat('%')) v /= 100
    if (eat('^')) v = v ** factor() // right to left
    return v
  }
  function product(): number {
    let v = factor()
    for (;;) { if (eat('*')) v *= factor(); else if (eat('/')) v /= factor(); else return v }
  }
  function sum(): number {
    let v = product()
    for (;;) { if (eat('+')) v += product(); else if (eat('-')) v -= product(); else return v }
  }
  try {
    const v = sum()
    return i === s.length && Number.isFinite(v) ? v : null
  } catch { return null }
}

function calc(s: string, c: Ctx): Answer | null {
  if (!/[-+*/^%×÷(]|\b(sqrt|sin|cos|tan|log|ln|abs|round|floor|ceil|pi)\b/i.test(s.replace(/^-/, ''))) return null // a plain number is no sum
  const v = evaluate(s)
  return v === null ? null : { kind: 'calc', text: fmt(v, c), sub: s }
}

// ---------- clipboard tools: a tool's name works on what you copied ----------

const words = (t: string) => t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
const b64 = (t: string) => { let bin = ''; for (const b of new TextEncoder().encode(t)) bin += String.fromCharCode(b); return btoa(bin) }
const unb64 = (t: string) => new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(t.trim()), ch => ch.charCodeAt(0)))
const TOOLS: Record<string, (t: string) => string> = {
  json: t => JSON.stringify(JSON.parse(t), null, 2),
  minify: t => JSON.stringify(JSON.parse(t)),
  upper: t => t.toUpperCase(),
  lower: t => t.toLowerCase(),
  title: t => t.toLowerCase().replace(/(^|[\s(\-"'])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()),
  camel: t => words(t).map((w, i) => (i ? w[0]!.toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join(''),
  snake: t => words(t).map(w => w.toLowerCase()).join('_'),
  kebab: t => words(t).map(w => w.toLowerCase()).join('-'),
  base64: b64,
  unbase64: unb64,
  url: t => encodeURIComponent(t),
  unurl: t => decodeURIComponent(t),
  trim: t => t.split('\n').map(l => l.trim()).join('\n').trim(),
  count: t => ([[words(t).length, 'word'], [[...t].length, 'character'], [t.split('\n').length, 'line']] as const).map(([n, w]) => `${n} ${w}${n === 1 ? '' : 's'}`).join(' · ')
}
const HASHES = { sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512' } as const
const preview = (t: string) => { const one = t.replace(/\s+/g, ' ').trim(); return one.length > 40 ? one.slice(0, 39) + '…' : one }

function tool(s: string, c: Ctx): Answer | null {
  const name = s.toLowerCase()
  if (name === 'uuid') return { kind: 'tool', text: crypto.randomUUID(), sub: 'uuid' }
  if (name === 'now' || name === 'timestamp') return { kind: 'tool', text: String(Math.floor(c.now / 1000)), sub: new Date(c.now).toLocaleString(c.locale) }
  if (['pick', 'color', 'colour', 'لون'].includes(name)) return { kind: 'pick' }
  const ask = /^(?:ask|اسأل)\s+(.+)$/is.exec(s)
  if (ask) return { kind: 'ai', how: 'ask', text: ask[1]!.trim() }
  const work = name === 'explain' || name === 'اشرح' ? 'explain' : ['summarize', 'summarise', 'summary', 'لخص', 'لخّص'].includes(name) ? 'summarize' : null
  if (work && c.copyToAi !== false) return c.clip ? { kind: 'ai', how: work, text: '' } : { kind: 'clip' }
  if (name === 'timer' || name === 'timers' || name === 'مؤقت') return { kind: 'timers' }
  const timer = /^(?:timer|مؤقت)\s+(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)?\b\s*(.*)$/i.exec(s)
  if (timer) {
    const unit = (timer[2] ?? 'm').toLowerCase()[0]
    const seconds = Math.round(Number(timer[1]) * (unit === 's' ? 1 : unit === 'h' ? 3600 : 60))
    if (seconds >= 1 && seconds <= 7 * 86400) return { kind: 'timer', seconds, name: timer[3]!.trim().slice(0, 60) }
  }
  const run = TOOLS[name], hash = HASHES[name as keyof typeof HASHES]
  if ((!run && !hash) || c.tools === false) return null
  if (!c.clip) return { kind: 'clip' }
  if (hash) return { kind: 'hash', algo: hash, text: c.clip }
  try { return { kind: 'tool', text: run!(c.clip), sub: `${name} · ${preview(c.clip)}` } }
  catch { return { kind: 'tool', text: '', sub: `${name}: the copied text is not ${name === 'json' || name === 'minify' ? 'JSON' : 'in that form'}` } }
}

/** A 10- or 13-digit number: a Unix time, as a date. */
function stamp(s: string, c: Ctx): Answer | null {
  if (!/^\d{10}(\d{3})?$/.test(s)) return null
  const ms = s.length === 13 ? Number(s) : Number(s) * 1000
  return { kind: 'tool', text: new Date(ms).toLocaleString(c.locale, { dateStyle: 'medium', timeStyle: 'medium' }), sub: new Date(ms).toISOString() }
}

// ---------- colours: #hex, rgb(), hsl() into the other two ----------

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min
  if (!d) return [0, 0, Math.round(l * 100)]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [Math.round((h * 60 + 360) % 360), Math.round(s * 100), Math.round(l * 100)]
}
function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const S = s / 100, L = l / 100, a = S * Math.min(L, 1 - L), k = (n: number) => (n + h / 30) % 12
  const f = (n: number) => Math.round(255 * (L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return [f(0), f(8), f(4)]
}
const toHex = (rgb: number[]) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')

export function color(s: string): Answer | null {
  const t = s.trim().toLowerCase()
  let rgb: [number, number, number] | undefined, from = ''
  const h = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t)
  if (h && (t.startsWith('#') || /[a-f]/.test(h[1]!))) { // "123" alone is a number, not a colour
    const v = h[1]!.length === 3 ? [...h[1]!].map(x => x + x).join('') : h[1]!
    rgb = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)) as [number, number, number]; from = 'hex'
  }
  const r = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(t)
  if (r) { rgb = [Number(r[1]), Number(r[2]), Number(r[3])]; from = 'rgb' }
  const l = /^hsla?\(\s*(\d{1,3})(?:deg)?[\s,]+(\d{1,3})%?[\s,]+(\d{1,3})%?/.exec(t)
  if (l) { rgb = fromHsl(Number(l[1]), Number(l[2]), Number(l[3])); from = 'hsl' }
  if (!rgb || rgb.some(v => v > 255)) return null
  const hex = toHex(rgb), [hh, ss, ll] = toHsl(...rgb), rgbText = `rgb(${rgb.join(', ')})`, hslText = `hsl(${hh}, ${ss}%, ${ll}%)`
  const main = from === 'hex' ? rgbText : hex
  return { kind: 'color', text: main, sub: [hex, rgbText, hslText].filter(v => v !== main).join(' · '), color: hex }
}

/** A clipboard tool's hash, as hex (Web Crypto, in the bar). */
export async function digest(algo: 'SHA-1' | 'SHA-256' | 'SHA-512', text: string): Promise<string> {
  const d = await crypto.subtle.digest(algo, new TextEncoder().encode(text))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}
