<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { inView, reveal } from '../lib/motion'

  const how = $derived(site.c.how)
  let drawn = $state(false)
</script>

<section class="how" id="get-started" aria-labelledby="how-title">
  <div class="container">
    <header class="head" use:reveal>
      <p class="kicker">{how.kicker}</p>
      <h2 id="how-title">{how.title}</h2>
    </header>
    <div class="wrap" use:inView={{ onchange: v => { if (v) drawn = true }, margin: '0px 0px -30% 0px' }}>
      <span class="line" class:drawn aria-hidden="true"></span>
      <ol class="steps">
        {#each how.steps as s, i (i)}
          <li use:reveal={i * 140}>
            <span class="n">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        {/each}
      </ol>
    </div>
  </div>
</section>

<style>
  .how { padding-block: var(--section-pad); scroll-margin-top: var(--nav-h); }
  .head { text-align: center; margin-block-end: 3.5rem; }
  .wrap { position: relative; }
  .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; list-style: none; margin: 0; padding: 0; }
  .line {
    position: absolute; inset-block-start: 1.6rem; inset-inline: 16%; block-size: 1px;
    background: linear-gradient(90deg, transparent, rgb(185 168 255 / 0.6), transparent);
    transform: scaleX(0); transition: transform 1.4s var(--ease-out) 0.2s;
  }
  .line.drawn { transform: scaleX(1); }
  li { position: relative; text-align: center; padding: 0 1rem; }
  .n {
    display: grid; place-items: center; margin: 0 auto 1.25rem; inline-size: 3.2rem; block-size: 3.2rem; border-radius: 50%;
    font-weight: 700; font-size: 1.2rem; color: #fff;
    background: radial-gradient(circle at 35% 30%, #a08bff, #5b3fd9 70%); box-shadow: 0 0 40px rgb(124 92 255 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.35);
  }
  h3 { margin: 0 0 0.5rem; font-size: 1.25rem; }
  p { margin: 0 auto; max-inline-size: 22rem; color: var(--muted); line-height: 1.6; }
  @media (max-width: 760px) {
    .steps { grid-template-columns: 1fr; gap: 2.5rem; }
    .line { display: none; }
  }
</style>
