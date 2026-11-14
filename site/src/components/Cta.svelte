<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { reveal } from '../lib/motion'
  import DownloadButton from './DownloadButton.svelte'
  import StoreButton from './StoreButton.svelte'
  import PipCanvas from './PipCanvas.svelte'

  const cta = $derived(site.c.cta)
  let hover = $state(false)
</script>

<section class="cta" aria-labelledby="cta-title">
  <div class="container">
    <div class="card" use:reveal>
      <div class="beam" aria-hidden="true"></div>
      <div class="pip" role="presentation" onpointerenter={() => (hover = true)} onpointerleave={() => (hover = false)}>
        <PipCanvas mood={hover ? 'love' : 'happy'} scale={0.55} />
      </div>
      <h2 id="cta-title">{cta.title}</h2>
      <p class="lead">{cta.lead}</p>
      <div class="ctas">
        <DownloadButton />
        <StoreButton />
      </div>
      <p class="small">{site.c.hero.small}</p>
    </div>
  </div>
</section>

<style>
  .cta { padding-block: var(--section-pad); }
  .card {
    position: relative; overflow: hidden; text-align: center; padding: clamp(2.5rem, 7vw, 5rem) 1.5rem;
    border-radius: 2rem; border: 1px solid rgb(185 168 255 / 0.2);
    background: radial-gradient(80% 90% at 50% 0%, rgb(124 92 255 / 0.35), transparent 70%), rgb(255 255 255 / 0.02);
  }
  .beam { position: absolute; inset-block-start: 0; inset-inline: 20%; block-size: 1px; background: linear-gradient(90deg, transparent, #b9a8ff, #53e4ff, transparent); }
  .pip { inline-size: 9rem; block-size: 7rem; margin: 0 auto 1rem; }
  h2 { margin: 0; }
  .lead { margin: 1rem auto 2rem; }
  .ctas { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.85rem; }
  .small { color: var(--muted); font-size: 0.85rem; margin: 1.2rem 0 0; }
</style>
