<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { inView, reducedMotion } from '../lib/motion'
  import { buddy } from '../lib/buddy.svelte'
  import IslandDemo, { type IslandState } from './IslandDemo.svelte'
  import DownloadButton from './DownloadButton.svelte'
  import StoreButton from './StoreButton.svelte'

  const h = $derived(site.c.hero)
  const d = $derived(site.c.demo)
  const words = $derived(h.title.split(' '))

  // The demo plays an agent's turn on a loop and waits for you at the question (it answers itself after a while).
  let phase = $state<IslandState>('resting')
  let loved = $state(false)
  let visible = false
  let timer = 0
  const NEXT: Partial<Record<IslandState, [IslandState, number]>> = {
    resting: ['working', 2600],
    working: ['ask', 3400],
    ask: ['done', 9000],
    done: ['resting', 3800],
    stopped: ['resting', 3400]
  }
  function schedule() {
    clearTimeout(timer)
    const next = NEXT[phase]
    if (!visible || !next) return
    timer = window.setTimeout(() => go(next[0]), next[1])
  }
  function go(s: IslandState) {
    if (s === 'resting' || s === 'working') loved = false
    phase = s
    schedule()
  }
  function answer(allow: boolean) {
    loved = allow
    go(allow ? 'done' : 'stopped')
  }
  $effect(() => () => clearTimeout(timer))

  const shown = $derived({
    working: phase !== 'resting',
    ask: phase === 'ask' || phase === 'done' || phase === 'stopped',
    done: phase === 'done',
    stopped: phase === 'stopped'
  })
</script>

