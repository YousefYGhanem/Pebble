<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { reveal, glow } from '../lib/motion'
  import DownloadButton from './DownloadButton.svelte'
  import StoreButton from './StoreButton.svelte'
  import PipCanvas from './PipCanvas.svelte'

  const cta = $derived(site.c.cta)
  let hover = $state(false)
</script>

<section class="cta" aria-labelledby="cta-title">
  <div class="container">
    <div class="bezel" use:reveal use:glow={{ spread: 60 }}>
      <div class="bezel-in card">
        <div class="field" aria-hidden="true"><span class="line"></span></div>
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
  </div>
</section>

<style>
  .cta { padding-block: var(--section-pad); }
  .bezel { --r-lg: 2rem; padding: 0.5rem; }
  .card { text-align: center; padding: clamp(3rem, 7vw, 5.5rem) 1.5rem; isolation: isolate; }
  /* the hero's lamp, small: a lit edge at the top over a fading grid */
  .field {
    position: absolute; inset: 0; z-index: -1;
    background:
      radial-gradient(50% 45% at 50% 0%, rgb(124 92 255 / 0.28), transparent 75%),
      linear-gradient(rgb(255 255 255 / 0.035) 1px, transparent 1px) 0 0 / 44px 44px,
      linear-gradient(90deg, rgb(255 255 255 / 0.035) 1px, transparent 1px) 0 0 / 44px 44px;
    mask-image: linear-gradient(#000 40%, transparent);
  }
  .line { position: absolute; inset-block-start: 0; inset-inline: 25%; block-size: 1px; background: linear-gradient(90deg, transparent, #d8ceff, transparent); box-shadow: 0 0 14px 1px rgb(185 168 255 / 0.55); }
  .pip { inline-size: 9rem; block-size: 7rem; margin: 0 auto 0.75rem; }
  h2 { margin: 0; }
  .lead { margin: 1rem auto 2.25rem; }
  .ctas { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.75rem; }
  .small { color: var(--faint); font-size: 0.82rem; margin: 1.25rem 0 0; }
</style>
