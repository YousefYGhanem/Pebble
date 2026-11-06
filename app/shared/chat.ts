// Pip's chat: which AI answers, and what the island shows of the conversation.

export const PROVIDERS = [
  { id: 'claude-cli', name: 'Claude Code (your plan)', key: false, model: '' },
  { id: 'codex-cli', name: 'Codex (your ChatGPT login)', key: false, model: '' },
  { id: 'anthropic', name: 'Anthropic API', key: true, model: 'claude-opus-5-5' },
  { id: 'openai', name: 'OpenAI API', key: true, model: 'gpt-5-mini' },
  { id: 'gemini', name: 'Gemini API', key: true, model: 'gemini-2.5-flash' },
  { id: 'deepseek', name: 'DeepSeek API', key: true, model: 'deepseek-chat' }
] as const

export type ProviderId = (typeof PROVIDERS)[number]['id']
export const PROVIDER_IDS = PROVIDERS.map(p => p.id) as [ProviderId, ...ProviderId[]]

/** A window you showed Pip (screen buddy): image is a file name in the chat folder, text what OCR read on it. */
export interface Look { title: string; process: string; image: string; text: string }

export interface ChatMessage { role: 'user' | 'assistant'; text: string; at: number; look?: Look }

/** Fix in Word: the document, the fixes proposed, and how it went */
export interface WordFixes {
  doc: string
  fixes: { find: string; replace: string; why: string }[]
  busy: boolean
  /** after applying: "5 fixes put in as tracked changes" */
  done?: string
  error?: string
}

export interface ChatState {
  provider: string
  /** false while an API provider has no key yet */
  ready: boolean
  messages: ChatMessage[]
  /** the window that goes with your next message */
  look?: { title: string; process: string }
  /** open windows to pick from (Look) */
  windows?: { hwnd: number; title: string; process: string }[]
  busy: boolean
  error?: string
  /** the Claude Code or Codex command is not signed in: the island offers to open its sign-in */
  signIn?: boolean
  word?: WordFixes
}