<section class="hero" id="top" aria-labelledby="hero-title" use:inView={{ onchange: v => (buddy.show = !v), margin: '0px 0px -35% 0px' }}>
  <div class="container copy">
    <p class="eyebrow intro" style="--i: 0">{h.eyebrow}</p>
    <h1 id="hero-title">
      {#each words as w, i (i + w)}<span class="word" style="--i: {i + 1}">{w}</span>{' '}{/each}
    </h1>
    <p class="lead intro" style="--i: {words.length + 1}">{h.lead}</p>
    <div class="ctas intro" style="--i: {words.length + 2}">
      <DownloadButton />
      <StoreButton />
    </div>
    <p class="small intro" style="--i: {words.length + 3}">{h.small}</p>
  </div>

  <div class="container">
    <div class="stage" use:inView={{ onchange: v => { visible = v; schedule() }, threshold: 0.15 }}>
      <div class="screen">
        <div class="wallpaper" aria-hidden="true"></div>
        <div class="drop">
          <IslandDemo state={phase} {loved} interactive hello={!reducedMotion()} onanswer={answer} />
        </div>
        <div class="term" aria-hidden="true">
          <div class="term-bar"><i></i><i></i><i></i><span>{d.terminal.title}</span></div>
          <div class="term-body" dir="ltr">
            <p class="you"><span class="caret">›</span> {d.terminal.prompt}</p>
            {#if shown.working}
              {#each d.terminal.working as line, i (line)}<p class="step" style="--i: {i}">● {line}</p>{/each}
            {/if}
            {#if shown.ask}<p class="warn">? {d.terminal.ask}</p>{/if}
            {#if shown.done}
              {#each d.terminal.done as line, i (line)}<p class="ok" style="--i: {i + 1}">✓ {line}</p>{/each}
            {/if}
            {#if shown.stopped}<p class="bad">✗ {d.terminal.denied}</p>{/if}
            <p class="cursor"><span></span></p>
          </div>
        </div>
      </div>
      <p class="hint" class:on={phase === 'ask'}>{d.hint}</p>
    </div>
  </div>

  <div class="works">
    <span class="works-label">{h.worksWith}</span>
    <div class="marquee">
      <ul class="track">
        {#each [...h.agents, ...h.agents] as a, i (i)}<li aria-hidden={i >= h.agents.length}>{a}</li>{/each}
      </ul>
    </div>
  </div>
</section>

<style>
  .hero { position: relative; padding-block: calc(var(--nav-h) + clamp(2.5rem, 7vw, 5.5rem)) 2rem; text-align: center; }
  .copy { display: flex; flex-direction: column; align-items: center; }
  .eyebrow { margin: 0 0 1.25rem; padding: 0.35rem 0.9rem; border-radius: 999px; font-size: 0.85rem; color: var(--accent-text); background: rgb(124 92 255 / 0.12); border: 1px solid rgb(124 92 255 / 0.3); }
  h1 {
    margin: 0;
    max-inline-size: 15ch;
    font-size: clamp(2.5rem, 7.2vw, 5.4rem);
    line-height: 1.02;
    letter-spacing: -0.035em;
    font-weight: 700;
  }
  :global(:lang(ar)) h1 { letter-spacing: 0; line-height: 1.25; max-inline-size: 16ch; }
  .word {
    display: inline-block;
    padding-block: 0.06em 0.14em;
    margin-block: -0.06em -0.14em;
    background: linear-gradient(180deg, #fff 30%, #c9bcff);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    animation: rise 0.9s var(--ease-out) both;
    animation-delay: calc(0.35s + var(--i) * 0.06s);
  }
  .intro { animation: rise 0.9s var(--ease-out) both; animation-delay: calc(0.35s + var(--i) * 0.06s); }
  @keyframes rise { from { opacity: 0; translate: 0 0.5em; filter: blur(8px); } }
  .lead { max-inline-size: 38rem; margin: 1.5rem 0 2rem; font-size: clamp(1.05rem, 2vw, 1.25rem); color: var(--muted); line-height: 1.6; }
  .ctas { display: flex; flex-wrap: wrap; gap: 0.85rem; justify-content: center; }
  .small { margin: 1.1rem 0 0; color: var(--muted); font-size: 0.85rem; }

  .stage {
    margin-block-start: clamp(3rem, 7vw, 5rem);
    perspective: 1400px;
  }
  .screen {
    position: relative;
    margin-inline: auto;
    max-inline-size: 980px;
    block-size: clamp(380px, 46vw, 500px);
    border-radius: 1.6rem;
    border: 1px solid rgb(255 255 255 / 0.1);
    background: #0b0a12;
    box-shadow: 0 60px 120px -40px rgb(124 92 255 / 0.45), 0 30px 60px -30px rgb(0 0 0 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.08);
    overflow: hidden;
    transform-origin: 50% 0;
  }
  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      .screen { animation: tilt linear both; animation-timeline: view(); animation-range: entry 0% cover 45%; }
      @keyframes tilt { from { transform: rotateX(16deg) scale(0.94); opacity: 0.6; } to { transform: none; opacity: 1; } }
    }
  }
  .wallpaper {
    position: absolute; inset: -20%;
    background:
      radial-gradient(40% 50% at 25% 30%, rgb(124 92 255 / 0.45), transparent 70%),
      radial-gradient(35% 45% at 80% 70%, rgb(83 228 255 / 0.22), transparent 70%),
      radial-gradient(50% 60% at 60% 10%, rgb(185 168 255 / 0.18), transparent 70%);
  }
  .drop { position: relative; padding-block-start: 0.9rem; --island-size: clamp(11px, 2.4vw, 15px); animation: drop 1.1s var(--spring) 0.15s both; }
  @keyframes drop { from { translate: 0 -160%; opacity: 0; } 40% { opacity: 1; } }

  .term {
    position: absolute; inset-inline: 0; margin-inline: auto; inset-block-end: 1.5rem;
    inline-size: min(600px, calc(100% - 2rem));
    border-radius: 0.9rem;
    background: rgb(14 13 21 / 0.78);
    border: 1px solid rgb(255 255 255 / 0.09);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 30px 60px -20px rgb(0 0 0 / 0.8);
    text-align: start;
    overflow: hidden;
  }
  .term-bar { display: flex; align-items: center; gap: 6px; padding: 0.55rem 0.8rem; border-block-end: 1px solid rgb(255 255 255 / 0.06); font-size: 0.75rem; color: var(--muted); }
  .term-bar i { inline-size: 10px; block-size: 10px; border-radius: 50%; background: rgb(255 255 255 / 0.14); }
  .term-bar span { margin-inline-start: 0.5rem; }
  .term-body { padding: 0.8rem 1rem 1rem; font: 0.8rem/1.65 ui-monospace, 'Cascadia Code', Consolas, monospace; min-block-size: 11.5em; text-align: left; }
  .term-body p { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: type 0.45s var(--ease-out) both; animation-delay: calc(var(--i, 0) * 0.35s); }
  @keyframes type { from { opacity: 0; translate: -0.6em 0; } }
  .you { color: #fff; }
  .caret { color: var(--accent-text); }
  .step { color: #9fb4ff; }
  .warn { color: #fbbf24; }
  .ok { color: #4ade80; }
  .bad { color: #f87171; }
  .cursor span { display: inline-block; inline-size: 0.55em; block-size: 1.05em; vertical-align: -0.15em; background: rgb(255 255 255 / 0.7); animation: blink 1.1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }

  .hint { margin: 1rem 0 0; color: var(--muted); font-size: 0.9rem; opacity: 0.75; transition: opacity 0.4s, color 0.4s; }
  .hint.on { opacity: 1; color: var(--accent-text); }

  .works { display: flex; align-items: center; gap: 1.25rem; max-inline-size: 980px; margin: 3.5rem auto 0; padding-inline: 1rem; }
  .works-label { flex: none; color: var(--muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.12em; }
  :global(:lang(ar)) .works-label { text-transform: none; letter-spacing: 0; }
  .marquee { overflow: hidden; flex: 1; mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
  .track { display: flex; gap: 2.5rem; inline-size: max-content; margin: 0; padding: 0; list-style: none; animation: marquee 32s linear infinite; }
  .track li { color: #cfcde0; font-weight: 600; font-size: 1.05rem; white-space: nowrap; opacity: 0.85; }
  .marquee:hover .track { animation-play-state: paused; }
  @keyframes marquee { to { transform: translateX(calc(-50% - 1.25rem)); } }
  :global([dir='rtl']) .track { animation-name: marquee-rtl; }
  @keyframes marquee-rtl { to { transform: translateX(calc(50% + 1.25rem)); } }
  @media (prefers-reduced-motion: reduce) {
    .track { animation: none; flex-wrap: wrap; inline-size: auto; justify-content: center; gap: 0.5rem 1.5rem; }
    .track li[aria-hidden='true'] { display: none; }
    .marquee { mask-image: none; }
  }
  @media (max-width: 640px) {
    .works { flex-direction: column; gap: 0.75rem; }
    .term-body { font-size: 0.7rem; }
  }
</style>
