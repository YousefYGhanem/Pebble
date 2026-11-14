<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { inView, reveal } from '../lib/motion'
  import IslandDemo from './IslandDemo.svelte'

  // Scrollytelling: the step in the middle of the screen decides the island's state. No scroll listener needed.
  const story = $derived(site.c.story)
  let active = $state(0)
  const phase = $derived(story.steps[active]?.state ?? 'resting')
</script>

<section class="story" aria-labelledby="story-title">
  <div class="container">
    <header class="head" use:reveal>
      <p class="kicker">{story.kicker}</p>
      <h2 id="story-title">{story.title}</h2>
    </header>
    <div class="grid">
      <div class="sticky">
        <div class="bezel frame">
        <div class="bezel-in stage" data-state={phase}>
          <div class="glow" aria-hidden="true"></div>
          <div class="bar" aria-hidden="true"></div>
          <div class="island"><IslandDemo state={phase} /></div>
          <ol class="dots" aria-hidden="true">
            {#each story.steps as _, i (i)}<li class:on={i === active}></li>{/each}
          </ol>
        </div>
        </div>
      </div>
      <ol class="steps">
        {#each story.steps as step, i (i)}
          <li class="step" class:on={i === active} use:inView={{ onchange: v => { if (v) active = i }, margin: '-45% 0px -45% 0px' }}>
            <span class="n" dir="ltr">0{i + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        {/each}
      </ol>
    </div>
  </div>
</section>

<style>
  .story { padding-block: var(--section-pad); }
  .head { text-align: center; max-inline-size: 46rem; margin: 0 auto clamp(2rem, 6vw, 4rem); }
  .grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: clamp(2rem, 5vw, 5rem); }
  .sticky { position: relative; order: 2; }
  .frame { position: sticky; inset-block-start: calc(var(--nav-h) + 10vh); block-size: min(60vh, 440px); }
  .stage {
    --tint: rgb(124 92 255 / 0.35);
    background:
      radial-gradient(circle, rgb(255 255 255 / 0.06) 1px, transparent 1.2px) 0 0 / 18px 18px,
      linear-gradient(180deg, var(--surface-2), var(--surface));
  }
  .stage[data-state='working'] { --tint: rgb(59 130 246 / 0.4); }
  .stage[data-state='ask'] { --tint: rgb(245 158 11 / 0.35); }
  .stage[data-state='done'] { --tint: rgb(34 197 94 / 0.35); }
  .glow { position: absolute; inset: 0; background: radial-gradient(60% 55% at 50% 0%, var(--tint), transparent 70%); transition: background 0.8s ease; }
  .bar { position: absolute; inset-block-start: 0; inset-inline: 0; block-size: 2.2rem; background: linear-gradient(rgb(255 255 255 / 0.04), transparent); border-block-end: 1px solid rgb(255 255 255 / 0.04); }
  .island { position: relative; padding-block-start: 1.6rem; --island-size: clamp(12px, 1.6vw, 17px); }
  .dots { position: absolute; inset-block-end: 1.25rem; inset-inline: 0; display: flex; justify-content: center; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
  .dots li { inline-size: 0.4rem; block-size: 0.4rem; border-radius: 999px; background: rgb(255 255 255 / 0.18); transition: inline-size 0.5s var(--spring), background 0.3s; }
  .dots li.on { inline-size: 1.5rem; background: var(--lavender); }

  .steps { order: 1; list-style: none; margin: 0; padding: 0; }
  /* a hairline rail on the start side; the current step lights its part of it */
  .step { position: relative; min-block-size: 62vh; display: flex; flex-direction: column; justify-content: center; padding-inline-start: 1.75rem; opacity: 0.3; transition: opacity 0.5s ease, translate 0.6s var(--ease-out); translate: 0 0.5rem; }
  .step::before { content: ''; position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: 1px; background: var(--stroke); }
  .step::after { content: ''; position: absolute; inset-block: 30%; inset-inline-start: 0; inline-size: 1px; background: linear-gradient(transparent, var(--lavender), transparent); opacity: 0; transition: opacity 0.5s; }
  .step.on { opacity: 1; translate: 0 0; }
  .step.on::after { opacity: 1; }
  .step:first-child { min-block-size: 45vh; justify-content: flex-start; padding-block-start: 10vh; }
  .step:last-child { min-block-size: 70vh; }
  .n { font-family: var(--mono); font-size: 0.8rem; color: var(--faint); letter-spacing: 0.05em; }
  .step.on .n { color: var(--accent-text); }
  h3 { font-size: clamp(1.6rem, 3vw, 2.25rem); font-weight: 650; margin: 0.6rem 0 0.75rem; letter-spacing: -0.03em; }
  :global(:lang(ar)) h3 { letter-spacing: 0; }
  .step p { margin: 0; max-inline-size: 30rem; color: var(--muted); font-size: 1.05rem; line-height: 1.65; }

  @media (max-width: 860px) {
    .grid { grid-template-columns: 1fr; gap: 0; }
    .sticky { order: 0; position: sticky; inset-block-start: var(--nav-h); z-index: 2; padding-block: 0.5rem; }
    .frame { position: relative; inset-block-start: 0; block-size: 210px; background: var(--bg); }
    .step, .step:first-child, .step:last-child { min-block-size: 55vh; justify-content: center; padding-block-start: 0; }
  }
</style>
