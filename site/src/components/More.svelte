<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { reveal, spotlight } from '../lib/motion'
  import Icon from './Icon.svelte'

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
        <li class="card" use:reveal={(i % 4) * 70} use:spotlight>
          <span class="ic"><Icon name={item.icon} size={20} /></span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .more { padding-block: var(--section-pad); }
  .head { text-align: center; max-inline-size: 42rem; margin: 0 auto 3rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15.5rem), 1fr)); gap: 0.9rem; list-style: none; margin: 0; padding: 0; }
  .card {
    position: relative; padding: 1.3rem 1.3rem 1.4rem; border-radius: 1.2rem;
    background: rgb(255 255 255 / 0.03); border: 1px solid var(--stroke);
    overflow: hidden; isolation: isolate;
    transition: border-color 0.3s, transform 0.5s var(--ease-out), opacity 0.8s var(--ease-out), translate 0.8s var(--ease-out);
  }
  .card::before {
    content: ''; position: absolute; inset: 0; z-index: -1; opacity: 0; transition: opacity 0.3s;
    background: radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgb(124 92 255 / 0.2), transparent 70%);
  }
  .card:hover { border-color: rgb(185 168 255 / 0.3); transform: translateY(-3px); }
  .card:hover::before { opacity: 1; }
  .ic { display: grid; place-items: center; inline-size: 2.4rem; block-size: 2.4rem; border-radius: 0.75rem; color: var(--accent-text); background: rgb(124 92 255 / 0.12); border: 1px solid rgb(124 92 255 / 0.25); }
  h3 { font-size: 1.02rem; margin: 0.9rem 0 0.35rem; }
  p { margin: 0; color: var(--muted); font-size: 0.92rem; line-height: 1.55; }
</style>
