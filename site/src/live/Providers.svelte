<script lang="ts">
  import type { Feature } from '../../content/types'
  import { ticker } from './ticker.svelte'

  // Who answers Pip's chat: the free AI is picked from the start; the choice moves through the others and comes back,
  // the way Settings → Pip's chat switches it.
  let { f }: { f: Feature } = $props()
  const chips = $derived(f.chips ?? [])
  const tick = ticker(1800)
  // the free AI holds twice as long as the others
  const seq = $derived([0, ...chips.keys()])
  const on = $derived(seq[tick.n % seq.length]!)
</script>

<ul class="list" use:tick.watch>
  {#each chips as c, i (c.id)}
    <li class:on={i === on} class:free={c.id === 'free'}>
      <span class="radio" aria-hidden="true"></span>
      <span class="name"><b>{c.label}</b><small>{c.sub}</small></span>
      {#if c.id === 'free'}<span class="badge" aria-hidden="true">✦</span>{/if}
    </li>
  {/each}
</ul>

<style>
  .list { display: grid; gap: 0.6rem; list-style: none; margin: 0; padding: 0; }
  li { position: relative; display: flex; align-items: center; gap: 0.9rem; padding: 0.85rem 1rem; border-radius: 0.95rem; border: 1px solid var(--stroke); background: rgb(255 255 255 / 0.02); transition: background 0.35s, border-color 0.35s, translate 0.45s var(--spring); }
  li.on { background: rgb(124 92 255 / 0.12); border-color: rgb(124 92 255 / 0.45); translate: 0 -1px; }
  .radio { flex: none; inline-size: 1.05rem; block-size: 1.05rem; border-radius: 50%; border: 1.5px solid rgb(255 255 255 / 0.3); display: grid; place-items: center; transition: border-color 0.3s; }
  .radio::after { content: ''; inline-size: 0.5rem; block-size: 0.5rem; border-radius: 50%; background: var(--lavender); scale: 0; transition: scale 0.4s var(--spring); }
  li.on .radio { border-color: var(--lavender); }
  li.on .radio::after { scale: 1; }
  .name { display: flex; flex-direction: column; gap: 0.1rem; min-inline-size: 0; }
  .name b { font-weight: 600; font-size: 0.98rem; }
  .name small { color: var(--muted); font-size: 0.85rem; }
  .badge { margin-inline-start: auto; color: var(--cyan); font-size: 1rem; text-shadow: 0 0 12px rgb(83 228 255 / 0.7); }
  .free.on { box-shadow: 0 0 40px -12px rgb(83 228 255 / 0.5); }
</style>
