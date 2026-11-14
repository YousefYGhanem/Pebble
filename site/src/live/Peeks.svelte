<script lang="ts">
  import type { Feature } from '../../content/types'
  import Icon from '../components/Icon.svelte'
  import PipCanvas from '../components/PipCanvas.svelte'
  import { ticker } from './ticker.svelte'

  // Live-Activity style: the island peeks out with a notice, settles, and peeks out with the next one.
  let { f }: { f: Feature } = $props()
  const ICON: Record<string, string> = { water: 'drop', stand: 'stretch', prayer: 'moon', screen: 'chart', sound: 'speaker', caps: 'caps', mic: 'mic', charge: 'bolt' }
  const COLOR: Record<string, string> = { water: '#53e4ff', stand: '#22c55e', prayer: '#b9a8ff', screen: '#f59e0b', sound: '#53e4ff', caps: '#f3f3f6', mic: '#ef4444', charge: '#22c55e' }
  const chips = $derived(f.chips ?? [])
  const tick = ticker(1700)
  // even ticks: a notice is out; odd ticks: the island rests between them
  const open = $derived(tick.n % 2 === 0)
  const chip = $derived(chips[Math.floor(tick.n / 2) % Math.max(1, chips.length)])
</script>

<div class="peeks" use:tick.watch>
  <div class="island" class:open style:--c={chip ? COLOR[chip.id] ?? '#b9a8ff' : '#b9a8ff'}>
    {#if chip}
      {#key chip.id}
        <span class="content">
          <span class="ic"><Icon name={ICON[chip.id] ?? 'sparkle'} size={20} /></span>
          <span class="words"><b>{chip.label}</b><small>{chip.sub}</small></span>
        </span>
      {/key}
    {/if}
    <span class="pip"><PipCanvas mood={open ? 'curious' : 'idle'} scale={0.62} /></span>
  </div>
  <ul class="list">
    {#each chips as c (c.id)}
      <li class:on={c === chip && open}><Icon name={ICON[c.id] ?? 'sparkle'} size={16} />{c.label}</li>
    {/each}
  </ul>
</div>

<style>
  .peeks { display: grid; justify-items: center; gap: 2rem; padding-block: 1rem; }
  .island {
    position: relative; inline-size: 11rem; block-size: 2.6rem; border-radius: 1.3rem;
    background: linear-gradient(180deg, #1b1a24, #0c0b11); color: #f3f3f6;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.09), 0 18px 40px -12px rgb(0 0 0 / 0.8), 0 0 50px -12px var(--c);
    transition: inline-size 0.6s var(--spring), block-size 0.6s var(--spring), border-radius 0.6s var(--spring), box-shadow 0.6s;
    overflow: hidden;
  }
  .island.open { inline-size: min(20rem, 100%); block-size: 3.8rem; border-radius: 1.9rem; }
  .content { position: absolute; inset: 0 3.2rem 0 0; display: flex; align-items: center; gap: 0.75rem; padding-inline-start: 1rem; opacity: 0; transition: opacity 0.25s; white-space: nowrap; }
  .open .content { opacity: 1; transition-delay: 0.18s; }
  .ic { display: grid; place-items: center; inline-size: 2.2rem; block-size: 2.2rem; border-radius: 50%; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); flex: none; }
  .words { display: grid; line-height: 1.25; overflow: hidden; }
  .words small { color: #a3a1b5; overflow: hidden; text-overflow: ellipsis; }
  .pip { position: absolute; right: 0.5rem; inset-block-start: 50%; translate: 0 -50%; inline-size: 2.6rem; block-size: 2.3rem; }
  .list { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; list-style: none; margin: 0; padding: 0; }
  .list li { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--muted); padding: 0.4rem 0.8rem; border-radius: 999px; border: 1px solid var(--stroke); transition: color 0.3s, border-color 0.3s, background 0.3s; }
  .list li.on { color: #fff; border-color: rgb(185 168 255 / 0.5); background: rgb(124 92 255 / 0.12); }
</style>
