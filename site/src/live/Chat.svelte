<script lang="ts">
  import type { Feature } from '../../content/types'
  import PipCanvas from '../components/PipCanvas.svelte'
  import { ticker } from './ticker.svelte'

  // A short conversation that writes itself while on screen: your messages, then Pip "typing", then his answer.
  let { f }: { f: Feature } = $props()
  const lines = $derived(f.chips ?? [])
  const tick = ticker(1300)
  // per message: one tick to appear (+1 typing tick before Pip's), then a pause at the end
  const steps = $derived(lines.flatMap((l, i) => (l.id === 'pip' ? [{ shown: i, typing: true }, { shown: i + 1, typing: false }] : [{ shown: i + 1, typing: false }])))
  const cur = $derived(steps.length ? steps[Math.min(tick.n % (steps.length + 3), steps.length - 1)]! : { shown: 0, typing: false })
</script>

<div class="chat" use:tick.watch>
  <div class="head"><span class="pip"><PipCanvas mood={cur.typing ? 'focused' : 'happy'} scale={0.6} /></span><b>Pip</b></div>
  <ol class="msgs">
    {#each lines.slice(0, cur.shown) as m, i (i)}
      <li class={m.id === 'pip' ? 'pip-msg' : 'you'}>{m.label}</li>
    {/each}
    {#if cur.typing}<li class="pip-msg typing" aria-hidden="true"><i></i><i></i><i></i></li>{/if}
  </ol>
</div>

<style>
  .chat { display: grid; gap: 1rem; min-block-size: 300px; align-content: start; }
  .head { display: flex; align-items: center; gap: 0.6rem; padding-block-end: 0.75rem; border-block-end: 1px solid var(--stroke); }
  .head .pip { inline-size: 2.8rem; block-size: 2.4rem; }
  .msgs { display: flex; flex-direction: column; gap: 0.6rem; list-style: none; margin: 0; padding: 0; }
  li { max-inline-size: 82%; padding: 0.65rem 0.95rem; border-radius: 1.1rem; line-height: 1.45; font-size: 0.95rem; animation: pop 0.5s var(--spring) both; }
  .you { align-self: flex-end; background: var(--accent); color: #fff; border-end-end-radius: 0.35rem; }
  .pip-msg { align-self: flex-start; background: rgb(255 255 255 / 0.07); border: 1px solid var(--stroke); border-end-start-radius: 0.35rem; }
  .typing { display: flex; gap: 0.3rem; padding-block: 0.85rem; }
  .typing i { inline-size: 0.45rem; block-size: 0.45rem; border-radius: 50%; background: var(--muted); animation: bounce 1s ease-in-out infinite; }
  .typing i:nth-child(2) { animation-delay: 0.15s; }
  .typing i:nth-child(3) { animation-delay: 0.3s; }
  @keyframes pop { from { opacity: 0; scale: 0.9; translate: 0 0.5rem; } }
  @keyframes bounce { 50% { translate: 0 -0.3rem; opacity: 0.5; } }
</style>
