// Pure session state: one agent hook event in, the updated session out. No Electron here, so it is testable.
// Every agent's events are turned into Claude Code's hook shape (HookEvent) by its adapter; that is the shared model.

export type Status = 'ready' | 'running' | 'question' | 'done' | 'error'
export type Agent = 'claude' | 'codex' | 'gemini' | 'cursor' | 'opencode' | 'dsh' | 'cli' | 'web'

/** How each agent is called in the island. */
export const AGENT_NAMES: Record<Agent, string> = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini', cursor: 'Cursor', opencode: 'OpenCode', dsh: 'DeepSeek Harness', cli: 'Script', web: 'Chat' }
export type StepKind = 'read' | 'edit' | 'run' | 'search' | 'web' | 'task' | 'other'

export interface Step { at: number; kind: StepKind; text: string; failed?: boolean }

/** The code an agent changes right now: lines out (red) and in (green). */
export interface Diff { file: string; line: number; removed: string[]; added: string[] }

export interface Question {
  question: string
  header?: string
  options: { label: string; description?: string }[]
  multiSelect?: boolean
}

/** What a session waits for you to decide. */
export type Ask =
  | { kind: 'permission'; tool: string; summary: string; input: Record<string, unknown>; canAlways: boolean }
  | { kind: 'question'; input: Record<string, unknown>; questions: Question[] }
  | { kind: 'plan'; input: Record<string, unknown>; plan: string }

export interface Session {
  id: string
  agent: Agent
  project: string
  cwd?: string
  status: Status
  detail: string
  prompt?: string
  at: number
  /** when the current turn started (the live timer) */
  startedAt?: number
  /** this turn's steps, newest last (at most 40) */
  steps: Step[]
  /** files edited this turn */
  files: string[]
  diff?: Diff
  /** the agent's final answer of the turn */
  message?: string
  model?: string
  /** context window used, 0–100 */
  context?: number
  /** a decision is held open in the hub (the agent waits) */
  ask?: Ask
  /** a reply hook is waiting: you can answer the agent from the island after it stopped */
  replyable?: boolean
  /** the window (terminal, VS Code) that runs this session, for "jump to terminal" */
  windowPid?: number
  /** that window itself (a process can have several) */
  windowHandle?: number
  /** its program (Code, Cursor, WindowsTerminal…): VS Code and Cursor can also show the exact terminal tab */
  windowProcess?: string
  /** the agent's process and its parents (one of them is the terminal tab's shell) */
  pidChain?: number[]
  /** the model runs somewhere else than the agent's own company (Claude Code or OpenCode on DeepSeek) */
  provider?: string
  /** when you looked at it (done stays until seen, then fades) */
  seenAt?: number
}

export interface HookEvent {
  session_id: string
  hook_event_name: string
  cwd?: string
  prompt?: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  message?: string
  error?: string
  last_assistant_message?: string
}

const MAX_STEPS = 40

/** Who serves a model, when the name says so (deepseek-chat, deepseek/deepseek-reasoner…). */
export function providerOf(model?: string): string | undefined {
  if (!model) return undefined
  if (/deepseek/i.test(model)) return 'DeepSeek'
  if (/^(openrouter|ollama|lmstudio|groq|mistral|xai|qwen)/i.test(model)) return model.split(/[/:]/)[0]
  return undefined
}
const MAX_DIFF_LINES = 40
export const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? ''
const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function stepKind(tool = ''): StepKind {
  if (/^(Read|NotebookRead|LS|view|read_file|read_many_files|list_directory|readFile)$/i.test(tool)) return 'read'
  if (/^(Edit|MultiEdit|Write|NotebookEdit|apply_patch|write_file|replace|edit|write|patch)$/i.test(tool)) return 'edit'
  if (/^(Bash|PowerShell|pwsh|shell|exec_command|local_shell|run_shell_command|Shell)$/i.test(tool)) return 'run'
  if (/^(Grep|Glob|search|find|grep_search|search_file_content|grep|glob|list)$/i.test(tool)) return 'search'
  if (/^(WebFetch|WebSearch|web_search|fetch|web_fetch|google_web_search|webfetch)$/i.test(tool)) return 'web'
  if (/^(Task|Agent)$/i.test(tool)) return 'task'
  return 'other'
}

export function describeTool(name = '', input: Record<string, unknown> = {}): string {
  const cmd = input.command
  if (cmd) return `${name}: ${(Array.isArray(cmd) ? cmd.join(' ') : String(cmd)).slice(0, 160)}`
  const file = input.file_path ?? input.filePath ?? input.path
  if (file) return `${name} ${basename(String(file))}`
  if (input.pattern) return `${name} "${String(input.pattern).slice(0, 60)}"`
  if (input.url) return `${name} ${input.url}`
  if (input.query) return `${name} "${String(input.query).slice(0, 60)}"`
  if (input.description) return `${name}: ${String(input.description).slice(0, 80)}`
  return name || 'Working'
}

