<script lang="ts">
  import type { Feature } from '../../content/types'
  import { ticker } from './ticker.svelte'

  // The island's keys: each one lights up in turn, as if pressed.
  let { f }: { f: Feature } = $props()
  const chips = $derived(f.chips ?? [])
  const tick = ticker(1400)
  const on = $derived(tick.n % Math.max(1, chips.length))
  const keys = (label: string) => label.split(/\s*[+·]\s*|\s+/).filter(Boolean)
</script>

<ul class="keys" use:tick.watch>
  {#each chips as c, i (c.id)}
    <li class:on={i === on}>
      <span class="caps" dir="ltr">{#each keys(c.label) as k, j (j)}<kbd>{k}</kbd>{/each}</span>
      <span class="sub">{c.sub}</span>
    </li>
  {/each}
</ul>

<style>
  .keys { display: grid; gap: 0.6rem; list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.7rem 0.9rem; border-radius: 0.9rem; border: 1px solid transparent; transition: background 0.3s, border-color 0.3s; }
  li.on { background: rgb(124 92 255 / 0.1); border-color: rgb(124 92 255 / 0.35); }
  .caps { display: flex; gap: 0.35rem; }
  kbd {
    min-inline-size: 2.2rem; padding: 0.35rem 0.6rem; border-radius: 0.5rem; text-align: center;
    font-family: inherit; font-weight: 600; font-size: 0.85rem; line-height: 1.2; color: #e8e6f3;
    background: linear-gradient(180deg, #2a2836, #1a1923); border: 1px solid rgb(255 255 255 / 0.1);
    box-shadow: 0 3px 0 #0b0a10, inset 0 1px 0 rgb(255 255 255 / 0.1);
    transition: transform 0.15s, box-shadow 0.15s, color 0.2s;
  }
  li.on kbd { transform: translateY(2px); box-shadow: 0 1px 0 #0b0a10, inset 0 1px 0 rgb(255 255 255 / 0.1), 0 0 18px rgb(124 92 255 / 0.5); color: #fff; }
  .sub { color: var(--muted); font-size: 0.92rem; text-align: end; }
</style>
