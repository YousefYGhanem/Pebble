<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { reveal } from '../lib/motion'

  // Ghost Accordion (21st.dev): borderless, numbered rows, a plus that turns into a cross. Built on <details>,
  // so it opens without script and with the keyboard.
  const faq = $derived(site.c.faq)
</script>

<section class="faq" id="faq" aria-labelledby="faq-title">
  <div class="container wrap">
    <header class="head" use:reveal>
      <p class="kicker">{faq.kicker}</p>
      <h2 id="faq-title">{faq.title}</h2>
    </header>
    <div class="list">
      {#each faq.items as item, i (i)}
        <details use:reveal={i * 50}>
          <summary>
            <span class="n" dir="ltr">{String(i + 1).padStart(2, '0')}</span>
            <span class="q">{item.q}</span>
            <span class="x" aria-hidden="true"></span>
          </summary>
          <p>{item.a}</p>
        </details>
      {/each}
    </div>
  </div>
</section>

<style>
  .faq { padding-block: var(--section-pad); scroll-margin-top: var(--nav-h); }
  .wrap { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: clamp(2rem, 6vw, 5rem); align-items: start; }
  .head { position: sticky; inset-block-start: calc(var(--nav-h) + 2rem); }
  .head h2 { margin-block-start: 1rem; }
  .list { display: grid; gap: 0.25rem; }
  /* smooth opening where the browser supports it; elsewhere it simply opens */
  details { border-radius: var(--r-md); transition: background 0.3s; interpolate-size: allow-keywords; }
  details:hover, details[open] { background: rgb(255 255 255 / 0.025); }
  details::details-content { block-size: 0; overflow: hidden; transition: block-size 0.45s var(--ease-out), content-visibility 0.45s allow-discrete; }
  details[open]::details-content { block-size: auto; }
  summary { display: flex; align-items: baseline; gap: 1.1rem; padding: 1.2rem 1.25rem; cursor: pointer; list-style: none; font-size: 1.05rem; font-weight: 550; border-radius: inherit; }
  summary::-webkit-details-marker { display: none; }
  .n { flex: none; font-family: var(--mono); font-size: 0.78rem; color: var(--faint); transition: color 0.3s; }
  details[open] .n { color: var(--accent-text); }
  .q { flex: 1; }
  /* the plus, drawn with two bars so it can turn into a cross */
  .x { position: relative; flex: none; align-self: center; inline-size: 0.85rem; block-size: 0.85rem; transition: rotate 0.45s var(--spring); }
  .x::before, .x::after { content: ''; position: absolute; inset-block-start: 50%; inset-inline: 0; block-size: 1.5px; margin-block-start: -0.75px; border-radius: 1px; background: var(--muted); transition: background 0.3s; }
  .x::after { rotate: 90deg; }
  details[open] .x { rotate: 45deg; }
  details[open] .x::before, details[open] .x::after { background: var(--text); }
  details p { margin: 0; padding-block: 0 1.4rem; padding-inline: calc(1.25rem + 1.1rem + 1.4rem) 1.25rem; color: var(--muted); line-height: 1.7; }
  @media (max-width: 860px) {
    .wrap { grid-template-columns: 1fr; }
    .head { position: static; text-align: center; }
    details p { padding-inline-start: 1.25rem; }
  }
</style>
