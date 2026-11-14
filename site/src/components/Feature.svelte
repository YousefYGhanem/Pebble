<script lang="ts">
  import type { Feature } from '../../content/types'
  import { inView, reveal } from '../lib/motion'
  import { buddy } from '../lib/buddy.svelte'
  import Icon from './Icon.svelte'
  import Shot from './Shot.svelte'
  import Live from '../live/Live.svelte'

  // One feature: text on one side, its live demo and real captures on the other (sides alternate).
  let { f, flip = false }: { f: Feature; flip?: boolean } = $props()
  const hasVisual = $derived(!!f.live || !!f.shots?.length)
</script>

<section class="feature" class:flip class:solo={!hasVisual} id={f.id} aria-labelledby="{f.id}-title"
  use:inView={{ onchange: v => { if (v && f.mood) buddy.mood = f.mood }, margin: '-40% 0px -40% 0px' }}>
  <div class="container inner">
    <div class="text">
      <p class="kicker" use:reveal><Icon name={f.icon} size={18} />{f.kicker}</p>
      <h3 id="{f.id}-title" use:reveal={60}>{f.title}</h3>
      <p class="body" use:reveal={120}>{f.text}</p>
      <ul class="points">
        {#each f.points as p, i (i)}
          <li use:reveal={160 + i * 60}><span class="tick"><Icon name="check" size={14} /></span>{p}</li>
        {/each}
      </ul>
    </div>
    {#if hasVisual}
      <div class="visual" use:reveal={100}>
        <div class="halo" aria-hidden="true"></div>
        {#if f.live}<Live {f} />{/if}
        {#each f.shots ?? [] as s (s.src)}<Shot shot={s} />{/each}
      </div>
    {:else}
      <div class="orb" use:reveal={100} aria-hidden="true">
        <span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span>
        <span class="core"><Icon name={f.icon} size={56} /></span>
      </div>
    {/if}
  </div>
</section>

<style>
  .feature { padding-block: clamp(3.5rem, 9vw, 7rem); position: relative; scroll-margin-top: var(--nav-h); }
  .inner { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: clamp(2rem, 6vw, 5.5rem); align-items: center; }
  /* the visual keeps the wider column on either side */
  .flip .inner { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); }
  .flip .text { order: 2; }
  .kicker { display: inline-flex; align-items: center; gap: 0.5rem; }
  h3 { font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.08; letter-spacing: -0.03em; margin: 0.6rem 0 1rem; font-weight: 700; }
  :global(:lang(ar)) h3 { letter-spacing: 0; line-height: 1.3; }
  .body { color: var(--muted); font-size: 1.1rem; line-height: 1.7; margin: 0 0 1.5rem; }
  .points { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
  .points li { display: flex; gap: 0.7rem; align-items: flex-start; line-height: 1.5; color: #dedced; }
  .tick { flex: none; display: grid; place-items: center; inline-size: 1.4rem; block-size: 1.4rem; margin-block-start: 0.05rem; border-radius: 50%; background: rgb(124 92 255 / 0.18); color: var(--accent-text); }
  .visual { position: relative; display: grid; gap: 1.5rem; }
  .halo { position: absolute; inset: -10% -5%; z-index: -1; background: radial-gradient(50% 50% at 50% 50%, rgb(124 92 255 / 0.22), transparent 70%); filter: blur(10px); }

  .solo .inner { grid-template-columns: 1fr auto; }
  .solo.flip .inner { grid-template-columns: auto 1fr; }
  .orb { position: relative; inline-size: clamp(200px, 26vw, 300px); aspect-ratio: 1; display: grid; place-items: center; }
  .core { display: grid; place-items: center; inline-size: 42%; aspect-ratio: 1; border-radius: 50%; color: #fff; background: radial-gradient(circle at 35% 30%, #a08bff, #5b3fd9 60%, #2a1f66); box-shadow: 0 0 80px rgb(124 92 255 / 0.55), inset 0 2px 0 rgb(255 255 255 / 0.3); }
  .ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgb(185 168 255 / 0.25); animation: breathe 6s ease-in-out infinite; }
  .r2 { inset: 12%; animation-delay: -2s; border-color: rgb(83 228 255 / 0.25); }
  .r3 { inset: 24%; animation-delay: -4s; }
  @keyframes breathe { 50% { scale: 1.06; opacity: 0.5; } }

  @media (max-width: 860px) {
    .inner, .flip .inner, .solo .inner, .solo.flip .inner { grid-template-columns: 1fr; }
    .flip .text { order: 0; }
    .orb { margin-inline: auto; inline-size: 200px; }
  }
</style>
