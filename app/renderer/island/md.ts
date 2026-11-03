// A small Markdown renderer for plans: headings, (nested) lists, code blocks, inline code, bold and italics.
// Everything is HTML-escaped first, so agent text can never inject markup.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inline = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')

export function markdown(text: string): string {
  const out: string[] = []
  const lists: { kind: 'ul' | 'ol'; indent: number }[] = [] // open lists, innermost last
  let code: string[] | null = null
  const close = (toIndent = -1) => {
    while (lists.length && lists[lists.length - 1]!.indent > toIndent) out.push(`</li></${lists.pop()!.kind}>`)
  }

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.trimStart().startsWith('```')) {
      if (code) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null }
      else { close(); code = [] }
      continue
    }
    if (code) { code.push(line); continue }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    const item = /^(\s*)([-*]|\d+[.)])\s+(.*)$/.exec(line)
    if (h) { close(); const n = Math.min(h[1]!.length + 2, 6); out.push(`<h${n}>${inline(h[2]!)}</h${n}>`) }
    else if (item) {
      const indent = item[1]!.length, kind = /\d/.test(item[2]!) ? 'ol' : 'ul'
      close(indent)
      const top = lists[lists.length - 1]
      if (top && top.indent === indent && top.kind === kind) out.push('</li>')
      else {
        if (top && top.indent === indent) out.push(`</li></${lists.pop()!.kind}>`) // same level, other kind
        out.push(`<${kind}>`)
        lists.push({ kind, indent })
      }
      out.push(`<li>${inline(item[3]!)}`)
    } else if (!line.trim()) close()
    else { close(); out.push(`<p>${inline(line)}</p>`) }
  }
  if (code) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
  close()
  return out.join('')
}
