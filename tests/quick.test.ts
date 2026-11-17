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

test('ask Pip: a question alone; explain and summarize only with something copied (and only on purpose)', () => {
  expect(answer('ask why is the sky blue', c)).toEqual({ kind: 'ai', how: 'ask', text: 'why is the sky blue' })
  expect(answer('explain', c)).toEqual({ kind: 'clip' })
  expect(answer('explain', { ...c, clip: 'TypeError: x is undefined' })).toEqual({ kind: 'ai', how: 'explain', text: '' })
  expect(answer('summarize', { ...c, clip: 'a long text' })).toEqual({ kind: 'ai', how: 'summarize', text: '' })
  expect(answer('what is this', { ...c, clip: 'secret' })).toBeNull() // nothing goes to the provider by itself
})

test('timers: "timer 10m tea", seconds and hours, minutes by default; "timers" lists them', () => {
  expect(answer('timer 10m tea', c)).toEqual({ kind: 'timer', seconds: 600, name: 'tea' })
  expect(answer('timer 90 s', c)).toEqual({ kind: 'timer', seconds: 90, name: '' })
  expect(answer('timer 1.5h deploy check', c)).toEqual({ kind: 'timer', seconds: 5400, name: 'deploy check' })
  expect(answer('timer 25', c)).toEqual({ kind: 'timer', seconds: 1500, name: '' })
  expect(answer('timers', c)).toEqual({ kind: 'timers' })
  expect(answer('timer 0', c)).toBeNull()
})

test('plain words, in English and Arabic, become the same answers', () => {
  const rated = { ...c, rates: { EUR: 1, USD: 1.1, GBP: 0.85, ILS: 4 } }
  expect(text("what's 15% of 80?")).toBe('12')
  expect(text('calculate 12 times 8')).toBe('96')
  expect(text('what is 20 percent of 50')).toBe('10')
  expect(text('how many miles is 5 km')).toBe('3.106856 mi')
  expect(text('convert 100 f to c')).toBe('37.777778 °C')
  expect(text('how much is 110 dollars in euros', rated)).toBe('100 EUR')
  expect(text('$11 to shekels', rated)).toBe('40 ILS')
  expect(text('100 euros in pounds', rated)).toBe('85 GBP') // pounds next to money: sterling
  expect(text('2 kg in pounds')).toBe('4.409245 lb') // pounds next to a weight: a weight
  expect(text('what time is it in Tokyo?')).toBe('07:00 PM')
  expect(answer('translate good morning to French', c)).toEqual({ kind: 'translate', text: 'good morning', to: 'fr' })
  expect(answer('how do you say thank you in Spanish', c)).toEqual({ kind: 'translate', text: 'thank you', to: 'es' })
  expect(answer('ترجم صباح الخير إلى الفرنسية', c)).toEqual({ kind: 'translate', text: 'صباح الخير', to: 'fr' })
  expect(answer('please set a timer for 10 minutes for tea', c)).toEqual({ kind: 'timer', seconds: 600, name: 'tea' })
  expect(answer('a 25 minute timer', c)).toEqual({ kind: 'timer', seconds: 1500, name: '' })
  expect(answer('remind me in 5 min to stretch', c)).toEqual({ kind: 'timer', seconds: 300, name: 'stretch' })
  expect(answer('مؤقت 10 دقائق', c)).toEqual({ kind: 'timer', seconds: 600, name: '' })
  expect(answer('explain this', { ...c, clip: 'TypeError' })).toEqual({ kind: 'ai', how: 'explain', text: '' })
  expect(text('format the json', { ...c, clip: '{"a":1}' })).toBe('{\n  "a": 1\n}')
  // anything else is for Pip: no instant answer
  expect(answer('what is the capital of Japan', c)).toBeNull()
  expect(answer('hey pip, how are you today?', c)).toBeNull()
})

test('settings: translations into a chosen language; tools and explain can be switched off', () => {
  expect(answer('tr good morning', { ...c, translateTo: 'fr' })).toEqual({ kind: 'translate', text: 'good morning', to: 'fr' })
  expect(answer('json', { ...c, clip: '{}', tools: false })).toBeNull()
  expect(answer('explain', { ...c, clip: 'x', copyToAi: false })).toBeNull()
})
