import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { logger } from './log'

const log = logger('voices')

// Natural voices for reading Pip's messages aloud: Piper (offline neural speech, MIT), one voice per language,
// downloaded the first time a message in that language is read (about 60 MB each) and kept in userData/voices.
// Nothing is sent anywhere to speak: the voice runs on this PC.

const HUB = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/'
/** The voice for a language where there is a choice: clear licences first (public domain, CC0, CC BY). */
const PICK: Record<string, string> = {
  en: 'en_US-kristin-medium', ar: 'ar_JO-kareem-medium', fr: 'fr_FR-siwis-medium', es: 'es_ES-davefx-medium', de: 'de_DE-thorsten-medium',
  it: 'it_IT-paola-medium', pt: 'pt_BR-faber-medium', nl: 'nl_NL-mls-medium', ru: 'ru_RU-irina-medium', zh: 'zh_CN-huayan-medium'
}
/** A voice's settings for the 2023 engine: newer voices list a few two-letter phonemes ("aɪ") that it refuses to load;
 *  it reads phonemes one letter at a time, so it never asks for those and they can go. */
export function forThisEngine(json: Buffer): Buffer {
  const config = JSON.parse(json.toString('utf8')) as { phoneme_id_map?: Record<string, number[]> }
  if (!config.phoneme_id_map) return json
  for (const key of Object.keys(config.phoneme_id_map)) if ([...key].length !== 1) delete config.phoneme_id_map[key]
  return Buffer.from(JSON.stringify(config))
}

type Catalog =Record<string, { language: { family: string }; quality: string; files: Record<string, { size_bytes: number; md5_digest: string }> }>

export class Voices {
  private catalog?: Catalog
  private getting = new Map<string, Promise<string>>()

  constructor(private dir: string, private engine: string) {}

  /** The engine is there (it ships with Pebble; a build from source gets it with npm run app). */
  get available() { return fs.existsSync(path.join(this.engine, 'piper.exe')) }

  /** That language's voice is already on this PC. */
  has(lang: string) { const v = this.pickSync(lang); return !!v && fs.existsSync(path.join(this.dir, `${v}.onnx`)) }

  /** Reads text in that language into a WAV file; false when there is no voice for the language. */
  async speak(text: string, lang: string, out: string): Promise<boolean> {
    const voice = await this.voice(lang)
    if (!voice) return false
    const model = await this.download(voice)
    await new Promise<void>((resolve, reject) => {
      const p = spawn(path.join(this.engine, 'piper.exe'), ['--model', model, '--output_file', out], { cwd: this.engine, windowsHide: true })
      let err = ''
      p.stderr.on('data', d => { err = (err + d).slice(-500) })
      p.on('error', reject)
      p.on('close', code => (code === 0 ? resolve() : reject(new Error(`piper ${code}: ${err.trim()}`))))
      p.stdin.end(text.replace(/\s+/g, ' ').trim())
    })
    return true
  }

  private pickSync(lang: string): string | undefined {
    if (PICK[lang] && (!this.catalog || this.catalog[PICK[lang]])) return PICK[lang]
    if (!this.catalog) return undefined
    const all = Object.entries(this.catalog).filter(([, v]) => v.language.family === lang)
    return (all.find(([, v]) => v.quality === 'medium') ?? all.find(([, v]) => v.quality === 'high') ?? all[0])?.[0]
  }

  private async voice(lang: string) {
    await this.loadCatalog()
    return this.pickSync(lang)
  }

  /** The list of voices (once; kept, and fetched again after a month). */
  private async loadCatalog() {
    if (this.catalog) return
    const file = path.join(this.dir, 'voices.json')
    try {
      if (Date.now() - fs.statSync(file).mtimeMs < 30 * 86_400_000) { this.catalog = JSON.parse(fs.readFileSync(file, 'utf8')); return }
    } catch { /* not yet */ }
    const res = await fetch(HUB + 'voices.json', { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`voices list: ${res.status}`)
    const text = await res.text()
    this.catalog = JSON.parse(text) as Catalog
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(file, text)
  }

  /** The voice's model and its settings, each checked against the list's MD5; the model's path. */
  private download(voice: string): Promise<string> {
    const model = path.join(this.dir, `${voice}.onnx`)
    if (fs.existsSync(model) && fs.existsSync(`${model}.json`)) return Promise.resolve(model)
    const busy = this.getting.get(voice)
    if (busy) return busy
    const job = (async () => {
      const files = Object.entries(this.catalog![voice]!.files).filter(([f]) => f.endsWith('.onnx') || f.endsWith('.onnx.json'))
      fs.mkdirSync(this.dir, { recursive: true })
      for (const [remote, meta] of files) {
        const res = await fetch(HUB + remote, { signal: AbortSignal.timeout(10 * 60_000) })
        if (!res.ok) throw new Error(`${voice}: ${res.status}`)
        const data = Buffer.from(await res.arrayBuffer())
        if (createHash('md5').update(data).digest('hex') !== meta.md5_digest) throw new Error(`${voice}: the download does not match`)
        const local = path.join(this.dir, path.basename(remote))
        fs.writeFileSync(`${local}.part`, remote.endsWith('.json') ? forThisEngine(data) : data)
        fs.renameSync(`${local}.part`, local)
      }
      log.info(`voice ${voice} ready`)
      return model
    })().finally(() => this.getting.delete(voice))
    this.getting.set(voice, job)
    return job
  }
}
