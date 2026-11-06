import { createRequire } from 'node:module'
import { test, expect } from 'vitest'
import { findValues, readValue } from '../app/main/connectors/pick'

// the watch connector's own reading: what "Find values" saves must read back the same value there
const { pick } = createRequire(import.meta.url)('../plugins/watch/index.js') as { pick: (text: string, path: string) => string | undefined }

test('JSON: every value with its path, read back the same way by the connector', () => {
  const api = JSON.stringify({ data: { amount: '67012.5', currency: 'USD' }, items: [{ status: 'open' }], ok: true })
  const found = findValues(api)
  expect(found.map(f => [f.path, f.value])).toEqual([['data.amount', '67012.5'], ['data.currency', 'USD'], ['items.0.status', 'open'], ['ok', 'true']])
  for (const f of found) expect(pick(api, f.path)).toBe(f.value)
})

test('a web page: each number with the words before it, as a pattern that finds it in the raw page', () => {
  const html = '<html><script>var x = 99</script><body><h1>Shop</h1><div class="p">Price: <span>1,299.00</span> EUR</div>' +
    '<p>In stock: 14 left</p><p>Price: 5</p></body></html>'
  const found = findValues(html)
  expect(found.map(f => [f.label, f.value])).toEqual([['Price: 1,299.00 EUR', '1,299.00'], ['In stock: 14 left', '14']])
  for (const f of found) { expect(pick(html, f.path)).toBe(f.value); expect(readValue(html, f.path)).toBe(f.value) }
  expect(found.some(f => f.value === '99')).toBe(false) // script text is not part of the page
})
