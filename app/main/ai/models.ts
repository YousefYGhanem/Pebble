import Anthropic from '@anthropic-ai/sdk'
import type { ProviderId } from '../../shared/chat'

/** A model you can pick in Settings: its id, and a name to show. */
export interface ModelChoice { id: string; name: string }

// The CLIs take these names themselves and keep them pointed at the newest model of each kind.
const CLAUDE_CLI: ModelChoice[] = [
  { id: 'opus', name: 'Opus (newest)' }, { id: 'sonnet', name: 'Sonnet (newest)' }, { id: 'haiku', name: 'Haiku (newest)' }
]

const json = async (url: string, headers: Record<string, string> = {}) => {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'the key was refused' : `${res.status} ${res.statusText}`)
  return res.json() as Promise<Record<string, any>>
}

/** Chat models from the provider's own list, newest first where the provider says. API providers need their key. */
export async function listModels(provider: ProviderId, key?: string): Promise<ModelChoice[]> {
  switch (provider) {
    case 'claude-cli': return CLAUDE_CLI
    case 'codex-cli': return [] // Codex picks the model that goes with your ChatGPT plan
    case 'anthropic': {
      const out: ModelChoice[] = []
      for await (const m of new Anthropic({ apiKey: key }).models.list()) out.push({ id: m.id, name: m.display_name })
      return out
    }
    case 'openai': {
      const r = await json('https://api.openai.com/v1/models', { authorization: `Bearer ${key}` })
      // chat models only (not embeddings, speech, images, moderation…)
      return (r.data as { id: string; created: number }[])
        .filter(m => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !/(audio|realtime|transcribe|tts|image|search|embedding|instruct)/.test(m.id))
        .sort((a, b) => b.created - a.created).map(m => ({ id: m.id, name: m.id }))
    }
    case 'deepseek': {
      const r = await json('https://api.deepseek.com/models', { authorization: `Bearer ${key}` })
      return (r.data as { id: string }[]).map(m => ({ id: m.id, name: m.id }))
    }
    case 'gemini': {
      const r = await json('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': key ?? '' })
      return (r.models as { name: string; displayName: string; supportedGenerationMethods?: string[] }[])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent') && /gemini/.test(m.name))
        .map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName }))
        .reverse() // the API lists older models first
    }
  }
}
