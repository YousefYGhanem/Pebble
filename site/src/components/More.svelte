<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { reveal, glow } from '../lib/motion'
  import Icon from './Icon.svelte'

  // The little things as a bento grid (after the Glowing Effect demo on 21st.dev): double-bezel cards whose border
  // lights up toward the pointer. Every fifth card is wide, so 20 items fill 4 columns (and 2) with no hole.
  const m = $derived(site.c.more)
</script>

<section class="more" aria-labelledby="more-title">
  <div class="container">
    <header class="head" use:reveal>
      <p class="kicker">{m.kicker}</p>
      <h2 id="more-title">{m.title}</h2>
      <p class="lead">{m.lead}</p>
    </header>
    <ul class="grid">
      {#each m.items as item, i (i)}
        <li class="bezel cell" class:wide={i % 5 === 0} use:reveal={(i % 4) * 60} use:glow>
          <div class="bezel-in card">
            <span class="ic"><Icon name={item.icon} size={18} /></span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .more { padding-block: var(--section-pad); }
  .head { text-align: center; max-inline-size: 42rem; margin: 0 auto 3.5rem; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-flow: dense; gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
  .wide { grid-column: span 2; }
  .cell { --r-lg: 1.25rem; padding: 0.3rem; }
  .card { display: flex; flex-direction: column; justify-content: space-between; gap: 1.5rem; min-block-size: 11.5rem; padding: 1.25rem; }
  .wide .card { background: radial-gradient(90% 120% at 100% 0%, rgb(124 92 255 / 0.1), transparent 60%), linear-gradient(180deg, var(--surface-2), var(--surface)); }
  :global([dir='rtl']) .wide .card { background: radial-gradient(90% 120% at 0% 0%, rgb(124 92 255 / 0.1), transparent 60%), linear-gradient(180deg, var(--surface-2), var(--surface)); }
  .ic { display: grid; place-items: center; inline-size: 2.25rem; block-size: 2.25rem; border-radius: 0.6rem; color: #d6d3e6; border: 1px solid var(--stroke-strong); background: rgb(255 255 255 / 0.03); box-shadow: var(--highlight); }
  .card h3 { font-size: 1.02rem; font-weight: 600; letter-spacing: -0.015em; margin: 0 0 0.4rem; }
  .wide h3 { font-size: 1.2rem; }
  :global(:lang(ar)) h3 { letter-spacing: 0; }
  .card p { margin: 0; color: var(--muted); font-size: 0.9rem; line-height: 1.55; }
  .wide p { max-inline-size: 26rem; font-size: 0.95rem; }
  @media (max-width: 960px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) {
    .grid { grid-template-columns: 1fr; }
    .wide { grid-column: auto; }
    .card { min-block-size: 0; flex-direction: row; align-items: flex-start; gap: 1rem; }
    .ic { flex: none; }
  }
</style>
