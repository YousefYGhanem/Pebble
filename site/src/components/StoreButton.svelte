<script lang="ts">
  import { site } from '../lib/i18n.svelte'

  // Microsoft's own Store badge (its official artwork, served from this site: no outside script),
  // in the page's language. mode=direct opens the Store app's install window on Windows; elsewhere the web listing.
  const URL = 'https://apps.microsoft.com/detail/9PJNR7CT4ZN7?mode=direct'
  const badge = $derived(`${import.meta.env.BASE_URL}badges/ms-store-${site.lang === 'ar' ? 'ar' : 'en'}.svg`)
</script>

<a class="store" href={URL} target="_blank" rel="noopener">
  <img src={badge} alt={site.c.hero.store} width="161" height="44" />
</a>

<style>
  .store { display: inline-flex; border-radius: 10px; transition: transform 0.3s var(--spring), filter 0.3s; }
  .store img { display: block; block-size: 3.25rem; inline-size: auto; }
  .store:hover { transform: translateY(-2px); filter: drop-shadow(0 8px 22px rgb(124 92 255 / 0.35)); }
  .store:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }
  @media (prefers-reduced-motion: reduce) { .store:hover { transform: none; } }
</style>
