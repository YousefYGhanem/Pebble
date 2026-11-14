<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import LanguageSwitch from './LanguageSwitch.svelte'
  import DownloadButton from './DownloadButton.svelte'
  import Icon from './Icon.svelte'

  // A floating glass pill (after 21st.dev's floating glassmorphic navbar): a soft pill slides under the link you
  // point at, and the bar firms up once the page scrolls.
  const n = $derived(site.c.nav)
  const logo = `${import.meta.env.BASE_URL}favicon.svg`
  let scrolled = $state(false)
  let pill = $state<{ x: number; w: number } | null>(null)

  $effect(() => {
    const on = () => (scrolled = scrollY > 12)
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  })
  function point(e: Event) {
    const a = e.currentTarget as HTMLElement
    pill = { x: a.offsetLeft, w: a.offsetWidth }
  }
</script>

<header class="nav" class:scrolled>
  <nav class="bar" aria-label={n.menu}>
    <a class="brand" href="#top"><img src={logo} alt="" width="24" height="24" /><span>Pebble</span></a>
    <ul class="links" onpointerleave={() => (pill = null)}>
      {#if pill}<li class="pill" aria-hidden="true" style:inline-size="{pill.w}px" style:transform="translateX({pill.x}px)"></li>{/if}
      <li><a href="#features" onpointerenter={point} onfocus={point}>{n.features}</a></li>
      <li><a href="#get-started" onpointerenter={point} onfocus={point}>{n.how}</a></li>
      <li><a href="#faq" onpointerenter={point} onfocus={point}>{n.faq}</a></li>
    </ul>
    <div class="end">
      <LanguageSwitch />
      <a class="gh" href="https://github.com/YousefYGhanem/Pebble" rel="noopener" aria-label={n.github}><Icon name="github" size={18} /></a>
      <span class="dl"><DownloadButton compact /></span>
    </div>
  </nav>
</header>

<style>
  .nav {
    position: fixed; inset-block-start: 0.75rem; inset-inline: 0; z-index: 50;
    padding-inline: clamp(0.75rem, 3vw, 1.5rem);
    pointer-events: none;
  }
  .bar {
    pointer-events: auto;
    display: flex; align-items: center; gap: 1rem;
    max-inline-size: 64rem; margin-inline: auto; block-size: 3.25rem;
    padding-inline: 0.9rem 0.45rem;
    border-radius: 999px;
    border: 1px solid transparent;
    background: rgb(12 11 19 / 0.35);
    backdrop-filter: blur(16px) saturate(1.5);
    -webkit-backdrop-filter: blur(16px) saturate(1.5);
    transition: background 0.4s, border-color 0.4s, box-shadow 0.4s, max-inline-size 0.6s var(--ease-out);
  }
  .scrolled .bar {
    max-inline-size: 58rem;
    background: rgb(12 11 19 / 0.72);
    border-color: var(--stroke);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 12px 32px -12px rgb(0 0 0 / 0.7);
  }
  .brand { display: flex; align-items: center; gap: 0.5rem; font-weight: 650; font-size: 0.98rem; letter-spacing: -0.01em; color: var(--text); text-decoration: none; }
  .links { position: relative; display: flex; gap: 0.15rem; list-style: none; margin: 0 auto; padding: 0; }
  .links a { position: relative; z-index: 1; display: block; padding: 0.4rem 0.85rem; border-radius: 999px; color: var(--muted); text-decoration: none; font-size: 0.88rem; transition: color 0.2s; }
  .links a:hover, .links a:focus-visible { color: var(--text); }
  /* offsetLeft is measured from the left in both directions, so the pill is placed from the physical left */
  .pill {
    position: absolute; inset-block: 0; left: 0; border-radius: 999px;
    background: rgb(255 255 255 / 0.07); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
    transition: transform 0.45s var(--spring), inline-size 0.45s var(--spring);
    animation: pill-in 0.2s ease;
  }
  @keyframes pill-in { from { opacity: 0; } }
  .end { display: flex; align-items: center; gap: 0.5rem; margin-inline-start: auto; }
  .links + .end { margin-inline-start: 0; }
  .gh { display: grid; place-items: center; inline-size: 2.25rem; block-size: 2.25rem; border-radius: 50%; color: var(--muted); transition: color 0.2s, background 0.2s; }
  .gh:hover { color: var(--text); background: rgb(255 255 255 / 0.07); }
  @media (max-width: 820px) { .links { display: none; } .links + .end { margin-inline-start: auto; } }
  @media (max-width: 560px) { .dl { display: none; } .bar { padding-inline-end: 0.35rem; } }
</style>
