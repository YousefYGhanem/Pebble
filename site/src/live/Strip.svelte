<script lang="ts">
  import type { Feature } from '../../content/types'
  import { ticker } from './ticker.svelte'

  // The game strip as it sits over a full-screen game: its readings drift as a game would push them, and the chips
  // below switch items on and off, as Settings → Game strip does (chips: id = the item, label = its name, sub = its unit).
  let { f }: { f: Feature } = $props()
  const tick = ticker(1100)
  const BASE: Record<string, [number, number]> = { cpu: [38, 18], cpuTemp: [64, 8], ram: [52, 4], gpu: [86, 10], gpuTemp: [71, 6] }
  let off = $state<string[]>([])
  const shown = $derived((f.chips ?? []).filter(c => !off.includes(c.id)))
  // a smooth, repeatable wobble per item, no randomness to keep the page calm
  const value = (id: string, n: number) => {
    const [mid, span] = BASE[id] ?? [0, 0]
    return Math.round(mid + span * Math.sin(n * 0.9 + id.length * 1.7) * 0.5)
  }
  const hot = (id: string, v: number) => (id.endsWith('Temp') ? v >= 74 : id === 'gpu' || id === 'cpu' ? v >= 90 : false)
  function flip(id: string) { off = off.includes(id) ? off.filter(x => x !== id) : [...off, id]; tick.stop() }
</script>

<div class="game" use:tick.watch>
  <div class="scene" aria-hidden="true"><i class="sun"></i><i class="hill a"></i><i class="hill b"></i><i class="road"></i></div>
  <div class="strip" role="img" aria-label={shown.map(c => `${c.label} ${value(c.id, tick.n)}${c.sub ?? ''}`).join(', ')}>
    {#each shown as c (c.id)}
      {@const v = value(c.id, tick.n)}
      <span class="item" class:hot={hot(c.id, v)}><small>{c.label}</small><b dir="ltr">{v}{c.sub}</b></span>
    {/each}
  </div>
</div>
<ul class="items" aria-label={f.kicker}>
  {#each f.chips ?? [] as c (c.id)}
    <li><button type="button" aria-pressed={!off.includes(c.id)} onclick={() => flip(c.id)}>{c.label} <span dir="ltr">{c.sub}</span></button></li>
  {/each}
</ul>

<style>
  .game { position: relative; aspect-ratio: 16 / 8; border-radius: 1rem; overflow: hidden; border: 1px solid var(--stroke); background: linear-gradient(180deg, #2a1846, #612c5a 55%, #e0795a); }
  .scene i { position: absolute; display: block; }
  .sun { inline-size: 22%; aspect-ratio: 1; border-radius: 50%; inset-inline-start: 39%; inset-block-end: 22%; background: radial-gradient(circle, #ffd27a, #ff8a5b 70%); box-shadow: 0 0 60px #ff9b6b; }
  .hill { inset-block-end: 0; inline-size: 80%; block-size: 38%; border-radius: 50% 50% 0 0; background: #2b1638; }
  .hill.a { inset-inline-start: -20%; }
  .hill.b { inset-inline-end: -25%; block-size: 30%; background: #1d0f28; }
  /* the road drifts as if the game were driving: transform only, and still for reduced motion */
  .road { inset-inline: -50%; inset-block-end: 0; block-size: 14%; background: repeating-linear-gradient(90deg, #120a19 0 40px, #3a2448 40px 44px); animation: drive 1.2s linear infinite; }
  @keyframes drive { to { transform: translateX(44px); } }
  @media (prefers-reduced-motion: reduce) { .road { animation: none; } }
  .strip {
    position: absolute; inset-block-start: 0.6rem; inset-inline-start: 50%; translate: -50% 0;
    display: flex; gap: 0.15rem; padding: 0.3rem 0.45rem; border-radius: 999px; max-inline-size: calc(100% - 1rem);
    background: rgb(10 9 16 / 0.82); border: 1px solid rgb(255 255 255 / 0.1); backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px -10px rgb(0 0 0 / 0.7); transition: width 0.4s var(--spring);
  }
  :global([dir='rtl']) .strip { translate: 50% 0; }
  .item { display: flex; align-items: baseline; gap: 0.3rem; padding: 0.15rem 0.5rem; border-radius: 999px; white-space: nowrap; font-size: clamp(0.62rem, 1.6vw, 0.78rem); transition: background 0.4s, color 0.4s; }
  .item small { color: #9a97ad; }
  .item b { color: #fff; font-variant-numeric: tabular-nums; font-weight: 600; }
  .item.hot { background: rgb(251 122 60 / 0.18); }
  .item.hot b { color: #ffb38a; }
  .items { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.45rem; list-style: none; margin: 1rem 0 0; padding: 0; }
  .items button { font: inherit; font-size: 0.85rem; color: var(--muted); padding: 0.4rem 0.85rem; border-radius: 999px; border: 1px solid var(--stroke); background: transparent; cursor: pointer; transition: background 0.3s, border-color 0.3s, color 0.3s; }
  .items button[aria-pressed='true'] { color: #fff; border-color: rgb(124 92 255 / 0.5); background: rgb(124 92 255 / 0.14); }
  .items button:hover { background: rgb(255 255 255 / 0.06); }
</style>
