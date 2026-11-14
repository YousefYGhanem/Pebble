<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { inView, reducedMotion, glow } from '../lib/motion'
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
  <div class="lamp" aria-hidden="true">
    <span class="grid"></span>
    <span class="cone l"></span><span class="cone r"></span>
    <span class="haze"></span><span class="core"></span><span class="line"></span>
  </div>
  <div class="container copy">
    <p class="eyebrow intro" style="--i: 0"><span class="live-dot"></span>{h.eyebrow}</p>
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
      <div class="bezel frame" use:glow={{ spread: 60 }}>
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
      </div>
      <p class="hint" class:on={phase === 'ask'}>{d.hint}</p>
    </div>
  </div>

  <div class="container">
    <div class="works">
      <span class="works-label">{h.worksWith}</span>
      <div class="marquee">
        <ul class="track">
          {#each [...h.agents, ...h.agents] as a, i (i)}<li aria-hidden={i >= h.agents.length}>{a}</li>{/each}
        </ul>
      </div>
    </div>
  </div>
</section>

<style>
  .hero { position: relative; padding-block: calc(var(--nav-h) + clamp(3rem, 8vw, 6rem)) 2rem; text-align: center; isolation: isolate; }
  .copy { display: flex; flex-direction: column; align-items: center; }

  /* Lamp (21st.dev): two cones of light fall from the ends of a bright line, with a haze and a hot core under it.
     Recoloured lavender, drawn once (no loop); it opens like the original, the line and cones widening in. */
  .lamp { position: absolute; z-index: -1; inset-block-start: 0; inset-inline: 0; block-size: 46rem; overflow: hidden; pointer-events: none; --lamp: #8b6dff; --y: 5.25rem; }
  .lamp span { position: absolute; display: block; }
  .grid {
    inset: 0;
    background-image: linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px);
    background-size: 56px 56px; background-position: center top;
    mask-image: radial-gradient(60% 55% at 50% 0%, #000 20%, transparent 75%);
  }
  /* physical left/right on purpose: the lamp is symmetric */
  .cone { inset-block-start: var(--y); inline-size: 30rem; block-size: 15rem; opacity: 0.55; animation: lamp-open 1.1s var(--ease-out) 0.25s both; mask-composite: intersect; }
  .cone.l { right: 50%; transform-origin: right top; background: conic-gradient(from 70deg at 50% 0%, var(--lamp), transparent 50%); mask-image: linear-gradient(to top, transparent, #000 75%), linear-gradient(to right, transparent, #000 45%); }
  .cone.r { left: 50%; transform-origin: left top; background: conic-gradient(from 290deg at 50% 0%, transparent 50%, var(--lamp)); mask-image: linear-gradient(to top, transparent, #000 75%), linear-gradient(to left, transparent, #000 45%); }
  .haze { inset-block-start: calc(var(--y) - 4.5rem); left: 50%; inline-size: 28rem; block-size: 9rem; margin-left: -14rem; border-radius: 50%; background: var(--lamp); opacity: 0.3; filter: blur(48px); }
  .core { inset-block-start: calc(var(--y) - 3rem); left: 50%; inline-size: 16rem; block-size: 6rem; margin-left: -8rem; border-radius: 50%; background: #a993ff; opacity: 0.45; filter: blur(28px); animation: lamp-open 1.1s var(--ease-out) 0.25s both; }
  .line { inset-block-start: var(--y); left: 50%; inline-size: 30rem; block-size: 1px; margin-left: -15rem; background: linear-gradient(90deg, transparent, #cfc3ff 20%, #fff 50%, #cfc3ff 80%, transparent); box-shadow: 0 0 12px 1px rgb(185 168 255 / 0.6); animation: lamp-open 1.1s var(--ease-out) 0.25s both; }
  @keyframes lamp-open { from { transform: scaleX(0.5); opacity: 0.2; } }
  @media (max-width: 640px) {
    .lamp { --y: 4.75rem; }
    .cone { inline-size: 15rem; block-size: 11rem; }
    .line { inline-size: 18rem; margin-left: -9rem; }
    .haze { inline-size: 18rem; margin-left: -9rem; }
  }

  .eyebrow {
    display: inline-flex; align-items: center; gap: 0.55rem;
    margin: 0 0 1.6rem; padding: 0.32rem 0.85rem 0.32rem 0.7rem; border-radius: 999px;
    font-size: 0.82rem; color: #d6d3e6;
    background: rgb(14 13 21 / 0.6); border: 1px solid var(--stroke-strong); box-shadow: var(--highlight);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  }
  .live-dot { inline-size: 0.4rem; block-size: 0.4rem; border-radius: 50%; background: #4ade80; box-shadow: 0 0 0 3px rgb(74 222 128 / 0.18); }
  h1 {
    margin: 0;
    max-inline-size: 14ch;
    font-size: clamp(2.6rem, 7vw, 5.25rem);
    line-height: 1;
    letter-spacing: -0.045em;
    font-weight: 650;
  }
  :global(:lang(ar)) h1 { letter-spacing: 0; line-height: 1.25; max-inline-size: 16ch; }
  /* one neutral fade, top to bottom, instead of a coloured gradient */
  .word {
    display: inline-block;
    padding-block: 0.06em 0.14em;
    margin-block: -0.06em -0.14em;
    background: linear-gradient(180deg, #fff 35%, #b4b1c4);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    animation: rise 0.9s var(--ease-out) both;
    animation-delay: calc(0.35s + var(--i) * 0.06s);
  }
  .intro { animation: rise 0.9s var(--ease-out) both; animation-delay: calc(0.35s + var(--i) * 0.06s); }
  @keyframes rise { from { opacity: 0; translate: 0 0.5em; filter: blur(8px); } }
  .lead { max-inline-size: 36rem; margin: 1.5rem 0 2.25rem; font-size: clamp(1.05rem, 1.9vw, 1.2rem); color: var(--muted); line-height: 1.6; }
  .ctas { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; align-items: center; }
  .small { margin: 1.25rem 0 0; color: var(--faint); font-size: 0.82rem; letter-spacing: 0.01em; }

  .stage {
    margin-block-start: clamp(3rem, 7vw, 5rem);
    perspective: 1400px;
  }
  .frame { max-inline-size: 1000px; margin-inline: auto; padding: 0.5rem; border-radius: 1.75rem; background: rgb(255 255 255 / 0.02); box-shadow: 0 50px 100px -40px rgb(124 92 255 / 0.35), 0 30px 60px -30px rgb(0 0 0 / 0.9); transform-origin: 50% 0; }
  .screen {
    position: relative;
    block-size: clamp(380px, 46vw, 500px);
    border-radius: 1.3rem;
    border: 1px solid rgb(255 255 255 / 0.07);
    background: #0b0a12;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
    overflow: hidden;
  }
  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      .frame { animation: tilt linear both; animation-timeline: view(); animation-range: entry 0% cover 45%; }
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

  .works { display: grid; justify-items: center; gap: 1.1rem; max-inline-size: 980px; margin: clamp(3.5rem, 7vw, 5rem) auto 0; }
  .works-label { color: var(--faint); font-size: 0.8rem; }
  .marquee { overflow: hidden; inline-size: 100%; mask-image: linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent); }
  .track { display: flex; gap: 3rem; inline-size: max-content; margin: 0; padding: 0.25rem 0; list-style: none; animation: marquee 36s linear infinite; }
  .track li { color: #8e8c9f; font-weight: 600; font-size: 1.1rem; letter-spacing: -0.015em; white-space: nowrap; transition: color 0.3s; }
  .track li:hover { color: var(--text); }
  .marquee:hover .track { animation-play-state: paused; }
  @keyframes marquee { to { transform: translateX(calc(-50% - 1.5rem)); } }
  :global([dir='rtl']) .track { animation-name: marquee-rtl; }
  @keyframes marquee-rtl { to { transform: translateX(calc(50% + 1.5rem)); } }
  @media (prefers-reduced-motion: reduce) {
    .track { animation: none; flex-wrap: wrap; inline-size: auto; justify-content: center; gap: 0.5rem 1.5rem; }
    .track li[aria-hidden='true'] { display: none; }
    .marquee { mask-image: none; }
  }
  @media (max-width: 640px) {
    .term-body { font-size: 0.7rem; }
    .frame { padding: 0.3rem; border-radius: 1.4rem; }
  }
</style>
