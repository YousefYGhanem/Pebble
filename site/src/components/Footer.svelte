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
