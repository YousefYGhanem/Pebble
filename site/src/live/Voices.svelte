<script lang="ts">
  import type { Feature } from '../../content/types'
  import { site } from '../lib/i18n.svelte'
  import Icon from '../components/Icon.svelte'

  // Real samples made with Piper, the voices the app reads with (site/public/voices/<language>.wav). One plays at a time.
  let { f }: { f: Feature } = $props()
  const chips = $derived(f.chips ?? [])
  let playing = $state('')
  let audio: HTMLAudioElement | undefined

  function play(id: string) {
    audio?.pause()
    if (playing === id) { playing = ''; return }
    audio = new Audio(`${import.meta.env.BASE_URL}voices/${id}.wav`)
    audio.onended = audio.onerror = () => { if (playing === id) playing = '' }
    playing = id
    audio.play().catch(() => { if (playing === id) playing = '' })
  }
  $effect(() => () => audio?.pause())
  // switching the page's language rebuilds the labels: stop
  $effect(() => { void site.lang; return () => { audio?.pause(); playing = '' } })
</script>

<ul class="voices">
  {#each chips as c (c.id)}
    <li class:on={playing === c.id}>
      <button type="button" aria-pressed={playing === c.id} onclick={() => play(c.id)}>
        <span class="btn-ic" aria-hidden="true"><Icon name={playing === c.id ? 'stop' : 'play'} size={15} /></span>
        <span class="name"><b>{c.label}</b><small lang={c.id} dir="auto">{c.sub}</small></span>
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .voices { display: grid; gap: 0.55rem; list-style: none; margin: 0; padding: 0; }
  button {
    display: flex; align-items: center; gap: 0.9rem; inline-size: 100%; padding: 0.7rem 0.9rem; border-radius: 0.95rem;
    font: inherit; color: inherit; text-align: start; cursor: pointer;
    background: rgb(255 255 255 / 0.02); border: 1px solid var(--stroke);
    transition: background 0.3s, border-color 0.3s;
  }
  button:hover { background: rgb(255 255 255 / 0.05); }
  .on button { background: rgb(124 92 255 / 0.12); border-color: rgb(124 92 255 / 0.45); }
  .btn-ic { flex: none; display: grid; place-items: center; inline-size: 2.2rem; block-size: 2.2rem; border-radius: 50%; color: #fff; background: linear-gradient(180deg, #8d71ff, #6a4bf0); box-shadow: 0 6px 18px -6px rgb(124 92 255 / 0.8); transition: transform 0.3s var(--spring); }
  button:active .btn-ic { transform: scale(0.92); }
  .name { display: flex; flex-direction: column; gap: 0.1rem; min-inline-size: 0; flex: 1; }
  .name b { font-weight: 600; font-size: 0.95rem; }
  .name small { color: var(--muted); font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* an equaliser while it plays (transform only) */
  .eq { flex: none; display: flex; align-items: center; gap: 3px; block-size: 1.4rem; opacity: 0.25; transition: opacity 0.3s; }
  .eq i { inline-size: 3px; block-size: 100%; border-radius: 2px; background: var(--cyan); scale: 1 0.25; }
  .on .eq { opacity: 1; }
  .on .eq i { animation: eq 0.9s ease-in-out infinite alternate; }
  .on .eq i:nth-child(2) { animation-duration: 0.7s; animation-delay: -0.2s; }
  .on .eq i:nth-child(3) { animation-duration: 1.1s; animation-delay: -0.5s; }
  .on .eq i:nth-child(4) { animation-duration: 0.8s; animation-delay: -0.3s; }
  .on .eq i:nth-child(5) { animation-duration: 1s; animation-delay: -0.7s; }
  @keyframes eq { from { scale: 1 0.2; } to { scale: 1 1; } }
  @media (prefers-reduced-motion: reduce) {
    .on .eq i { animation: none; scale: 1 0.6; }
  }
</style>
