import { test, expect } from 'vitest'
import { apply, askOf, diffOf, summary } from '../app/shared/state'
import { markdown } from '../app/renderer/island/md'

test('steps, edited files, the live diff and the final answer of a turn', () => {
  const base = { session_id: 'a', cwd: 'C:\\code\\shop' }
  let s = apply(undefined, { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'fix it' }, 'claude', 1000)!
  s = apply(s, { ...base, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'C:\\code\\shop\\a.js' } })!
  s = apply(s, { ...base, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'C:\\code\\shop\\a.js', old_string: 'x\ny', new_string: 'z' } }, 'claude', 2000, () => 7)!
  s = apply(s, { ...base, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' } })!
  s = apply(s, { ...base, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash' })!
  expect(s.steps.map(x => x.kind)).toEqual(['read', 'edit', 'run'])
  expect(s.steps[2]!.failed).toBe(true)
  expect(s.files).toEqual(['C:\\code\\shop\\a.js'])
  expect(s.diff).toEqual({ file: 'C:\\code\\shop\\a.js', line: 7, removed: ['x', 'y'], added: ['z'] })
  expect(summary(s.steps)).toBe('read 1 · edited 1 · ran 1')
  s = apply(s, { ...base, hook_event_name: 'Stop', last_assistant_message: 'Fixed the bug.\nDetails…' })!
  expect(s).toMatchObject({ status: 'done', message: 'Fixed the bug.\nDetails…', detail: 'Fixed the bug.' })
  // the next prompt starts a clean turn
  s = apply(s, { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'next' })!
  expect(s).toMatchObject({ steps: [], files: [], message: undefined, diff: undefined })
})

test('what a session asks: permission, questions or a plan', () => {
  expect(askOf({ session_id: 'x', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf dist' } }))
    .toMatchObject({ kind: 'permission', summary: 'Bash: rm -rf dist', canAlways: false })
  expect(askOf({ session_id: 'x', hook_event_name: 'PermissionRequest', tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'Q?', options: [{ label: 'A', description: 'a' }] }] } }))
    .toMatchObject({ kind: 'question', questions: [{ question: 'Q?', options: [{ label: 'A', description: 'a' }], multiSelect: false }] })
  expect(askOf({ session_id: 'x', hook_event_name: 'PermissionRequest', tool_name: 'ExitPlanMode', tool_input: { plan: '# P' } }))
    .toMatchObject({ kind: 'plan', plan: '# P' })
})

test('diffs of Write and MultiEdit', () => {
  expect(diffOf('Write', { file_path: 'n.js', content: 'a\nb' })).toEqual({ file: 'n.js', line: 1, removed: [], added: ['a', 'b'] })
  expect(diffOf('MultiEdit', { file_path: 'm.js', edits: [{ old_string: 'o', new_string: 'p' }] })).toEqual({ file: 'm.js', line: 1, removed: ['o'], added: ['p'] })
  expect(diffOf('Read', { file_path: 'r.js' })).toBeUndefined()
})

test('plan markdown is escaped before formatting', () => {
  expect(markdown('## Step\n- **bold** `x<y>`\n<script>alert(1)</script>'))
    .toBe('<h4>Step</h4><ul><li><b>bold</b> <code>x&lt;y&gt;</code></li></ul><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
})

test('plan markdown nests indented lists inside their item', () => {
  expect(markdown('1. one\n2. two:\n   - a\n   - b\n3. three'))
    .toBe('<ol><li>one</li><li>two:<ul><li>a</li><li>b</li></ul></li><li>three</li></ol>')
})

test('a turn goes running → question → done → gone', () => {
  const base = { session_id: 'a', cwd: 'C:\\code\\shop' }
  let s = apply(undefined, { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'fix the cart' })!
  expect(s.status).toBe('running')
  expect(s.project).toBe('shop')
  s = apply(s, { ...base, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'C:\\code\\shop\\cart.js' } })!
  expect(s.detail).toBe('Edit cart.js')
  s = apply(s, { ...base, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm i' } })!
  expect(s.status).toBe('question')
  expect(s.detail).toBe('Bash: npm i')
  s = apply(s, { ...base, hook_event_name: 'Stop' })!
  expect(s.status).toBe('done')
  expect(s.detail).toBe('Done: fix the cart')
  expect(apply(s, { ...base, hook_event_name: 'SessionEnd' })).toBeNull()
})

test('a session first seen without cwd still gets its project name later', () => {
  let s = apply(undefined, { session_id: 'b', hook_event_name: 'PostToolUse' })!
  expect(s.project).toBe('Claude Code')
  s = apply(s, { session_id: 'b', cwd: '/home/me/blog', hook_event_name: 'Stop' })!
  expect(s.project).toBe('blog')
})
