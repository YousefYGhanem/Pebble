<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { reveal, glow } from '../lib/motion'

  const how = $derived(site.c.how)
</script>

<section class="how" id="get-started" aria-labelledby="how-title">
  <div class="container">
    <header class="head" use:reveal>
      <p class="kicker">{how.kicker}</p>
      <h2 id="how-title">{how.title}</h2>
    </header>
    <ol class="steps">
      {#each how.steps as s, i (i)}
        <li class="bezel" use:reveal={i * 120} use:glow>
          <div class="bezel-in card">
            <div class="top">
              <span class="n" dir="ltr">0{i + 1}</span>
              <span class="rule" aria-hidden="true"></span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        </li>
      {/each}
    </ol>
  </div>
</section>

<style>
  .how { padding-block: var(--section-pad); scroll-margin-top: var(--nav-h); }
  .head { text-align: center; margin-block-end: 3.5rem; }
  .steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
  .card { padding: 1.5rem 1.5rem 1.75rem; }
  .top { display: flex; align-items: center; gap: 0.9rem; margin-block-end: 2.25rem; }
  .n {
    display: grid; place-items: center; inline-size: 2.5rem; block-size: 2.5rem; border-radius: 0.7rem;
    font-family: var(--mono); font-size: 0.85rem; color: #e6e0ff;
    background: linear-gradient(180deg, rgb(124 92 255 / 0.25), rgb(124 92 255 / 0.08));
    border: 1px solid rgb(185 168 255 / 0.25); box-shadow: var(--highlight);
  }
  .rule { flex: 1; block-size: 1px; background: linear-gradient(90deg, var(--stroke-strong), transparent); }
  :global([dir='rtl']) .rule { background: linear-gradient(-90deg, var(--stroke-strong), transparent); }
  h3 { margin: 0 0 0.6rem; font-size: 1.2rem; font-weight: 600; letter-spacing: -0.02em; }
  :global(:lang(ar)) h3 { letter-spacing: 0; }
  p { margin: 0; color: var(--muted); line-height: 1.65; font-size: 0.95rem; }
  @media (max-width: 860px) { .steps { grid-template-columns: 1fr; } .top { margin-block-end: 1.25rem; } }
</style>
