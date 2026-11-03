import { execSync } from 'node:child_process'
import { test, expect } from 'vitest'
import { parseFixes, readWord } from '../app/main/ai/word'
import { skinFor } from '../app/renderer/island/skins'
import { report } from '../app/main/diagnostics'

test('only fixes that can really be made are kept', () => {
  const doc = 'Teh cat sat on the mat. It was there for alot of time.'
  const answer = 'Sure! [{"find":"Teh cat","replace":"The cat","why":"spelling"},{"find":"alot","replace":"a lot","why":"spelling"},' +
    '{"find":"not in the text","replace":"x","why":"?"},{"find":"mat","replace":"mat","why":"same"},{"find":5}] Done.'
  expect(parseFixes(answer, doc)).toEqual([{ find: 'Teh cat', replace: 'The cat', why: 'spelling' }, { find: 'alot', replace: 'a lot', why: 'spelling' }])
  expect(parseFixes('no JSON here', doc)).toEqual([])
})

test('living skins follow the processor, the night and the length of the day', () => {
  expect(skinFor({ cpu: 95, hour: 14, dayHours: 2 })).toEqual({ fire: 1, frost: 0, web: false, vines: 0 })
  expect(skinFor({ cpu: 1, hour: 23, dayHours: 12 })).toEqual({ fire: 0, frost: 0.6, web: true, vines: 1 })
  expect(skinFor({ cpu: 40, hour: 10, dayHours: 10 }).vines).toBeCloseTo(0.5)
})

test('the diagnostics report reads as plain text', () => {
  expect(report([{ name: 'Agent server', ok: true, detail: 'port 47901' }, { name: 'Codex', ok: false }])).toBe('✓ Agent server — port 47901\n✗ Codex')
})

const wordRunning = (() => { try { return execSync('tasklist /FI "IMAGENAME eq WINWORD.EXE" /NH').toString().includes('WINWORD') } catch { return true } })()
test.skipIf(wordRunning)('without an open Word document, "Fix in Word" says what to do', async () => {
  await expect(readWord()).rejects.toThrow('Open the document in Word first.')
}, 30000)
