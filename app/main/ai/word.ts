import { spawn } from 'node:child_process'

// "Fix in Word": the open Word document is read, the AI proposes fixes, you pick, and the ones you picked go in as
// tracked changes (Review → Track Changes), so you accept or reject each in Word. Word's own automation does the work,
// through Windows PowerShell (always there on Windows); the data goes through an environment variable, never the script.

export interface Fix { find: string; replace: string; why: string }

const ENCODING = '[Console]::OutputEncoding = [Text.Encoding]::UTF8\n'
const WORD = "$w = try { [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application') } catch { $null }\n" +
  "if (-not $w -or $w.Documents.Count -eq 0) { Write-Output '{\"error\":\"Open the document in Word first.\"}'; exit }\n" +
  '$doc = $w.ActiveDocument\n'

function ps(script: string, data?: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PEBBLE_DATA: data === undefined ? '' : Buffer.from(JSON.stringify(data)).toString('base64') }
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'], { env, windowsHide: true })
    let out = '', err = ''
    p.stdout.setEncoding('utf8').on('data', (c: string) => { out += c })
    p.stderr.setEncoding('utf8').on('data', (c: string) => { err += c })
    p.on('error', reject)
    p.on('close', () => {
      try {
        const r = JSON.parse(out.trim().split('\n').at(-1) ?? '')
        r.error ? reject(new Error(r.error)) : resolve(r)
      } catch { reject(new Error(err.trim().split('\n')[0] || 'Word did not answer')) }
    })
    p.stdin.end(ENCODING + script)
  })
}

/** The open document's name and text (at most 30 000 characters). */
export async function readWord(): Promise<{ name: string; text: string }> {
  const r = await ps(WORD + '$t = $doc.Content.Text; if ($t.Length -gt 30000) { $t = $t.Substring(0, 30000) }\n' +
    '@{ name = $doc.Name; text = $t } | ConvertTo-Json -Compress')
  return { name: String(r.name ?? ''), text: String(r.text ?? '').replace(/\r/g, '\n') }
}

export const FIX_PROMPT = 'You proofread documents. Find spelling, grammar and clarity problems in the text the user gives you. ' +
  'Answer with JSON only, no other text: [{"find": "exact text from the document", "replace": "the corrected text", "why": "a few words"}]. ' +
  '"find" must be copied exactly from the document, within one paragraph, short (a few words, at most 200 characters) and unique enough to locate. ' +
  'At most 25 fixes. Keep the author\'s meaning and voice. Answer [] when nothing needs fixing.'

/** The fixes in an AI answer that can really be made: valid, found in the text, actually changing something. */
export function parseFixes(answer: string, text: string): Fix[] {
  const json = answer.slice(answer.indexOf('['), answer.lastIndexOf(']') + 1)
  let list: unknown
  try { list = JSON.parse(json) } catch { return [] }
  if (!Array.isArray(list)) return []
  return list.filter((f): f is Fix => !!f && typeof f.find === 'string' && typeof f.replace === 'string' && typeof f.why === 'string'
    && f.find.length > 0 && f.find.length <= 250 && !/[\r\n]/.test(f.find + f.replace) && f.replace.length <= 250 && f.find !== f.replace && text.includes(f.find)).slice(0, 25)
}

/** Puts the fixes in as tracked changes (the document's own Track Changes setting is restored after). */
export async function applyWord(fixes: Fix[]): Promise<{ applied: number; missed: number }> {
  // ^ is Word's escape character in Find (^p = paragraph mark): double it
  const data = fixes.map(f => ({ find: f.find.replaceAll('^', '^^'), replace: f.replace.replaceAll('^', '^^') }))
  const r = await ps(WORD +
    '$fixes = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:PEBBLE_DATA)) | ConvertFrom-Json\n' +
    '$was = $doc.TrackRevisions; $doc.TrackRevisions = $true; $applied = 0; $missed = 0\n' +
    'try {\n' +
    '  foreach ($f in $fixes) {\n' +
    '    $find = $doc.Content.Find; $find.ClearFormatting(); $find.Replacement.ClearFormatting()\n' +
    // Execute(FindText, MatchCase, MatchWholeWord, MatchWildcards, MatchSoundsLike, MatchAllWordForms, Forward, Wrap=wdFindStop, Format, ReplaceWith, Replace=wdReplaceOne)
    '    if ($find.Execute($f.find, $true, $false, $false, $false, $false, $true, 0, $false, $f.replace, 1)) { $applied++ } else { $missed++ }\n' +
    '  }\n' +
    '} finally { $doc.TrackRevisions = $was }\n' +
    '@{ applied = $applied; missed = $missed } | ConvertTo-Json -Compress', data)
  return { applied: Number(r.applied ?? 0), missed: Number(r.missed ?? 0) }
}
