<script lang="ts">
  import type { Feature } from '../../content/types'
  import { site } from '../lib/i18n.svelte'
  import IslandDemo, { type IslandState } from '../components/IslandDemo.svelte'
  import { ticker } from './ticker.svelte'

  let { f: _f }: { f: Feature } = $props()
  // Each status is a colour and a shape, like in the app: ready ○, working ●, done ✓, stopped !, needs you ?
  const ORDER = [
    { key: 'ready', shape: '○', island: 'resting', color: '#9ca3af' },
    { key: 'working', shape: '●', island: 'working', color: '#3b82f6' },
    { key: 'needs', shape: '?', island: 'ask', color: '#f59e0b' },
    { key: 'done', shape: '✓', island: 'done', color: '#22c55e' },
    { key: 'stopped', shape: '!', island: 'stopped', color: '#ef4444' }
  ] as const
  const tick = ticker(2200)
  const cur = $derived(ORDER[tick.n % ORDER.length]!)
</script>

<div class="status" use:tick.watch>
  <div class="island"><IslandDemo state={cur.island as IslandState} /></div>
  <ul class="chips">
    {#each ORDER as o, i (o.key)}
      <li>
        <button type="button" class:on={o === cur} style:--c={o.color} aria-pressed={o === cur} onclick={() => { tick.stop(); tick.n = i }}>
          <span class="shape" aria-hidden="true">{o.shape}</span>{site.c.statuses[o.key]}
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  /* the island box (IslandDemo) is already as tall as the open "needs you" card, so the chips sit below it in every
     state; a negative margin here used to pull them up under the card */
  .status { display: grid; gap: 1rem; }
  .island { --island-size: clamp(10px, 1.5vw, 14px); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; list-style: none; margin: 0; padding: 0; }
  button {
    display: inline-flex; align-items: center; gap: 0.45rem;
    font: inherit; font-size: 0.9rem; color: var(--muted);
    padding: 0.45rem 0.85rem; border-radius: 999px; cursor: pointer;
    background: rgb(255 255 255 / 0.04); border: 1px solid var(--stroke);
    transition: color 0.3s, background 0.3s, border-color 0.3s, transform 0.4s var(--spring);
  }
  button.on { color: #fff; border-color: color-mix(in srgb, var(--c) 70%, transparent); background: color-mix(in srgb, var(--c) 18%, transparent); transform: translateY(-2px); }
  .shape { display: grid; place-items: center; inline-size: 1.25rem; block-size: 1.25rem; border-radius: 50%; color: var(--c); font-weight: 800; font-size: 0.85rem; }
</style>
