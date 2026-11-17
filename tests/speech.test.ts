import { test, expect } from 'vitest'
import { speechLanguage } from '../app/shared/speech'

test('the language a message is read in: its script, and for Latin letters its little words', () => {
  expect(speechLanguage('Good morning! How are you today?')).toBe('en')
  expect(speechLanguage('صباح الخير، كيف حالك اليوم؟')).toBe('ar')
  expect(speechLanguage('Bonjour, je suis très content de vous voir.')).toBe('fr')
  expect(speechLanguage('Hola, ¿qué tal? Es un buen día para la playa.')).toBe('es')
  expect(speechLanguage('Ich bin heute nicht zu Hause, und du?')).toBe('de')
  expect(speechLanguage('Привет, как дела?')).toBe('ru')
  expect(speechLanguage('你好，今天怎么样？')).toBe('zh')
  expect(speechLanguage('こんにちは、元気ですか')).toBe('ja')
  expect(speechLanguage('سلام، چطوری؟')).toBe('fa')
  expect(speechLanguage('The function `x` failed. سبب الخطأ هو أن المتغير غير معرّف في هذا السطر')).toBe('ar') // mostly Arabic
  expect(speechLanguage('12345')).toBe('en')
})
