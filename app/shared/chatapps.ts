import type { Session } from './state'

// Chat apps (claude.ai, ChatGPT, Gemini, DeepSeek in the browser; the Claude and ChatGPT desktop apps): what one shows,
// turned into an island session. Pure, so it is testable.

export interface ChatUpdate {
  /** "claude.ai", "ChatGPT", "Claude (desktop)"… */
  app: string
  /** the chat's title (the tab or window title) */
  title: string
  streaming: boolean
  /** the last answer, as text */
  answer: string
}

/** The answer ends by asking you something: its last line is a short question (a long paragraph ending in "?" is not). */
export function asksYou(answer: string): boolean {
  const last = answer.trim().split('\n').map(l => l.trim()).filter(Boolean).at(-1) ?? ''
  return last.endsWith('?') && last.length <= 200
}

/** The next session state, and whether an answer just finished. */
export function applyChat(prev: Session | undefined, id: string, u: ChatUpdate, now: number): { session: Session; finished: boolean } {
  const s: Session = { id, agent: 'web', project: u.app, status: 'ready', detail: u.title, steps: [], files: [], replyable: true, ...prev, at: now }
  if (u.streaming) {
    if (s.status !== 'running') Object.assign(s, { status: 'running', startedAt: now, message: undefined, seenAt: undefined })
    s.detail = u.answer.trim().split('\n').at(-1)?.slice(0, 140) || 'Answering…'
    return { session: s, finished: false }
  }
  const finished = prev?.status === 'running'
  if (finished || (!prev && u.answer)) {
    Object.assign(s, { status: 'done', message: u.answer.trim(), detail: u.answer.trim().split('\n')[0]?.slice(0, 140) || u.title })
  }
  s.project = u.app
  return { session: s, finished }
}

/** UI Automation items of a desktop chat app → what it shows (beta: their layout can change with any update). */
export function readChat(items: { t: string; n: string }[]): { streaming: boolean; answer: string } {
  const input = items.findLastIndex(i => i.t === 'input')
  const body = input > 0 ? items.slice(0, input) : items
  const streaming = items.some(i => i.t === 'button' && /^stop\b/i.test(i.n))
  // each answer ends with its action buttons (Copy, Retry…): the texts just before the last "Copy" are the last answer
  const copy = body.findLastIndex(i => i.t === 'button' && /^copy\b/i.test(i.n))
  const end = streaming || copy < 0 ? body.length : copy
  const texts: string[] = []
  for (let i = end - 1; i >= 0 && texts.length < 60; i--) {
    const it = body[i]!
    if (it.t === 'button' && /^(copy|edit|retry)\b/i.test(it.n)) break // the message before
    if (it.t === 'text') texts.unshift(it.n.trim())
  }
  return { streaming, answer: texts.filter(Boolean).join('\n').slice(-4000) }
}
