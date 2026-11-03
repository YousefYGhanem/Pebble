import type { HookEvent } from '../../shared/state'

// Turns each agent's own hook payload into Claude Code's shape (HookEvent), the one the session reducer understands.
// Claude Code, Codex and Pebble's OpenCode plugin already send that shape. null = nothing to show for this event.
// Field names: Gemini CLI hooks reference, Cursor hooks reference (both checked November 2026).

type Body = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function gemini(b: Body): HookEvent | null {
  const base = { session_id: str(b.session_id) ?? '', cwd: str(b.cwd) }
  switch (b.hook_event_name) {
    case 'SessionStart': return { ...base, hook_event_name: 'SessionStart' }
    case 'BeforeAgent': return { ...base, hook_event_name: 'UserPromptSubmit', prompt: str(b.prompt) }
    case 'BeforeTool': return { ...base, hook_event_name: 'PreToolUse', tool_name: str(b.tool_name), tool_input: obj(b.tool_input) }
    case 'AfterTool': return { ...base, hook_event_name: 'PostToolUse', tool_name: str(b.tool_name) }
    case 'AfterAgent': return { ...base, hook_event_name: 'Stop', last_assistant_message: str(b.prompt_response) }
    case 'SessionEnd': return { ...base, hook_event_name: 'SessionEnd' }
    case 'Notification': {
      // Gemini asks in its own terminal; Pebble shows that it waits for you (it cannot answer for it)
      if (b.notification_type === 'ToolPermission') {
        const d = obj(b.details)
        return { ...base, hook_event_name: 'PermissionRequest', tool_name: str(d.tool_name) ?? str(d.name) ?? str(b.message) ?? 'a tool', tool_input: d }
      }
      return { ...base, hook_event_name: 'Notification', message: str(b.message) }
    }
    default: return null
  }
}

/** Cursor: the conversation is the session; its final text arrives in afterAgentResponse, before stop. */
export function cursor(b: Body, lastText: Map<string, string>): HookEvent | null {
  const id = str(b.conversation_id) ?? ''
  const roots = Array.isArray(b.workspace_roots) ? b.workspace_roots : []
  const base = { session_id: id, cwd: str(roots[0]) }
  switch (b.hook_event_name) {
    case 'sessionStart': return { ...base, hook_event_name: 'SessionStart' }
    case 'beforeSubmitPrompt': return { ...base, hook_event_name: 'UserPromptSubmit', prompt: str(b.prompt) }
    case 'afterShellExecution': return { ...base, hook_event_name: 'PreToolUse', tool_name: 'Shell', tool_input: { command: str(b.command) ?? '' } }
    case 'afterFileEdit': {
      const edit = obj(Array.isArray(b.edits) ? b.edits[0] : undefined)
      return { ...base, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: str(b.file_path) ?? '', old_string: str(edit.old_string) ?? '', new_string: str(edit.new_string) ?? '' } }
    }
    case 'afterMCPExecution': return { ...base, hook_event_name: 'PreToolUse', tool_name: str(b.tool_name) ?? 'MCP' }
    case 'afterAgentResponse': { const t = str(b.text); if (t) lastText.set(id, t); return null }
    case 'stop': {
      const message = lastText.get(id)
      lastText.delete(id)
      return b.status === 'error'
        ? { ...base, hook_event_name: 'StopFailure', error: 'Cursor stopped with an error' }
        : { ...base, hook_event_name: 'Stop', last_assistant_message: b.status === 'aborted' ? 'Stopped' : message }
    }
    case 'sessionEnd': return { ...base, hook_event_name: 'SessionEnd' }
    default: return null
  }
}
