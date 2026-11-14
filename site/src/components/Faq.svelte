<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { reveal } from '../lib/motion'
  import Icon from './Icon.svelte'

  const faq = $derived(site.c.faq)
</script>

<section class="faq" id="faq" aria-labelledby="faq-title">
  <div class="container narrow">
    <header class="head" use:reveal>
      <p class="kicker">{faq.kicker}</p>
      <h2 id="faq-title">{faq.title}</h2>
    </header>
    {#each faq.items as item, i (i)}
      <details use:reveal={i * 50}>
        <summary><span>{item.q}</span><span class="plus"><Icon name="plus" size={18} /></span></summary>
        <p>{item.a}</p>
      </details>
    {/each}
  </div>
</section>

<style>
  .faq { padding-block: var(--section-pad); scroll-margin-top: var(--nav-h); }
  .narrow { max-inline-size: 50rem; }
  .head { text-align: center; margin-block-end: 2.5rem; }
  /* smooth opening where the browser supports it; elsewhere it simply opens */
  details { border-block-end: 1px solid var(--stroke); interpolate-size: allow-keywords; }
  details::details-content { block-size: 0; overflow: hidden; transition: block-size 0.45s var(--ease-out), content-visibility 0.45s allow-discrete; }
  details[open]::details-content { block-size: auto; }
  summary { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.3rem 0.25rem; cursor: pointer; list-style: none; font-size: 1.1rem; font-weight: 600; }
  summary::-webkit-details-marker { display: none; }
  .plus { display: grid; place-items: center; flex: none; inline-size: 2rem; block-size: 2rem; border-radius: 50%; background: rgb(255 255 255 / 0.05); color: var(--accent-text); transition: rotate 0.4s var(--spring), background 0.3s; }
  details[open] .plus { rotate: 45deg; background: rgb(124 92 255 / 0.2); }
  details p { margin: 0; padding: 0 0.25rem 1.4rem; color: var(--muted); line-height: 1.7; max-inline-size: 44rem; }
</style>
