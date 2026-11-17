<script lang="ts">
  import { untrack } from 'svelte'
  import { answer, type Answer } from '../../../app/shared/quick'
  import { site } from '../lib/i18n.svelte'
  import { inView, reveal, glow, reducedMotion } from '../lib/motion'
  import { buddy } from '../lib/buddy.svelte'
  import Icon from './Icon.svelte'
  import PipCanvas from './PipCanvas.svelte'
  import type { PipMood } from '../../content/types'

  // Pip's page box (Ctrl+Alt+K), answering with the app's own parser (app/shared/quick.ts). Examples type themselves
  // while it is on screen; click in and it is yours. What only the app can do (Pip's answers, your screen, what you
  // copied) gets a short note instead.
  const b = $derived(site.c.box)

  let text = $state('')
  let mine = $state(false) // the visitor took over the box
  let ex = $state(0)
  let typed = $state(false) // the example is fully typed (its answer may show)
  let visible = false, loop = 0
  let input: HTMLInputElement

  // ---------- the examples, typing themselves ----------
  function step() {
    clearTimeout(loop)
    if (!visible || mine || document.hidden) return
    const q = b.examples[ex]!.q, calm = reducedMotion()
    if (!typed && text.length < q.length) {
      text = calm ? q : q.slice(0, text.length + 1)
      if (text.length === q.length) { typed = true; onTyped() }
      loop = window.setTimeout(step, calm ? 0 : 38 + Math.random() * 55)
    } else if (typed) {
      // hold the answer, then clear for the next one
      loop = window.setTimeout(() => { typed = false; text = ''; ex = (ex + 1) % b.examples.length; if (ex === 0) running = null; loop = window.setTimeout(step, 450) },
        calm ? 5200 : shown?.kind === 'timer' ? 4200 : 3000)
    }
  }
  // the timer example: Enter, as you would
  function onTyped() { if (shown?.kind === 'timer') setTimeout(() => { if (!mine) start(shown) }, 700) }
  $effect(() => () => clearTimeout(loop))
  // a new language: start over
  $effect(() => { void site.lang; untrack(() => { mine = false; text = ''; typed = false; ex = 0; running = null; step() }) })

  function take() {
    if (mine) return
    mine = true
    clearTimeout(loop)
    text = ''
    typed = false
  }
  function leave() { if (!text.trim()) { mine = false; loop = window.setTimeout(step, 1200) } }

  // ---------- the answer ----------
  let rates = $state<Record<string, number> | null>(null)
  let ratesFailed = $state(false), fetching = false
  const a = $derived(answer(text, { rates, now: Date.now(), locale: site.lang, tools: true, copyToAi: true }))
  /** the answer on show: the visitor's as they type; an example's once it is typed */
  const shown = $derived<Answer | null>(mine || typed ? a : null)
  const example = $derived(!mine && typed ? b.examples[ex] : undefined)

  // a currency question: the European Central Bank's rates (Frankfurter, like the app), fetched once
  $effect(() => {
    if (shown?.kind !== 'rates' || fetching || ratesFailed) return
    fetching = true
    fetch('https://api.frankfurter.dev/v1/latest', { signal: AbortSignal.timeout(8000) })
      .then(r => r.json() as Promise<{ rates?: Record<string, number> }>)
      .then(r => { if (!r.rates) throw 0; rates = { EUR: 1, ...r.rates } })
      .catch(() => (ratesFailed = true))
      .finally(() => (fetching = false))
  })

  type View =
    | { k: 'result'; text: string; sub: string; swatch?: string; hint: string }
    | { k: 'note'; text: string }
    | null
  const view = $derived.by<View>(() => {
    const s = shown
    if (!s) return mine && text.trim() ? { k: 'note', text: b.toPip } : null
    switch (s.kind) {
      case 'calc': case 'unit': case 'currency': case 'time': case 'tool':
        return { k: 'result', text: s.text, sub: s.sub, hint: copied ? '✓' : b.enter }
      case 'color': return { k: 'result', text: s.text, sub: s.sub, swatch: s.color, hint: copied ? '✓' : b.enter }
      case 'timer': return { k: 'note', text: `${b.starts}: ${s.name || b.timer} · ${clock(s.seconds)}` }
      case 'translate':
        return example?.a ? { k: 'result', text: example.a, sub: `${b.into.replace('{lang}', s.to.toUpperCase())} · ${b.canned}`, hint: '' } : { k: 'note', text: b.pipAnswers }
      case 'ai': return { k: 'note', text: s.how === 'ask' ? b.toPip : b.appOnly }
      case 'rates': return { k: 'note', text: ratesFailed ? b.noRates : b.rates }
      default: return { k: 'note', text: b.appOnly } // pick, clipboard tools, the running timers, hashes
    }
  })
  const cardKey = $derived(view ? `${view.k}|${view.text}|${'swatch' in view ? view.swatch : ''}` : '')

  let copied = $state(false)
  function enter() {
    if (shown?.kind === 'timer') { start(shown); text = ''; return }
    if (view?.k === 'result' && view.hint) {
      void navigator.clipboard?.writeText(view.text).then(() => { copied = true; setTimeout(() => (copied = false), 1400) }, () => {})
    }
  }

  // ---------- the island's timer ----------
  let running = $state<{ name: string; ends: number; total: number } | null>(null)
  let now = $state(Date.now())
  function start(t: Answer | null) {
    if (t?.kind !== 'timer') return
    running = { name: t.name || b.timer, ends: Date.now() + t.seconds * 1000, total: t.seconds }
    now = Date.now()
  }
  let onScreen = $state(false)
  $effect(() => {
    if (!running || !onScreen) return
    const id = setInterval(() => { now = Date.now(); if (running && now >= running.ends) running = null }, 1000)
    return () => clearInterval(id)
  })
  const left = $derived(running ? Math.max(0, (running.ends - now) / 1000) : 0)
  const clock = (s: number) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(x).padStart(2, '0')}` }

  const mood = $derived<PipMood>(running && !text ? 'focused' : view?.k === 'result' ? 'happy' : text && !view ? 'focused' : view ? 'curious' : 'idle')
</script>

<section class="onebox" id="one-box" aria-labelledby="one-box-title"
  use:inView={{ onchange: v => { onScreen = v; if (v) buddy.mood = 'curious' }, margin: '-30% 0px -30% 0px' }}>
  <div class="container inner">
    <div class="text">
      <p class="kicker" use:reveal>{b.kicker}</p>
      <h2 id="one-box-title" use:reveal={60}>{b.title}</h2>
      <p class="body" use:reveal={120}>{b.lead}</p>
      <ul class="points">
        {#each b.points as p, i (i)}
          <li use:reveal={160 + i * 60}><span class="tick"><Icon name="check" size={14} /></span>{p}</li>
        {/each}
      </ul>
    </div>

    <div class="visual" use:reveal={100}>
      <div class="bezel" use:glow={{ spread: 50 }}>
        <div class="bezel-in screen" role="group" aria-label={b.label}
          use:inView={{ onchange: v => { visible = v; if (v) step(); else clearTimeout(loop) }, threshold: 0.2 }}>
          <div class="wallpaper" aria-hidden="true"></div>
          <div class="page">
            <div class="top">
              <span class="pip" aria-hidden="true"><PipCanvas {mood} scale={0.62} /></span>
              <b>Pip</b>
              {#if running}
                <span class="timer" role="timer" aria-label="{running.name} {clock(left)}">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /><circle class="arc" cx="10" cy="10" r="8" pathLength="100" style:stroke-dashoffset={100 - (left / running.total) * 100} /></svg>
                  <span class="tname">{running.name}</span><b dir="ltr">{clock(left)}</b>
                </span>
              {/if}
            </div>
            <div class="slot" aria-live={mine ? 'polite' : 'off'}>
              {#key cardKey}
                {#if view?.k === 'result'}
                  <button type="button" class="card result" onclick={enter} tabindex={mine ? 0 : -1}>
                    <span class="line">
                      {#if view.swatch}<i class="swatch" style:background={view.swatch}></i>{/if}
                      <b dir="auto">{view.text}</b>
                      {#if view.hint}<span class="hint">{view.hint}</span>{/if}
                    </span>
                    {#if view.sub}<small dir="auto">{view.sub}</small>{/if}
                  </button>
                {:else if view}
                  <p class="card note">{view.text}</p>
                {/if}
              {/key}
            </div>
            <form class="ask" onsubmit={e => { e.preventDefault(); enter() }}>
              <span class="tool" aria-hidden="true"><Icon name="peek" size={15} /></span>
              <input bind:this={input} bind:value={text} dir="auto" placeholder={b.placeholder} aria-label={b.placeholder}
                autocomplete="off" spellcheck="false" enterkeyhint="go"
                onfocus={take} onpointerdown={take} onblur={leave} oninput={() => (copied = false)} />
              <button type="submit" class="go" disabled={!text.trim()} aria-label="Enter"><Icon name="arrow" size={15} /></button>
            </form>
          </div>
        </div>
      </div>
      <p class="try">{b.try}</p>
    </div>
  </div>
</section>

<style>
  .onebox { padding-block: var(--section-pad); scroll-margin-top: var(--nav-h); position: relative; }
  .onebox::before {
    content: ''; position: absolute; z-index: -1; inset: 10% 0 auto; block-size: 70%; pointer-events: none;
    background: radial-gradient(45% 50% at 70% 50%, rgb(83 228 255 / 0.07), transparent 70%), radial-gradient(40% 50% at 30% 40%, rgb(124 92 255 / 0.1), transparent 70%);
  }
  .inner { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: clamp(2rem, 6vw, 5.5rem); align-items: center; }
  .body { color: var(--muted); font-size: 1.05rem; line-height: 1.7; margin: 1.1rem 0 1.75rem; }
  .points { list-style: none; margin: 0; padding: 0; border-block-start: 1px solid var(--stroke); }
  .points li { display: flex; gap: 0.75rem; align-items: flex-start; padding-block: 0.7rem; line-height: 1.5; color: #d4d2e0; font-size: 0.95rem; border-block-end: 1px solid var(--stroke); }
  .tick { flex: none; display: grid; place-items: center; margin-block-start: 0.2rem; color: var(--cyan); opacity: 0.85; }
  .visual { min-inline-size: 0; }

  .screen { position: relative; display: grid; place-items: center; min-block-size: 23rem; padding: clamp(1rem, 3vw, 2rem); background: #0b0a12; }
  .wallpaper {
    position: absolute; inset: 0; pointer-events: none;
    background:
      radial-gradient(45% 55% at 20% 20%, rgb(124 92 255 / 0.4), transparent 70%),
      radial-gradient(40% 50% at 85% 80%, rgb(83 228 255 / 0.2), transparent 70%);
  }
  /* the open island on Pip's page, after app/renderer/island/ChatPage.svelte */
  .page {
    position: relative; inline-size: min(34rem, 100%);
    display: flex; flex-direction: column; gap: 0.6rem;
    padding: 0.8rem 0.9rem 0.9rem; border-radius: 1.6rem; color: #f3f3f6;
    background: linear-gradient(180deg, #1b1a24, #0c0b11 60%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.09), inset 0 0 0 1px rgb(255 255 255 / 0.06), 0 30px 60px -20px rgb(0 0 0 / 0.85), 0 0 70px -15px rgb(124 92 255 / 0.4);
  }
  .top { display: flex; align-items: center; gap: 0.5rem; min-block-size: 2.2rem; font-size: 0.9rem; }
  .top .pip { inline-size: 2.6rem; block-size: 2.2rem; }
  .timer {
    display: inline-flex; align-items: center; gap: 0.45rem; margin-inline-start: auto; padding: 0.3rem 0.75rem 0.3rem 0.45rem; border-radius: 999px;
    background: rgb(83 228 255 / 0.1); border: 1px solid rgb(83 228 255 / 0.25); font-size: 0.85rem;
    animation: pop 0.55s var(--spring) both;
  }
  .timer svg { inline-size: 1.1rem; block-size: 1.1rem; rotate: -90deg; fill: none; stroke-width: 2.5; }
  .timer circle { stroke: rgb(255 255 255 / 0.15); }
  .timer .arc { stroke: var(--cyan); stroke-dasharray: 100; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
  .timer b { font-variant-numeric: tabular-nums; font-weight: 600; }
  .tname { color: #d9d7e4; max-inline-size: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* the answer sits above the box; the space is kept so nothing jumps */
  .slot { display: flex; flex-direction: column; justify-content: flex-end; min-block-size: 9.5rem; }
  .card { margin: 0; border-radius: 14px; background: rgb(255 255 255 / 0.05); border: 1px solid rgb(255 255 255 / 0.08); animation: pop 0.5s var(--spring) both; transform-origin: 50% 100%; }
  .result { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; inline-size: 100%; padding: 0.7rem 1rem; font: inherit; color: inherit; text-align: start; cursor: pointer; transition: background 0.2s; }
  .result:hover { background: rgb(255 255 255 / 0.08); }
  .line { display: flex; align-items: center; gap: 0.7rem; inline-size: 100%; min-inline-size: 0; }
  .result b { font-size: 1.55rem; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; line-height: 1.25; }
  .hint { margin-inline-start: auto; font-size: 0.75rem; color: var(--muted); white-space: nowrap; }
  .result small { color: var(--muted); font-size: 0.82rem; }
  .swatch { flex: none; inline-size: 1.7rem; block-size: 1.7rem; border-radius: 0.5rem; border: 1px solid rgb(255 255 255 / 0.15); box-shadow: 0 0 24px -4px currentColor; }
  .note { padding: 0.7rem 1rem; color: var(--muted); font-size: 0.9rem; line-height: 1.5; }
  @keyframes pop { from { opacity: 0; translate: 0 0.6rem; scale: 0.96; } }

  .ask { position: relative; display: flex; align-items: center; gap: 0.4rem; }
  .tool { display: grid; place-items: center; inline-size: 2.2rem; block-size: 2.2rem; color: var(--muted); flex: none; }
  input {
    flex: 1; min-inline-size: 0; font: inherit; font-size: 0.98rem; color: inherit; border: 0; border-radius: 12px;
    padding: 0.62rem 0.85rem; background: rgb(255 255 255 / 0.08); transition: background 0.2s, box-shadow 0.2s;
  }
  input::placeholder { color: #8e8c9f; }
  input:focus { outline: none; background: rgb(255 255 255 / 0.1); box-shadow: 0 0 0 2px var(--accent); }
  input:focus-visible { outline: none; }
  .go { display: grid; place-items: center; flex: none; inline-size: 2.3rem; block-size: 2.3rem; padding: 0; border: 0; border-radius: 50%; background: var(--accent); color: #fff; cursor: pointer; transition: opacity 0.2s, transform 0.2s var(--spring); }
  .go:disabled { opacity: 0.4; cursor: default; }
  .go:not(:disabled):active { transform: scale(0.92); }
  :global([dir='rtl']) .go :global(svg) { rotate: 180deg; }

  .try { margin: 1rem 0 0; text-align: center; color: var(--muted); font-size: 0.9rem; }

  @media (max-width: 860px) {
    .inner { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .screen { min-block-size: 21rem; padding: 0.75rem; }
    .page { padding: 0.65rem; border-radius: 1.3rem; }
    .result b { font-size: 1.3rem; }
    .tool { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card, .timer { animation: none; }
  }
</style>
