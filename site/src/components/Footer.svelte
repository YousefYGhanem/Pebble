<script lang="ts">
  import { site } from '../lib/i18n.svelte'

  const f = $derived(site.c.footer)
  const logo = `${import.meta.env.BASE_URL}favicon.svg`
</script>

<footer class="footer">
  <div class="container inner">
    <div class="brand">
      <span class="name"><img src={logo} alt="" width="26" height="26" />Pebble</span>
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
</footer>

<style>
  .footer { border-block-start: 1px solid var(--stroke); padding-block: 3rem 2.5rem; margin-block-start: 2rem; background: rgb(0 0 0 / 0.25); }
  .inner { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2rem; }
  .name { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.1rem; }
  .brand p { color: var(--muted); max-inline-size: 26rem; margin: 0.6rem 0 0; line-height: 1.6; }
  ul { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; list-style: none; margin: 0; padding: 0; }
  a { color: #d6d4e4; text-decoration: none; }
  a:hover { color: #fff; text-decoration: underline; text-underline-offset: 3px; }
  .legal { margin-block-start: 2.5rem; color: var(--muted); font-size: 0.85rem; line-height: 1.6; }
  .legal p { margin: 0.3rem 0; }
  /* room for the little Pip in the corner */
  @media (max-width: 640px) { .footer { padding-block-end: 5.5rem; } }
</style>
