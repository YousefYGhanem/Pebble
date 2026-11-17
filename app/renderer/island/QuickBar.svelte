<script lang="ts">
  // The quick bar (its shortcut, Ctrl+Alt+K by default): type a sum, a conversion, a time somewhere, a colour,
  // "tr …" to translate, or a clipboard tool's name (json, upper, base64…) to work on what you copied.
  // The answer shows as you type; Enter copies it, Esc closes.
  import { answer, digest } from '../../shared/quick'
  import type { Action, ExtrasState } from '../../shared/extras'
  import { locale, t } from '../i18n.svelte'
  import Icon from './Icon.svelte'

  let { extras, act }: { extras: ExtrasState; act: (a: Action) => void } = $props()

  let q = $state(''), input = $state<HTMLInputElement>(), copied = $state(false)
  const EXAMPLES = ['15% of 80', '5 km in miles', '100 usd in eur', 'time in tokyo', 'tr fr good morning', 'json', '#53e4ff', 'pick']

  // what the clipboard tools work on: the clipboard as the bar opens
  $effect(() => { act({ do: 'quick.clip' }) })

  const a = $derived(answer(q, { rates: extras.rates, now: Date.now(), locale: locale(), clip: extras.clipText }))

  // a currency question: the day's rates, fetched once
  $effect(() => { if (a?.kind === 'rates') act({ do: 'quick.rates' }) })

  // translating asks Pip's chat provider: only once you stop typing for a moment
  const key = $derived(a?.kind === 'translate' ? `${a.to}|${a.text}` : '')
  $effect(() => {
    if (a?.kind !== 'translate') return
    const { text, to } = a
    const id = setTimeout(() => act({ do: 'quick.translate', text, to }), 500)
    return () => clearTimeout(id)
  })
  const tr = $derived(key && extras.translated?.key === key ? extras.translated : null)

  // a hash of what you copied (Web Crypto answers a moment later)
  let hashed = $state<{ of: string; hex: string } | null>(null)
  $effect(() => {
    if (a?.kind !== 'hash') return
    const of = `${a.algo}|${a.text}`
    void digest(a.algo, a.text).then(hex => (hashed = { of, hex }))
  })
  const hashText = $derived(a?.kind === 'hash' && hashed?.of === `${a.algo}|${a.text}` ? hashed.hex : '')

  // the colour picker: a short countdown to point at the colour, then main reads the pixel under the mouse
  let count = $state(0), pickedAfter = 0
  function pick() {
    if (count) return
    count = 3
    const id = setInterval(() => {
      if (--count > 0) return
      clearInterval(id)
      pickedAfter = Date.now()
      act({ do: 'quick.pick' })
    }, 700)
  }
  $effect(() => { const p = extras.picked; if (p && pickedAfter && p.at >= pickedAfter) { pickedAfter = 0; q = p.hex } })

  const result = $derived(a && 'sub' in a ? a.text : a?.kind === 'hash' ? hashText : tr?.text ?? '')
  const sub = $derived(a && 'sub' in a ? a.sub : a?.kind === 'translate' ? t('i.quick.into', { lang: a.to.toUpperCase() }) : a?.kind === 'hash' ? a.algo : '')
  const swatch = $derived(a?.kind === 'color' ? a.color : '')

  function copy() {
    if (!result) return
    act({ do: 'quick.copy', text: result })
    copied = true
    setTimeout(() => (copied = false), 1400)
  }
  function onkey(e: KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (a?.kind === 'pick') pick(); else copy()
  }
  $effect(() => { const id = setTimeout(() => input?.focus(), 60); return () => clearTimeout(id) })
</script>

<div class="quick">
  <label class="box">
    <Icon name="search" size={16} />
    <input bind:this={input} bind:value={q} onkeydown={onkey} placeholder={t('i.quick.placeholder')} aria-label={t('i.quick.placeholder')}
      spellcheck="false" autocomplete="off" />
    {#if result}<span class="hint">{copied ? t('i.quick.copied') : t('i.quick.enter')}</span>{/if}
  </label>

  <div class="out" aria-live="polite">
    {#if count}
      <p class="muted">{t('i.quick.pickIn', { n: count })}</p>
    {:else if a?.kind === 'pick'}
      <button class="answer" onclick={pick}><b class="small"><Icon name="eye" size={16} /> {t('i.quick.pick')}</b></button>
    {:else if a?.kind === 'clip'}
      <p class="muted">{t('i.quick.clip')}</p>
    {:else if a?.kind === 'translate' && !tr?.text}
      <p class="muted">{tr?.error ?? t('i.quick.translating')}</p>
    {:else if a?.kind === 'hash' && !hashText}
      <p class="muted">{t('i.quick.hashing')}</p>
    {:else if result}
      <button class="answer" class:copied onclick={copy}>
        <span class="line">{#if swatch}<i class="swatch" style:background={swatch}></i>{/if}<b dir="auto" class:long={result.length > 60}>{result}</b></span>
        {#if sub}<small dir="auto">{sub}</small>{/if}
      </button>
    {:else if a?.kind === 'tool'}
      <p class="muted">{a.sub}</p>
    {:else if a?.kind === 'rates'}
      <p class="muted">{t('i.quick.rates')}</p>
    {:else}
      <div class="examples">
        {#each EXAMPLES as ex}<button class="ghost" onclick={() => { q = ex; input?.focus() }} dir="ltr">{ex}</button>{/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .quick { display: flex; flex-direction: column; gap: 10px; padding: 14px 18px 16px; }
  /* Pip sits in the top right corner of the open island, in Arabic too: the box leaves him room */
  .box { margin-right: 60px; display: flex; align-items: center; gap: 10px; padding: 0 14px; height: 44px; border-radius: var(--r-l, 14px); background: var(--surface1); border: 1px solid var(--stroke); color: var(--muted); }
  .box:focus-within { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
  input { flex: 1; min-width: 0; font: inherit; font-size: 1.05em; color: var(--text); background: none; border: 0; outline: 0; }
  .hint { font-size: 0.78em; color: var(--muted); white-space: nowrap; }
  .out { min-height: 46px; }
  .answer { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; text-align: start; padding: 8px 14px; border-radius: var(--r-l, 14px); background: none; }
  .answer:hover { background: var(--surface1); }
  .line { display: flex; align-items: center; gap: 10px; min-width: 0; max-width: 100%; }
  .answer b { font-size: 1.6em; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  /* a formatted JSON or a long hash: smaller, kept to a few lines */
  .answer b.long { font-size: 0.95em; font-weight: 500; font-family: ui-monospace, Consolas, monospace; white-space: pre-wrap; max-height: 9.5em; overflow: auto; }
  .answer b.small { font-size: 1em; display: inline-flex; align-items: center; gap: 8px; }
  .answer small { color: var(--muted); }
  .answer.copied b { color: var(--accent-text); }
  .swatch { flex: none; width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--stroke); }
  .examples { display: flex; flex-wrap: wrap; gap: 6px; }
  .examples button { border: 1px solid var(--stroke); font-size: 0.85em; }
  .muted { color: var(--muted); padding: 10px 14px; margin: 0; }
</style>
