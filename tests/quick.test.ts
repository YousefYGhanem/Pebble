import { test, expect } from 'vitest'
import { answer, digest, evaluate, type Ctx } from '../app/shared/quick'

const c: Ctx = { rates: null, now: Date.UTC(2026, 10, 17, 10, 0), locale: 'en-US' }
const text = (q: string, ctx = c) => { const a = answer(q, ctx); return a && 'text' in a ? a.text : a }

test('the calculator: order, brackets, powers, percent, functions; never eval', () => {
  expect(evaluate('2+3*4')).toBe(14)
  expect(evaluate('(2+3)*4')).toBe(20)
  expect(evaluate('2^3^2')).toBe(512)
  expect(evaluate('15% of 80')).toBe(12)
  expect(evaluate('50%')).toBe(0.5)
  expect(evaluate('sqrt(16)+abs(-2)')).toBe(6)
  expect(evaluate('-(3)')).toBe(-3)
  expect(evaluate('1,000 * 2')).toBe(2000)
  expect(evaluate('2+')).toBeNull()
  expect(evaluate('alert(1)')).toBeNull()
  expect(evaluate('1/0')).toBeNull()
  expect(text('12*8.5')).toBe('102')
  expect(answer('42', c)).toBeNull() // a plain number asks nothing
  expect(answer('hello world', c)).toBeNull()
})

test('units: length, mass, temperature, data; not across kinds', () => {
  expect(text('5 km in miles')).toBe('3.106856 mi')
  expect(text('100 f to c')).toBe('37.777778 °C')
  expect(text('1 gib in mb')).toBe('1,073.741824 mb')
  expect(text('2 kg in lb')).toBe('4.409245 lb')
  expect(answer('5 km in kg', c)).toBeNull()
})

test('currency: asks for the rates first, then converts through EUR', () => {
  expect(answer('100 usd in eur', c)).toEqual({ kind: 'rates' })
  const rated = { ...c, rates: { EUR: 1, USD: 1.1, ILS: 4 } }
  expect(text('110 usd in eur', rated)).toBe('100 EUR')
  expect(text('11 usd to ils', rated)).toBe('40 ILS')
  expect(answer('10 kmh in mph', c)).toMatchObject({ kind: 'unit' }) // three letters, but a unit
})

test('time zones: the time somewhere, and a time from one city in another', () => {
  expect(text('time in tokyo')).toBe('07:00 PM')
  expect(text('9am london in new york')).toBe('04:00 AM')
  expect(answer('9am atlantis in tokyo', c)).toBeNull()
})

test('translate: tr text, tr <language> text; Arabic goes to English', () => {
  expect(answer('tr مرحبا', c)).toEqual({ kind: 'translate', text: 'مرحبا', to: 'en' })
  expect(answer('tr fr good morning', c)).toEqual({ kind: 'translate', text: 'good morning', to: 'fr' })
  expect(answer('translate good morning', c)).toEqual({ kind: 'translate', text: 'good morning', to: 'ar' })
  expect(answer('tr good morning', { ...c, locale: 'ar' })).toEqual({ kind: 'translate', text: 'good morning', to: 'ar' })
})

test('clipboard tools work on what you copied; without a copy they say so', async () => {
  const clip = (q: string, t: string) => text(q, { ...c, clip: t })
  expect(clip('json', '{"a":1}')).toBe('{\n  "a": 1\n}')
  expect(clip('minify', '{ "a": [1, 2] }')).toBe('{"a":[1,2]}')
  expect(answer('json', { ...c, clip: 'not json' })).toMatchObject({ kind: 'tool', text: '' })
  expect(clip('camel', 'hello big world')).toBe('helloBigWorld')
  expect(clip('snake', 'helloBigWorld')).toBe('hello_big_world')
  expect(clip('kebab', 'Hello Big World')).toBe('hello-big-world')
  expect(clip('title', 'hello big world')).toBe('Hello Big World')
  expect(clip('base64', 'مرحبا')).toBe('2YXYsdit2KjYpw==')
  expect(clip('unbase64', '2YXYsdit2KjYpw==')).toBe('مرحبا')
  expect(clip('url', 'a b&c')).toBe('a%20b%26c')
  expect(clip('count', 'one two\nthree')).toBe('3 words · 13 characters · 2 lines')
  expect(clip('count', 'hi')).toBe('1 word · 2 characters · 1 line')
  expect(answer('sha256', { ...c, clip: 'x' })).toEqual({ kind: 'hash', algo: 'SHA-256', text: 'x' })
  expect(await digest('SHA-256', 'abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  expect(answer('upper', c)).toEqual({ kind: 'clip' })
  expect(answer('uuid', c)).toMatchObject({ kind: 'tool', sub: 'uuid' })
  expect(text('1731840000')).toContain('2024')
})

test('colours: hex, rgb and hsl into each other; pick asks main', () => {
  expect(answer('#ff8800', c)).toMatchObject({ kind: 'color', text: 'rgb(255, 136, 0)', color: '#ff8800' })
  expect(answer('rgb(83, 228, 255)', c)).toMatchObject({ text: '#53e4ff' })
  expect(answer('hsl(0, 100%, 50%)', c)).toMatchObject({ text: '#ff0000' })
  expect(answer('#abc', c)).toMatchObject({ color: '#aabbcc' })
  expect(answer('123', c)).toBeNull() // a number, not a colour
  expect(answer('pick', c)).toEqual({ kind: 'pick' })
})
