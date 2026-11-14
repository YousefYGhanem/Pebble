<script lang="ts">
  import { site } from '../lib/i18n.svelte'

  const f = $derived(site.c.footer)
  const logo = `${import.meta.env.BASE_URL}favicon.svg`
</script>

<footer class="footer">
  <div class="container inner">
    <div class="brand">
      <span class="name"><img src={logo} alt="" width="24" height="24" />Pebble</span>
      <p>{f.tagline}</p>
      <a class="dev" href={f.developer.href} rel="noopener">
        <span class="by">{f.developer.madeBy} <b>{f.developer.name}</b></span>
        <span class="cta">{f.developer.cta} <span class="arrow" aria-hidden="true">→</span></span>
      </a>
    </div>
    <nav aria-label="Pebble">
      <ul>
        {#each f.links as l (l.href)}<li><a href={l.href} rel="noopener">{l.label}</a></li>{/each}
      </ul>
    </nav>
  </div>
  <div class="container legal">
    <p>{f.license}</p>
    <p>{f.notAffiliated}</p>
  </div>
  <!-- the name, large and fading into the floor -->
  <div class="word" aria-hidden="true" dir="ltr">Pebble</div>
</footer>

<style>
  .footer { position: relative; overflow: hidden; border-block-start: 1px solid var(--stroke); padding-block: 3.5rem 0; margin-block-start: 2rem; background: linear-gradient(180deg, rgb(255 255 255 / 0.015), transparent 40%); }
  .inner { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2rem; }
  .name { display: flex; align-items: center; gap: 0.5rem; font-weight: 650; font-size: 1.05rem; }
  .brand p { color: var(--muted); max-inline-size: 24rem; margin: 0.75rem 0 0; line-height: 1.6; font-size: 0.92rem; }
  ul { display: flex; flex-wrap: wrap; gap: 0.25rem 0.25rem; list-style: none; margin: 0; padding: 0; }
  a { display: inline-block; padding: 0.35rem 0.7rem; border-radius: 999px; color: #c9c7d6; text-decoration: none; font-size: 0.9rem; transition: color 0.2s, background 0.2s; }
  a:hover { color: #fff; background: rgb(255 255 255 / 0.05); }
  /* who made it: a quiet pill with the way to their page */
  .dev { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.75rem; margin-block-start: 1.25rem; padding: 0.55rem 0.6rem 0.55rem 1rem; border: 1px solid var(--stroke-strong); background: rgb(255 255 255 / 0.03); box-shadow: var(--highlight); }
  .dev .by { color: var(--muted); font-size: 0.88rem; }
  .dev .by b { color: var(--text, #fff); font-weight: 600; }
  .dev .cta { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.75rem; border-radius: 999px; background: rgb(155 135 255 / 0.14); color: #d9d2ff; font-size: 0.85rem; font-weight: 550; }
  .dev .arrow { display: inline-block; transition: translate 0.25s var(--ease-out, ease); }
  :global([dir='rtl']) .dev .arrow { scale: -1 1; }
  .dev:hover { background: rgb(255 255 255 / 0.06); border-color: rgb(155 135 255 / 0.45); }
  .dev:hover .arrow { translate: 0.2rem 0; }
  :global([dir='rtl']) .dev:hover .arrow { translate: -0.2rem 0; }
  .legal::before { content: ''; display: block; border-block-start: 1px solid var(--stroke); margin-block-end: 1.5rem; }
  .legal { margin-block-start: 2.5rem; color: var(--faint); font-size: 0.8rem; line-height: 1.6; }
  .legal p { margin: 0.25rem 0; }
  .word {
    margin-block: 1.5rem -0.22em; text-align: center; user-select: none;
    font: 700 clamp(5rem, 22vw, 17rem)/1 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif; letter-spacing: -0.06em;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.09), rgb(255 255 255 / 0)); -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  /* room for the little Pip in the corner */
  @media (max-width: 640px) { .footer { padding-block-end: 4.5rem; } }
</style>
