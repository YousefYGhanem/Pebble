<script lang="ts">
  import type { Feature, PipMood } from '../../content/types'
  import PipCanvas from '../components/PipCanvas.svelte'

  // A big Pip. With chips, you pick his mood; without, he shows the feature's mood (sleepy for "rests when you do").
  let { f }: { f: Feature } = $props()
  let picked = $state<PipMood | null>(null)
  const mood = $derived(picked ?? f.mood ?? 'idle')
  const chips = $derived(f.chips ?? [])
</script>

<div class="moods">
  <div class="stage" class:sleepy={mood === 'sleepy'}>
    <div class="pip"><PipCanvas {mood} scale={0.5} /></div>
  </div>
  {#if chips.length}
    <div class="chips" role="group" aria-label={f.kicker}>
      {#each chips as c (c.id)}
        <button type="button" aria-pressed={mood === c.id} onclick={() => (picked = c.id as PipMood)}>{c.label}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .moods { display: grid; gap: 1.25rem; }
  .stage { position: relative; display: grid; place-items: center; block-size: clamp(200px, 26vw, 280px); border-radius: 1.25rem; background: radial-gradient(55% 60% at 50% 55%, rgb(83 228 255 / 0.12), transparent 70%); transition: background 0.8s; }
  .stage.sleepy { background: radial-gradient(55% 60% at 50% 55%, rgb(124 92 255 / 0.16), transparent 70%); }
  .pip { inline-size: min(100%, 360px); block-size: 100%; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
  button {
    font: inherit; font-size: 0.88rem; color: var(--muted); cursor: pointer;
    padding: 0.45rem 0.9rem; border-radius: 999px; background: rgb(255 255 255 / 0.04); border: 1px solid var(--stroke);
    transition: color 0.2s, background 0.3s, transform 0.4s var(--spring);
  }
  button:hover { color: var(--text); transform: translateY(-2px); }
  button[aria-pressed='true'] { color: #fff; background: var(--accent); border-color: transparent; }
</style>
