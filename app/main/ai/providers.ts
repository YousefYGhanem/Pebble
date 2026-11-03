import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ProviderId } from '../../shared/chat'

export interface Ask {
  provider: ProviderId
  model: string
  key?: string
  system: string
  messages: ChatMessage[]
  /** an empty folder the CLIs run in (they get no project to look at) */
  sandbox: string
  signal: AbortSignal
  onText(delta: string): void
}

/** A message as text: a window you showed comes first, with what OCR read on it (models that cannot see images get only this). */
export function textOf(m: ChatMessage, note = ''): string {
  if (!m.look) return m.text
  const seen = `[I am showing you a window: "${m.look.title}" (${m.look.process}).${note}` + (m.look.text ? ` Its text, read by OCR:\n${m.look.text.slice(0, 6000)}` : '') + ']'
  return `${seen}\n\n${m.text}`
}

const png = (a: Ask, m: ChatMessage) => fs.readFileSync(path.join(a.sandbox, m.look!.image)).toString('base64')

/** Streams one answer; resolves when it is complete. */
export function ask(a: Ask): Promise<void> {
  switch (a.provider) {
    case 'anthropic': return anthropic(a)
    case 'openai': return openaiCompatible(a, 'https://api.openai.com/v1', true)
    case 'deepseek': return openaiCompatible(a, 'https://api.deepseek.com', false) // text only: it gets the OCR text
    case 'gemini': return gemini(a)
    case 'claude-cli': return claudeCli(a)
    case 'codex-cli': return codexCli(a)
  }
}

async function anthropic(a: Ask) {
  const client = new Anthropic({ apiKey: a.key })
  const stream = client.messages.stream({
    model: a.model, max_tokens: 64000, system: a.system,
    output_config: { effort: 'low' }, // chat: quick answers
    messages: a.messages.map(m => ({
      role: m.role,
      content: m.look ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: png(a, m) } }, { type: 'text' as const, text: textOf(m) }] : m.text
    }))
  }, { signal: a.signal })
  for await (const e of stream) if (e.type === 'content_block_delta' && e.delta.type === 'text_delta') a.onText(e.delta.text)
  const done = await stream.finalMessage()
  if (done.stop_reason === 'refusal') throw new Error('Claude declined to answer this one.')
}

/** Server-sent events: calls on() with each `data:` payload. */
async function sse(res: Response, on: (data: string) => void) {
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`)
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    const lines = buf.split('\n')
    buf = lines.pop()!
    for (const l of lines) if (l.startsWith('data:')) { const d = l.slice(5).trim(); if (d && d !== '[DONE]') on(d) }
  }
}

async function openaiCompatible(a: Ask, base: string, vision: boolean) {
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST', signal: a.signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${a.key}` },
    body: JSON.stringify({ model: a.model, stream: true, messages: [{ role: 'system', content: a.system }, ...a.messages.map(m => ({
      role: m.role,
      content: m.look && vision ? [{ type: 'text', text: textOf(m) }, { type: 'image_url', image_url: { url: `data:image/png;base64,${png(a, m)}` } }] : textOf(m)
    }))] })
  })
  await sse(res, d => { const t = JSON.parse(d).choices?.[0]?.delta?.content; if (t) a.onText(t) })
}

async function gemini(a: Ask) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(a.model)}:streamGenerateContent?alt=sse`, {
    method: 'POST', signal: a.signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': a.key ?? '' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: a.system }] },
      contents: a.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: m.look ? [{ inlineData: { mimeType: 'image/png', data: png(a, m) } }, { text: textOf(m) }] : [{ text: m.text }] }))
    })
  })
  await sse(res, d => { for (const p of JSON.parse(d).candidates?.[0]?.content?.parts ?? []) if (p.text) a.onText(p.text) })
}

/** The CLIs take one prompt: the conversation so far, written out. */
export function transcript(a: Pick<Ask, 'system' | 'messages'>, note = ''): string {
  const turns = a.messages.map(m => `${m.role === 'user' ? 'User' : 'You'}: ${textOf(m, m.look && note ? note.replace('{file}', m.look.image) : '')}`).join('\n\n')
  return `${a.system}\n\n${turns}\n\nYou:`
}

/** Runs a CLI with the prompt on stdin, handing each stdout line to onLine. */
function run(a: Ask, cmd: string, args: string[], onLine: (l: string) => void, note = ''): Promise<void> {
  return new Promise((resolve, reject) => {
    // shell: the CLIs are .cmd shims on Windows; the arguments are fixed, the prompt goes through stdin
    const p = spawn(cmd, args, { cwd: a.sandbox, shell: true, windowsHide: true, env: { ...process.env, PEBBLE_CHAT: '1' } })
    let buf = '', err = ''
    p.stdout.setEncoding('utf8').on('data', (c: string) => { buf += c; const ls = buf.split('\n'); buf = ls.pop()!; ls.forEach(l => l.trim() && onLine(l)) })
    p.stderr.setEncoding('utf8').on('data', (c: string) => { err = (err + c).slice(-2000) })
    p.on('error', reject)
    p.on('close', code => { if (buf.trim()) onLine(buf); code === 0 || a.signal.aborted ? resolve() : reject(new Error(err.trim().split('\n').pop() || `${cmd} stopped (${code})`)) })
    a.signal.addEventListener('abort', () => p.kill())
    p.stdin.end(transcript(a, note))
  })
}

async function claudeCli(a: Ask) {
  // its own settings: Pebble's hooks stay off, or this chat would show up as an agent session
  const settings = path.join(a.sandbox, 'pebble-chat-settings.json')
  fs.writeFileSync(settings, JSON.stringify({ disableAllHooks: true }))
  let streamed = false, failed = ''
  await run(a, 'claude', ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--settings', `"${settings}"`,
    ...(a.model ? ['--model', a.model] : [])], l => {
    let e: Record<string, any>
    try { e = JSON.parse(l) } catch { return }
    if (e.type === 'stream_event' && e.event?.type === 'content_block_delta' && e.event.delta?.type === 'text_delta') { streamed = true; a.onText(e.event.delta.text) }
    else if (e.type === 'result' && e.is_error) failed = `Claude Code: ${e.result ?? 'failed'}` // e.g. "Not logged in · Please run /login"
    else if (e.type === 'result' && !streamed && typeof e.result === 'string') a.onText(e.result)
  }, ' A screenshot of it is the file {file} in the current folder: look at it.').catch(err => { throw failed ? new Error(failed) : err })
  if (failed) throw new Error(failed)
}

function codexCli(a: Ask) {
  // codex exec prints whole messages, not pieces: the answer arrives at once
  const look = a.messages.at(-1)?.look // the newest window goes along as a picture
  return run(a, 'codex', ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', '-c', 'notify=[]', ...(a.model ? ['-m', a.model] : []),
    ...(look ? ['--image', look.image] : []), '-'], l => {
    let e: Record<string, any>
    try { e = JSON.parse(l) } catch { return }
    const item = e.item ?? e.msg
    if (e.type === 'item.completed' && item?.type === 'agent_message' && typeof item.text === 'string') a.onText(item.text)
  }, ' A screenshot of it is attached.')
}
