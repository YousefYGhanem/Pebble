import { test, expect } from 'vitest'
import { answer, evaluate } from '../app/shared/quick'

const c: { rates: Record<string, number> | null; now: number; locale: string } = { rates: null, now: Date.UTC(2026, 10, 17, 10, 0), locale: 'en-US' }
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
