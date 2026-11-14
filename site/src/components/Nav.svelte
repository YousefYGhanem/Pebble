<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import LanguageSwitch from './LanguageSwitch.svelte'
  import Icon from './Icon.svelte'

  const n = $derived(site.c.nav)
  const logo = `${import.meta.env.BASE_URL}favicon.svg`
</script>

<header class="nav">
  <nav class="bar container" aria-label={n.menu}>
    <a class="brand" href="#top"><img src={logo} alt="" width="28" height="28" /><span>Pebble</span></a>
    <ul class="links">
      <li><a href="#features">{n.features}</a></li>
      <li><a href="#get-started">{n.how}</a></li>
      <li><a href="#faq">{n.faq}</a></li>
    </ul>
    <div class="end">
      <LanguageSwitch />
      <a class="gh" href="https://github.com/YousefYGhanem/Pebble" rel="noopener" aria-label={n.github}><Icon name="github" size={20} /></a>
    </div>
  </nav>
</header>

<style>
  .nav {
    position: fixed; inset-block-start: 0; inset-inline: 0; z-index: 50;
    background: linear-gradient(to bottom, rgb(7 6 13 / 0.94), rgb(7 6 13 / 0.86));
    backdrop-filter: blur(14px) saturate(1.4);
    -webkit-backdrop-filter: blur(14px) saturate(1.4);
    border-block-end: 1px solid rgb(255 255 255 / 0.06);
  }
  .bar { display: flex; align-items: center; gap: 1.5rem; block-size: var(--nav-h); }
  .brand { display: flex; align-items: center; gap: 0.55rem; font-weight: 700; font-size: 1.05rem; color: var(--text); text-decoration: none; }
  .links { display: flex; gap: 1.6rem; list-style: none; margin: 0 auto; padding: 0; }
  .links a { color: var(--muted); text-decoration: none; font-size: 0.92rem; transition: color 0.2s; }
  .links a:hover { color: var(--text); }
  .end { display: flex; align-items: center; gap: 0.75rem; margin-inline-start: auto; }
  .links + .end { margin-inline-start: 0; }
  .gh { display: grid; place-items: center; inline-size: 2.25rem; block-size: 2.25rem; border-radius: 50%; color: var(--muted); transition: color 0.2s, background 0.2s; }
  .gh:hover { color: var(--text); background: rgb(255 255 255 / 0.07); }
  @media (max-width: 760px) { .links { display: none; } .links + .end { margin-inline-start: auto; } }
</style>
