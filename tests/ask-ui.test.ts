import { test, expect } from 'vitest'
import { recommended, risky } from '../app/shared/state'

test("ask card: Allow is not the easy answer for tools that run commands or change files", () => {
  for (const tool of ['Bash', 'PowerShell', 'Write', 'Edit', 'MultiEdit', 'run_shell_command']) expect(risky(tool)).toBe(true)
  for (const tool of ['Read', 'Grep', 'WebFetch', 'Glob']) expect(risky(tool)).toBe(false)
})

test('ask card: only an option the agent recommends is highlighted', () => {
  expect(recommended('Stripe (Recommended)')).toBe(true)
  expect(recommended('Stripe')).toBe(false)
})