/** The change an edit tool is about to make. findLine: where old text starts in the file (1 when unknown). */
export function diffOf(tool: string, input: Record<string, unknown>, findLine: (file: string, text: string) => number = () => 1): Diff | undefined {
  const file = str(input.file_path) || str(input.filePath) // OpenCode says filePath
  if (!file) return undefined
  const lines = (s: string) => (s ? s.replace(/\r\n/g, '\n').split('\n').slice(0, MAX_DIFF_LINES) : [])
  // a whole new file (Claude's Write, Gemini's write_file, OpenCode's write)
  if (typeof input.content === 'string' && !('old_string' in input)) return { file, line: 1, removed: [], added: lines(input.content) }
  const edit = tool === 'MultiEdit' && Array.isArray(input.edits) ? (input.edits[0] as Record<string, unknown>) : input
  if (!edit || (!('old_string' in edit) && !('new_string' in edit))) return undefined
  const before = str(edit.old_string)
  return { file, line: before ? findLine(file, before) : 1, removed: lines(before), added: lines(str(edit.new_string)) }
}

/** The questions of an AskUserQuestion call (empty when the input is not that shape). */
export function questionsOf(input: Record<string, unknown>): Question[] {
  if (!Array.isArray(input.questions)) return []
  return input.questions.flatMap((q: unknown) => {
    const o = q as Record<string, unknown>
    if (typeof o?.question !== 'string' || !Array.isArray(o.options)) return []
    const options = o.options.flatMap((x: unknown) => {
      const p = x as Record<string, unknown>
      return typeof p?.label === 'string' ? [{ label: p.label, description: typeof p.description === 'string' ? p.description : undefined }] : []
    })
    return [{ question: o.question, header: typeof o.header === 'string' ? o.header : undefined, options, multiSelect: o.multiSelect === true }]
  })
}

export function askOf(e: HookEvent): Ask {
  const input = e.tool_input ?? {}
  if (e.tool_name === 'AskUserQuestion') { const questions = questionsOf(input); if (questions.length) return { kind: 'question', input, questions } }
  if (e.tool_name === 'ExitPlanMode' && typeof input.plan === 'string') return { kind: 'plan', input, plan: input.plan }
  return { kind: 'permission', tool: e.tool_name ?? '', summary: describeTool(e.tool_name, input), input, canAlways: Array.isArray((e as { permission_suggestions?: unknown }).permission_suggestions) }
}

const addStep = (steps: Step[], step: Step) => [...steps, step].slice(-MAX_STEPS)

/**
 * Returns the new session, or null when the session ended.
 * findLine is passed to diffOf (the hub reads the file; tests pass nothing).
 */
export function apply(prev: Session | undefined, e: HookEvent, agent: Agent = 'claude', now = Date.now(), findLine?: (file: string, text: string) => number): Session | null {
  const s: Session = { id: e.session_id, agent, project: AGENT_NAMES[agent], status: 'ready', detail: '', steps: [], files: [], ...prev, at: now }
  if (e.cwd) { s.cwd = e.cwd; s.project = basename(e.cwd) || s.project }
  const input = e.tool_input ?? {}
  switch (e.hook_event_name) {
    case 'SessionStart': return { ...s, status: 'ready', detail: 'Session started' }
    case 'UserPromptSubmit': {
      const prompt = String(e.prompt ?? '')
      return { ...s, status: 'running', detail: prompt.slice(0, 140), prompt, startedAt: now, steps: [], files: [], diff: undefined, message: undefined, ask: undefined, replyable: false, seenAt: undefined }
    }
    case 'PreToolUse': {
      const kind = stepKind(e.tool_name)
      const text = describeTool(e.tool_name, input)
      const next: Session = { ...s, status: 'running', detail: text, steps: addStep(s.steps, { at: now, kind, text }), startedAt: s.startedAt ?? now }
      if (kind === 'edit') {
        next.diff = diffOf(e.tool_name ?? '', input, findLine) ?? s.diff
        const file = str(input.file_path) || str(input.filePath)
        if (file && !s.files.includes(file)) next.files = [...s.files, file]
      }
      return next
    }
    case 'PostToolUse': return { ...s, status: s.status === 'question' ? 'running' : s.status === 'ready' ? 'running' : s.status, ask: undefined }
    case 'PostToolUseFailure': {
      const steps = s.steps.slice()
      const last = steps[steps.length - 1]
      if (last) steps[steps.length - 1] = { ...last, failed: true }
      return { ...s, status: 'running', detail: `${e.tool_name} failed`, steps, ask: undefined }
    }
    case 'PermissionRequest': return { ...s, status: 'question', detail: describeTool(e.tool_name, input) }
    case 'Notification': return { ...s, detail: e.message || s.detail }
    case 'Stop': {
      const message = e.last_assistant_message?.trim() || undefined
      return { ...s, status: 'done', ask: undefined, message, detail: message ? message.split('\n')[0]!.slice(0, 140) : s.prompt ? `Done: ${s.prompt.slice(0, 100)}` : 'Done' }
    }
    case 'StopFailure': return { ...s, status: 'error', ask: undefined, detail: e.error || 'Stopped with an error' }
    case 'SessionEnd': return null
    default: return s
  }
}

/** "read 3 · edited 2 · ran 1" for this turn. */
export function summary(steps: Step[]): string {
  const n = (k: StepKind) => steps.filter(x => x.kind === k).length
  return ([['read', n('read')], ['edited', n('edit')], ['ran', n('run')], ['searched', n('search')]] as const)
    .filter(([, c]) => c > 0).map(([w, c]) => `${w} ${c}`).join(' · ')
}

/** Tools that run commands or change files: their Allow is not the highlighted, easy answer. */
export const risky = (tool: string) => /^(Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit|shell|run_shell_command|write_file|replace)$/i.test(tool)
/** An answer is highlighted only when the agent itself recommends it (the default effect steers choices). */
export const recommended = (label: string) => /\(recommended\)/i.test(label)
