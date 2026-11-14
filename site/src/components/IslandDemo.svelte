<script module lang="ts">
  export type IslandState = 'resting' | 'working' | 'ask' | 'done' | 'stopped'
</script>

<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import type { PipMood } from '../../content/types'
  import PipCanvas from './PipCanvas.svelte'

  // A live HTML/CSS recreation of the island: one shell that springs between sizes, one layer per state.
  let { state, interactive = false, hello = false, loved = false, onanswer }: {
    state: IslandState
    interactive?: boolean
    hello?: boolean
    /** you just answered from the island: Pip shows love on "done" */
    loved?: boolean
    onanswer?: (allow: boolean) => void
  } = $props()

  const d = $derived(site.c.demo)
  const s = $derived(site.c.statuses)
  const MOOD: Record<IslandState, PipMood> = { resting: 'idle', working: 'focused', ask: 'alert', done: 'happy', stopped: 'sad' }
  const mood = $derived(state === 'done' && loved ? 'love' : MOOD[state])
</script>

<div class="island" data-state={state} role="group" aria-label={d.label}>
  <div class="shell">
    <div class="layer resting" inert={state !== 'resting'}>
      <span class="time">{d.time}</span>
    </div>
    <div class="layer line" inert={state !== 'working'} data-for="working">
      <span class="glyph working" aria-hidden="true"></span>
      <span class="sr">{s.working}:</span>
      <span class="text"><b>{d.project}</b> · {d.working}</span>
    </div>
    <div class="layer ask" inert={state !== 'ask'}>
      <small>{d.agent} · {s.needs}</small>
      <strong>{d.asks}</strong>
      <span class="q">{d.question}</span>
      <span class="buttons">
        <button type="button" class="deny" tabindex={interactive && state === 'ask' ? 0 : -1} onclick={() => onanswer?.(false)}>{d.deny}</button>
        <button type="button" class="allow" tabindex={interactive && state === 'ask' ? 0 : -1} onclick={() => onanswer?.(true)}>{d.allow}</button>
      </span>
    </div>
    <div class="layer line" inert={state !== 'done'} data-for="done">
      <span class="glyph done" aria-hidden="true">✓</span>
      <span class="text"><b>{d.project}</b> · {d.done}</span>
    </div>
    <div class="layer line" inert={state !== 'stopped'} data-for="stopped">
      <span class="glyph stopped" aria-hidden="true">!</span>
      <span class="text"><b>{d.project}</b> · {d.denied}</span>
    </div>
    <span class="pip"><PipCanvas {mood} {hello} scale={0.6} /></span>
  </div>
  {#if interactive}<span class="sr" aria-live="polite">{state === 'ask' ? `${d.asks}: ${d.question}` : state === 'done' ? d.done : state === 'stopped' ? d.denied : ''}</span>{/if}
</div>

<style>
  .island {
    --w: 12em; --h: 2.75em; --r: 1.375em;
    position: relative;
    display: flex;
    justify-content: center;
    block-size: 8.8em;
    font-size: var(--island-size, 14px);
    pointer-events: none;
  }
  .island[data-state='working'] { --w: 21em; }
  .island[data-state='done'], .island[data-state='stopped'] { --w: 19.5em; }
  .island[data-state='ask'] { --w: 27em; --h: 8.4em; --r: 1.6em; }

  .shell {
    position: relative;
    inline-size: min(var(--w), 100%);
    block-size: var(--h);
    border-radius: var(--r);
    background: linear-gradient(180deg, #1b1a24, #0c0b11 60%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.09),
      inset 0 0 0 1px rgb(255 255 255 / 0.06),
      0 18px 50px -12px rgb(0 0 0 / 0.8),
      0 0 0 1px rgb(0 0 0 / 0.6),
      0 0 60px -10px var(--glow, rgb(124 92 255 / 0.35));
    transition:
      inline-size 0.6s var(--spring),
      block-size 0.6s var(--spring),
      border-radius 0.6s var(--spring),
      box-shadow 0.6s ease;
    overflow: hidden;
    pointer-events: auto;
    contain: layout paint;
    color: #f3f3f6;
  }
  .island[data-state='working'] { --glow: rgb(59 130 246 / 0.45); }
  .island[data-state='ask'] { --glow: rgb(245 158 11 / 0.4); }
  .island[data-state='done'] { --glow: rgb(34 197 94 / 0.4); }
  .island[data-state='stopped'] { --glow: rgb(239 68 68 / 0.4); }

  .layer {
    position: absolute;
    /* physical sides: Pip keeps his spot on the right in both directions, like in the app */
    inset: 0 3.2em 0 0;
    display: flex;
    align-items: center;
    gap: 0.6em;
    padding: 0 0.4em 0 1.1em;
    opacity: 0;
    translate: 0 -0.4em;
    transition: opacity 0.2s ease, translate 0.35s var(--ease-out);
    white-space: nowrap;
    font-size: 0.93em;
  }
  .island[data-state='resting'] .resting,
  .island[data-state='working'] [data-for='working'],
  .island[data-state='ask'] .ask,
  .island[data-state='done'] [data-for='done'],
  .island[data-state='stopped'] [data-for='stopped'] { opacity: 1; translate: 0 0; transition-delay: 0.16s; }

  .time { font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: 0.02em; }
  .text { overflow: hidden; text-overflow: ellipsis; color: #d9d7e4; }
  .text b { color: #fff; font-weight: 600; }

  .glyph { inline-size: 1.15em; block-size: 1.15em; border-radius: 50%; display: grid; place-items: center; font-size: 0.78em; font-weight: 800; flex: none; color: #0c0b11; }
  .glyph.working { background: #3b82f6; inline-size: 0.7em; block-size: 0.7em; box-shadow: 0 0 0 0 rgb(59 130 246 / 0.6); animation: pulse 1.6s ease-out infinite; }
  .glyph.done { background: #22c55e; }
  .glyph.stopped { background: #ef4444; }
  @keyframes pulse { to { box-shadow: 0 0 0 0.6em rgb(59 130 246 / 0); } }

  .ask { flex-direction: column; align-items: flex-start; justify-content: center; gap: 0.15em; white-space: normal; right: 0; padding: 0.8em 3.4em 0.8em 1.1em; }
  .ask small { color: #a3a1b5; font-size: 0.8em; }
  .ask strong { font-weight: 600; }
  .ask .q { color: #e6e4ef; }
  .buttons { display: flex; gap: 0.5em; margin-block-start: 0.45em; align-self: stretch; margin-right: -2.3em; }
  .buttons button {
    flex: 1;
    font: inherit;
    font-size: 0.95em;
    padding: 0.45em 1em;
    border-radius: 999px;
    border: 0;
    color: #f3f3f6;
    background: #2a2934;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s var(--spring);
  }
  .buttons button:hover { background: #363542; }
  .buttons button:active { transform: scale(0.96); }
  .buttons .allow { background: #7c5cff; color: #fff; }
  .buttons .allow:hover { background: #8d71ff; }

  .pip { position: absolute; inset-block-start: 0.2em; right: 0.55em; inline-size: 2.6em; block-size: 2.35em; }

  .sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
