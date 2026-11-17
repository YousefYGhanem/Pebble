// The quick bar's answers, worked out as you type (pure, so it is tested): a calculator, unit and currency
// conversion, time zones, and what to translate (main asks Pip's chat provider for that).

export type Answer =
  | { kind: 'calc' | 'unit' | 'currency' | 'time'; text: string; sub: string }
  | { kind: 'translate'; text: string; to: string }
  | { kind: 'rates' } // a currency question: main fetches the day's rates first

export interface Ctx {
  /** units per 1 EUR (ECB rates), once fetched */
  rates: Record<string, number> | null
  now: number
  /** the app's language: number and time formats */
  locale: string
}

export function answer(q: string, c: Ctx): Answer | null {
  const s = q.trim()
  if (!s) return null
  return translate(s, c) ?? zones(s, c) ?? currency(s, c) ?? units(s, c) ?? calc(s, c)
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
  to ||= ARABIC.test(text) ? 'en' : c.locale.startsWith('ar') ? 'ar' : /^[\x00-\x7F]*$/.test(text) ? 'ar' : 'en'
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
