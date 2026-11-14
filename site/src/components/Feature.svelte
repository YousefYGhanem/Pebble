<script lang="ts">
  import type { Feature } from '../../content/types'
  import { inView, reveal, glow } from '../lib/motion'
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
      <p class="tag" use:reveal><span class="tag-ic"><Icon name={f.icon} size={15} /></span>{f.kicker}</p>
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
        {#if f.live}<Live {f} />{/if}
        {#if f.shots?.length}
          <div class="bezel" use:glow>
            <div class="bezel-in shots">
              {#each f.shots as s (s.src)}<Shot shot={s} />{/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="bezel orb" use:reveal={100} use:glow aria-hidden="true">
        <div class="bezel-in orb-in">
          <span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span>
          <span class="core"><Icon name={f.icon} size={40} /></span>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .feature { padding-block: clamp(3.5rem, 8vw, 6.5rem); position: relative; scroll-margin-top: var(--nav-h); }
  .inner { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: clamp(2rem, 6vw, 5.5rem); align-items: center; }
  /* the visual keeps the wider column on either side */
  .flip .inner { grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); }
  .flip .text { order: 2; }
  .tag { display: inline-flex; align-items: center; gap: 0.6rem; margin: 0; color: var(--accent-text); font-size: 0.88rem; font-weight: 550; }
  .tag-ic { display: grid; place-items: center; inline-size: 1.85rem; block-size: 1.85rem; border-radius: 0.55rem; color: #d9d2ff; background: linear-gradient(180deg, rgb(124 92 255 / 0.22), rgb(124 92 255 / 0.08)); border: 1px solid rgb(185 168 255 / 0.2); box-shadow: var(--highlight); }
  h3 { font-size: clamp(1.85rem, 3.6vw, 2.75rem); line-height: 1.08; letter-spacing: -0.035em; margin: 1rem 0 1rem; font-weight: 650; }
  :global(:lang(ar)) h3 { letter-spacing: 0; line-height: 1.3; }
  .body { color: var(--muted); font-size: 1.05rem; line-height: 1.7; margin: 0 0 1.75rem; }
  .points { list-style: none; margin: 0; padding: 0; border-block-start: 1px solid var(--stroke); }
  .points li { display: flex; gap: 0.75rem; align-items: flex-start; padding-block: 0.7rem; line-height: 1.5; color: #d4d2e0; font-size: 0.95rem; border-block-end: 1px solid var(--stroke); }
  .tick { flex: none; display: grid; place-items: center; margin-block-start: 0.2rem; color: var(--cyan); opacity: 0.85; }
  .visual { position: relative; display: grid; gap: 1.25rem; min-inline-size: 0; }
  /* the captures stand on a faint dot field, lit from above */
  .shots {
    display: grid; gap: 1rem; padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 3vw, 2rem);
    background:
      radial-gradient(70% 55% at 50% 0%, rgb(124 92 255 / 0.12), transparent 70%),
      radial-gradient(circle, rgb(255 255 255 / 0.07) 1px, transparent 1.2px) 0 0 / 18px 18px,
      linear-gradient(180deg, var(--surface-2), var(--surface));
  }

  .solo .inner { grid-template-columns: 1fr auto; }
  .solo.flip .inner { grid-template-columns: auto 1fr; }
  .orb { inline-size: clamp(220px, 26vw, 300px); aspect-ratio: 1; }
  .orb-in { display: grid; place-items: center; }
  .core { position: relative; display: grid; place-items: center; inline-size: 34%; aspect-ratio: 1; border-radius: 1.25rem; color: #e6e0ff; background: linear-gradient(180deg, #1d1838, #120f22); border: 1px solid rgb(185 168 255 / 0.25); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.1), 0 0 60px -10px rgb(124 92 255 / 0.5); }
  .ring { position: absolute; inset: 14%; border-radius: 50%; border: 1px dashed rgb(255 255 255 / 0.08); }
  .r2 { inset: 26%; border-style: solid; border-color: rgb(185 168 255 / 0.12); }
  .r3 { inset: 2%; border-color: rgb(255 255 255 / 0.05); }

  @media (max-width: 860px) {
    .inner, .flip .inner, .solo .inner, .solo.flip .inner { grid-template-columns: 1fr; }
    .flip .text { order: 0; }
    .orb { margin-inline: auto; inline-size: 220px; }
  }
</style>
