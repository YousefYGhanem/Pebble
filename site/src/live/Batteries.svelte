<script lang="ts">
  import type { Feature } from '../../content/types'
  import { ticker } from './ticker.svelte'
  import Icon from '../components/Icon.svelte'

  // Home's batteries row, as on the island: headphones connect (a peek with their battery), then the controller runs
  // low (an orange bar and a peek). Chips: mouse, controller, headset (label: name, sub: level), then the words of the
  // two peeks (connected, low).
  let { f }: { f: Feature } = $props()
  const tick = ticker(2600)
  const chip = (id: string) => f.chips?.find(c => c.id === id)
  const ICON: Record<string, string> = { mouse: 'mouse', controller: 'gamepad', headset: 'headset' }
  const step = $derived(tick.n % 4) // 0: two devices · 1: headphones connect · 2: the controller runs low · 3: settled
  const devices = $derived(['controller', 'mouse', 'headset']
    .filter(id => id !== 'headset' || step >= 1)
    .map(id => ({ id, name: chip(id)?.label ?? id, level: id === 'controller' && step >= 2 ? 18 : Number(chip(id)?.sub ?? 50) }))
    .sort((a, b) => a.level - b.level))
  const peek = $derived(step === 1 ? { icon: 'headset', title: chip('headset')?.label, sub: chip('connected')?.label, level: Number(chip('headset')?.sub ?? 0), low: false }
    : step === 2 ? { icon: 'gamepad', title: chip('controller')?.label, sub: chip('low')?.label, level: 18, low: true } : null)
</script>

<div class="batteries" use:tick.watch>
  <div class="peek" class:on={!!peek} class:low={peek?.low} aria-live="polite">
    {#if peek}
      <span class="ring" style:--p={peek.level}><Icon name={peek.icon} size={15} /></span>
      <span class="text"><b>{peek.title}</b><small>{peek.sub}</small></span>
      <strong dir="ltr">{peek.level}%</strong>
    {/if}
  </div>
  <ul class="row" aria-label={f.kicker}>
    {#each devices as d (d.id)}
      <li class:low={d.level <= 20}>
        <Icon name={ICON[d.id] ?? 'plug'} size={16} />
        <span class="name">{d.name}</span>
        <span class="bar" aria-hidden="true"><i style:width="{d.level}%"></i></span>
        <span class="level" dir="ltr">{d.level}%</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .batteries { display: grid; justify-items: center; gap: 1.2rem; }
  .peek {
    display: flex; align-items: center; gap: 0.75rem; min-block-size: 3rem; padding: 0.5rem 1rem 0.5rem 0.55rem; border-radius: 999px;
    background: #0e0d15; border: 1px solid var(--stroke); color: #dcdaea; font-size: 0.9rem;
    opacity: 0; translate: 0 -0.6rem; scale: 0.92; transition: opacity 0.3s, translate 0.6s var(--spring), scale 0.6s var(--spring);
  }
  .peek.on { opacity: 1; translate: 0 0; scale: 1; }
  .ring {
    display: grid; place-items: center; inline-size: 2.2rem; block-size: 2.2rem; border-radius: 50%; color: #fff;
    background: radial-gradient(#0e0d15 58%, transparent 60%), conic-gradient(var(--c, #34d399) calc(var(--p) * 1%), rgb(255 255 255 / 0.1) 0);
  }
  .peek.low .ring { --c: #f59e0b; }
  .text { display: grid; line-height: 1.25; }
  .text b { color: #fff; font-weight: 600; }
  .text small { color: var(--muted); font-size: 0.8rem; }
  .peek strong { margin-inline-start: 0.4rem; font-variant-numeric: tabular-nums; color: #fff; }
  .peek.low strong { color: #fbbf24; }
  .row {
    display: grid; gap: 0.55rem; inline-size: min(100%, 26rem); list-style: none; margin: 0; padding: 0.85rem 1rem; border-radius: 1.1rem;
    background: rgb(255 255 255 / 0.03); border: 1px solid var(--stroke);
  }
  li { display: flex; align-items: center; gap: 0.7rem; color: var(--muted); font-size: 0.92rem; animation: in 0.5s var(--spring); }
  @keyframes in { from { opacity: 0; translate: 0 -0.3rem; } }
  @media (prefers-reduced-motion: reduce) { li { animation: none; } }
  .name { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e8e6f3; }
  .bar { flex: none; inline-size: 3.2rem; block-size: 0.4rem; border-radius: 1rem; background: rgb(255 255 255 / 0.1); overflow: hidden; }
  .bar i { display: block; block-size: 100%; border-radius: 1rem; background: #34d399; transition: width 0.8s var(--ease-out), background 0.4s; }
  .level { flex: none; min-inline-size: 3ch; text-align: end; font-variant-numeric: tabular-nums; }
  li.low .bar i { background: #f59e0b; }
  li.low .level { color: #fbbf24; }
</style>
