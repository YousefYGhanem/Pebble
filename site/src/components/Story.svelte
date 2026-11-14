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
        <div class="stage" data-state={phase}>
          <div class="glow" aria-hidden="true"></div>
          <div class="bar" aria-hidden="true"></div>
          <div class="island"><IslandDemo state={phase} /></div>
          <ol class="dots" aria-hidden="true">
            {#each story.steps as _, i (i)}<li class:on={i === active}></li>{/each}
          </ol>
        </div>
      </div>
      <ol class="steps">
        {#each story.steps as step, i (i)}
          <li class="step" class:on={i === active} use:inView={{ onchange: v => { if (v) active = i }, margin: '-45% 0px -45% 0px' }}>
            <span class="n">0{i + 1}</span>
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
  .stage {
    position: sticky; inset-block-start: calc(var(--nav-h) + 12vh);
    block-size: min(60vh, 440px);
    border-radius: 1.75rem;
    border: 1px solid var(--stroke);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0.01));
    overflow: hidden;
    --tint: rgb(124 92 255 / 0.4);
  }
  .stage[data-state='working'] { --tint: rgb(59 130 246 / 0.45); }
  .stage[data-state='ask'] { --tint: rgb(245 158 11 / 0.4); }
  .stage[data-state='done'] { --tint: rgb(34 197 94 / 0.4); }
  .glow { position: absolute; inset: 0; background: radial-gradient(60% 60% at 50% 15%, var(--tint), transparent 70%); transition: background 0.8s ease; }
  .bar { position: absolute; inset-block-start: 0; inset-inline: 0; block-size: 2.2rem; background: linear-gradient(rgb(255 255 255 / 0.04), transparent); }
  .island { position: relative; padding-block-start: 1.6rem; --island-size: clamp(12px, 1.6vw, 17px); }
  .dots { position: absolute; inset-block-end: 1.25rem; inset-inline: 0; display: flex; justify-content: center; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
  .dots li { inline-size: 0.5rem; block-size: 0.5rem; border-radius: 999px; background: rgb(255 255 255 / 0.2); transition: inline-size 0.5s var(--spring), background 0.3s; }
  .dots li.on { inline-size: 1.6rem; background: var(--accent-text); }

  .steps { order: 1; list-style: none; margin: 0; padding: 0; }
  .step { min-block-size: 62vh; display: flex; flex-direction: column; justify-content: center; opacity: 0.32; transition: opacity 0.5s ease, translate 0.6s var(--ease-out); translate: 0 0.5rem; }
  .step.on { opacity: 1; translate: 0 0; }
  .step:first-child { min-block-size: 45vh; justify-content: flex-start; padding-block-start: 10vh; }
  .step:last-child { min-block-size: 70vh; }
  .n { font-variant-numeric: tabular-nums; color: var(--accent-text); font-weight: 600; letter-spacing: 0.1em; }
  h3 { font-size: clamp(1.6rem, 3.2vw, 2.4rem); margin: 0.5rem 0 0.75rem; letter-spacing: -0.02em; }
  .step p { margin: 0; max-inline-size: 30rem; color: var(--muted); font-size: 1.1rem; line-height: 1.65; }

  @media (max-width: 860px) {
    .grid { grid-template-columns: 1fr; gap: 0; }
    .sticky { order: 0; position: sticky; inset-block-start: var(--nav-h); z-index: 2; padding-block: 0.5rem; }
    .stage { position: relative; inset-block-start: 0; block-size: 210px; background: #0b0a12; }
    .step, .step:first-child, .step:last-child { min-block-size: 55vh; justify-content: center; padding-block-start: 0; }
  }
</style>
