<script lang="ts">
  // Instant answers on Pip's page, above the message box, as you type: a sum, a conversion, the time somewhere,
  // a colour, a translation, a timer, a clipboard tool. Enter takes the answer (copies it, starts the timer, picks
  // the colour); with no answer here, Enter (and Tab, always) sends your words to Pip. See shared/quick.ts.
  import { answer, digest } from '../../shared/quick'
  import type { Action, ExtrasState } from '../../shared/extras'
  import type { Settings } from '../../shared/settings'
  import { locale, t } from '../i18n.svelte'
  import Icon from './Icon.svelte'

  let { q, extras, act, pip, provider, quick, onsend, onset }: {
    q: string; extras: ExtrasState; act: (a: Action) => void; pip: string; provider: string; quick: Settings['quick']
    /** words to send to Pip (explain, summarize, ask) */ onsend: (text: string) => void
    /** change what is typed (an example, a picked colour) */ onset: (text: string) => void
  } = $props()

  let copied = $state(false)

  const a = $derived(answer(q, { rates: extras.rates, now: Date.now(), locale: locale(), clip: extras.clipText, translateTo: quick.translateTo, tools: quick.tools, copyToAi: quick.copyToAi }))
  /** something to show here (a question for Pip shows nothing: Enter sends it) */
  export const shown = () => !!a && !(a.kind === 'ai' && a.how === 'ask')

  // the clipboard, as the page opens and whenever a clipboard tool is typed
  $effect(() => { act({ do: 'quick.clip' }) })
  $effect(() => { if (a?.kind === 'clip' || a?.kind === 'tool' || a?.kind === 'hash' || (a?.kind === 'ai' && a.how !== 'ask')) act({ do: 'quick.clip' }) })

  // a currency question: the day's rates, fetched once
  $effect(() => { if (a?.kind === 'rates') act({ do: 'quick.rates' }) })

  // a translation asks Pip's chat provider once you stop typing for a moment
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
  $effect(() => { const p = extras.picked; if (p && pickedAfter && p.at >= pickedAfter) { pickedAfter = 0; onset(p.hex) } })

  // the timers' time left, while they are listed
  let now = $state(Date.now())
  $effect(() => { if (a?.kind !== 'timers') return; now = Date.now(); const id = setInterval(() => (now = Date.now()), 1000); return () => clearInterval(id) })
  const clock = (s: number) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(x).padStart(2, '0')}` }

  const result = $derived(a && 'sub' in a ? a.text : a?.kind === 'hash' ? hashText : tr?.text ?? '')
  const sub = $derived(a && 'sub' in a ? a.sub : a?.kind === 'translate' ? t('i.quick.into', { lang: a.to.toUpperCase() }) : a?.kind === 'hash' ? a.algo : '')
  const swatch = $derived(a?.kind === 'color' ? a.color : '')

  function copy() {
    if (!result) return
    act({ do: 'quick.copy', text: result })
    copied = true
    setTimeout(() => (copied = false), 1400)
  }
  /** Enter on the message box: true when it was for this answer (else the words go to Pip). */
  export function enter(): boolean {
    if (!a) return false
    if (a.kind === 'pick') { pick(); return true }
    if (a.kind === 'timer') { act({ do: 'timer.start', seconds: a.seconds, name: a.name }); onset('timers'); return true }
    if (a.kind === 'ai') {
      if (a.how === 'ask') { onsend(a.text); return true }
      // explain and summarize: what you copied goes into the conversation, so you can ask more about it
      onsend(`${t(a.how === 'explain' ? 'i.quick.explainMsg' : 'i.quick.summarizeMsg')}\n\n${extras.clipText.slice(0, 6000)}`)
      return true
    }
    if (result) { copy(); return true }
    return a.kind !== 'rates' && a.kind !== 'translate' && a.kind !== 'hash' ? false : true // still working it out: wait
  }
</script>

{#if shown()}
  <div class="instant" aria-live="polite">
    {#if count}
      <p class="muted">{t('i.quick.pickIn', { n: count })}</p>
    {:else if a?.kind === 'pick'}
      <button class="answer" onclick={pick}><b class="small"><Icon name="eye" size={16} /> {t('i.quick.pick')}</b></button>
    {:else if a?.kind === 'clip'}
      <p class="muted">{t('i.quick.clip')}</p>
    {:else if a?.kind === 'translate' && !tr?.text}
      <p class="muted">{tr?.error ?? t('i.quick.translating')}</p>
    {:else if a?.kind === 'ai'}
      <p class="muted">{t(`i.quick.${a.how}`, { pip, provider, n: extras.clipText.length })}</p>
    {:else if a?.kind === 'hash' && !hashText}
      <p class="muted">{t('i.quick.hashing')}</p>
    {:else if a?.kind === 'timer'}
      <p class="muted">{t('i.quick.timer', { name: a.name || t('i.timer.name'), time: clock(a.seconds) })}</p>
    {:else if a?.kind === 'timers'}
      <div class="timers">
        {#each extras.timers as tm (tm.id)}
          <div class="tm"><Icon name="focus" size={14} /><span class="tname">{tm.name || t('i.timer.name')}</span><b>{clock((tm.endsAt - now) / 1000)}</b>
            <button class="ghost" onclick={() => act({ do: 'timer.stop', id: tm.id })}>{t('i.quick.stop')}</button></div>
        {:else}
          <p class="muted">{t('i.quick.noTimers')}</p>
        {/each}
      </div>
    {:else if result}
      <button class="answer" class:copied onclick={copy}>
        <span class="line">{#if swatch}<i class="swatch" style:background={swatch}></i>{/if}<b dir="auto" class:long={result.length > 60}>{result}</b>
          <span class="hint">{copied ? t('i.quick.copied') : t('i.quick.enter')}</span></span>
        {#if sub}<small dir="auto">{sub}</small>{/if}
      </button>
    {:else if a?.kind === 'tool'}
      <p class="muted">{a.sub}</p>
    {:else if a?.kind === 'rates'}
      <p class="muted">{t('i.quick.rates')}</p>
    {/if}
  </div>
{/if}

<style>
  .instant { margin: 0 0 6px; border-radius: var(--r-l, 14px); background: var(--surface1); border: 1px solid var(--stroke); }
  .answer { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; text-align: start; padding: 8px 14px; border-radius: var(--r-l, 14px); background: none; }
  .answer:hover { background: var(--surface2); }
  .line { display: flex; align-items: center; gap: 10px; min-width: 0; width: 100%; }
  .answer b { font-size: 1.4em; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  /* a formatted JSON or a long hash: smaller, kept to a few lines */
  .answer b.long { font-size: 0.92em; font-weight: 500; font-family: ui-monospace, Consolas, monospace; white-space: pre-wrap; max-height: 8.5em; overflow: auto; }
  .answer b.small { font-size: 1em; display: inline-flex; align-items: center; gap: 8px; }
  .hint { margin-inline-start: auto; font-size: 0.75em; color: var(--muted); white-space: nowrap; }
  .answer small { color: var(--muted); }
  .answer.copied b { color: var(--accent-text); }
  .swatch { flex: none; width: 24px; height: 24px; border-radius: 7px; border: 1px solid var(--stroke); }
  .muted { color: var(--muted); padding: 9px 14px; margin: 0; }
  .timers { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
  .tm { display: flex; align-items: center; gap: 10px; padding: 4px 14px; }
  .tname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tm b { font-variant-numeric: tabular-nums; }
</style>
