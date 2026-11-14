<script lang="ts">
  import type { Feature } from '../../content/types'
  import { ticker } from './ticker.svelte'
  import PipCanvas from '../components/PipCanvas.svelte'

  // A session filling up: the ring steps to each warning (chips: 75, 90, 100) and a peek says so, as on the island.
  let { f }: { f: Feature } = $props()
  const STEPS = [32, 75, 90, 100]
  const COLORS = ['#7c5cff', '#f59e0b', '#fb7a3c', '#ef4444']
  const tick = ticker(2300)
  const i = $derived(tick.n % STEPS.length)
  const pct = $derived(STEPS[i]!)
  const chip = $derived(i > 0 ? f.chips?.[i - 1] : undefined)
  const C = 2 * Math.PI * 52
</script>

<div class="usage" use:tick.watch>
  <div class="peek" class:on={!!chip}>
    <span class="dot" style:background={COLORS[i]}></span>
    <span><b>{chip?.label ?? ''}</b> {chip?.sub ?? ''}</span>
  </div>
  <div class="ring" style:--c={COLORS[i]}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="52" class="track" />
      {#each [75, 90] as m (m)}
        <line x1="60" y1="2" x2="60" y2="14" class="mark" transform="rotate({m * 3.6} 60 60)" />
      {/each}
      <circle cx="60" cy="60" r="52" class="fill" stroke-dasharray={C} stroke-dashoffset={C * (1 - pct / 100)} />
    </svg>
    <div class="center">
      <span class="pip"><PipCanvas mood={i >= 1 ? 'alert' : 'focused'} scale={0.55} /></span>
      <strong dir="ltr">{pct}%</strong>
      <small>Claude Code</small>
    </div>
  </div>
  <ol class="scale" aria-label={f.kicker}>
    {#each f.chips ?? [] as c, k (c.id)}<li class:hit={i > k}><b dir="ltr">{c.label}</b><span>{c.sub}</span></li>{/each}
  </ol>
</div>

<style>
  .usage { display: grid; justify-items: center; gap: 1.25rem; }
  .peek {
    display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.55rem 1.1rem; border-radius: 999px;
    background: #0e0d15; border: 1px solid var(--stroke); font-size: 0.92rem; color: #dcdaea;
    opacity: 0; translate: 0 -0.75rem; scale: 0.9;
    transition: opacity 0.3s, translate 0.6s var(--spring), scale 0.6s var(--spring);
    min-block-size: 2.4rem;
  }
  .peek.on { opacity: 1; translate: 0 0; scale: 1; }
  .peek b { color: #fff; }
  .dot { inline-size: 0.6rem; block-size: 0.6rem; border-radius: 50%; }
  /* the glow is a shadow on the round box: a filter on the SVG stroke paints a faint square in Chromium */
  .ring { position: relative; inline-size: min(240px, 60vw); aspect-ratio: 1; border-radius: 50%; box-shadow: 0 0 44px -18px var(--c), inset 0 0 44px -22px var(--c); transition: box-shadow 0.6s; }
  svg { inline-size: 100%; block-size: 100%; rotate: -90deg; }
  .track { fill: none; stroke: rgb(255 255 255 / 0.08); stroke-width: 9; }
  .fill { fill: none; stroke: var(--c); stroke-width: 9; stroke-linecap: round; transition: stroke-dashoffset 1.4s var(--ease-out), stroke 0.6s; }
  .mark { stroke: rgb(255 255 255 / 0.35); stroke-width: 2; }
  .center { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 0.1rem; }
  .pip { inline-size: 4.5rem; block-size: 3.4rem; }
  strong { font-size: 2.2rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  small { color: var(--muted); font-size: 0.8rem; }
  .scale { display: flex; gap: 0.6rem; list-style: none; margin: 0; padding: 0; flex-wrap: wrap; justify-content: center; }
  .scale li { display: grid; text-align: center; padding: 0.5rem 0.9rem; border-radius: 0.8rem; border: 1px solid var(--stroke); color: var(--muted); font-size: 0.82rem; transition: border-color 0.4s, color 0.4s, background 0.4s; }
  .scale li b { font-size: 1rem; color: #cfcde0; }
  .scale li.hit { border-color: rgb(245 158 11 / 0.5); background: rgb(245 158 11 / 0.08); color: #f3e2c0; }
</style>
