<script lang="ts">
  // The welcome tour's demo: a small screen where a cursor opens the island, moves away (it closes), right-clicks
  // (it tucks away into a thin tab) and points at the tab (it comes back). It loops, with a caption for each part.
  import { onDestroy } from 'svelte'
  import { t } from '../i18n.svelte'

  let { openOn, toggle, tuck }: { openOn: 'hover' | 'click'; toggle: string; tuck: string } = $props()

  type State = 'rest' | 'open' | 'tucked'
  let look = $state<State>('rest')
  let cursor = $state({ x: 290, y: 118 })
  let click = $state<{ n: number; right: boolean } | null>(null)
  let caption = $state(0)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  const PILL = { x: 180, y: 20 }, AWAY = { x: 290, y: 118 }, TAB = { x: 180, y: 4 }
  let n = 0
  const press = (right: boolean) => (click = { n: ++n, right })
  // [when (ms), what]: one loop is 11 s
  const TIMELINE: [number, () => void][] = [
    [0, () => { look = 'rest'; cursor = AWAY; caption = 0; click = null }],
    [700, () => (cursor = PILL)],
    [1500, () => { if (openOn === 'click') press(false); look = 'open' }],
    [3300, () => { cursor = AWAY; caption = 1 }],
    [4100, () => (look = 'rest')],
    [5400, () => { cursor = PILL; caption = 2 }],
    [6300, () => { press(true); look = 'tucked' }],
    [8000, () => { cursor = TAB; caption = 3 }],
    [8900, () => (look = 'rest')],
    [10200, () => (cursor = AWAY)]
  ]
  const LOOP = 11_000
  let timers: ReturnType<typeof setTimeout>[] = []
  function run() {
    timers = TIMELINE.map(([at, fn]) => setTimeout(fn, at))
    timers.push(setTimeout(run, LOOP))
  }
  run()
  onDestroy(() => timers.forEach(clearTimeout))

  const captions = $derived([openOn === 'click' ? t('demo.openClick') : t('demo.openHover'), t('demo.close'), t('demo.tuck'), t('demo.back')])
</script>

<div class="demo" class:reduced aria-hidden="true">
  <div class="screen">
    <div class="island {look}">
      {#if look === 'open'}
        <span class="bar w1"></span><span class="bar w2"></span><span class="bar w3"></span>
      {:else if look === 'rest'}
        <i class="dot"></i><span class="bar small"></span><i class="pip"></i>
      {/if}
    </div>
    <div class="cursor" style:transform="translate({cursor.x}px, {cursor.y}px)">
      {#key click?.n}{#if click}<span class="ring" class:right={click.right}></span>{#if click.right}<span class="badge">{t('demo.rightClick')}</span>{/if}{/if}{/key}
      <svg width="16" height="20" viewBox="0 0 16 20"><path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round" /></svg>
    </div>
  </div>
</div>
<ol class="captions">
  {#each captions as c, i}<li class:on={i === caption}>{c}</li>{/each}
</ol>
<p class="keys">{t('demo.keys', { toggle, tuck })}</p>

<style>
  .demo { width: 360px; margin: 0 auto 12px; }
  .screen { position: relative; height: 150px; border-radius: 12px; overflow: hidden; direction: ltr;
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 22%, #1b1b24), #101016); border: 1px solid color-mix(in srgb, var(--text) 10%, transparent); }
  .island { position: absolute; left: 50%; top: 8px; translate: -50% 0; width: 120px; height: 26px; border-radius: 13px; background: #050507;
    display: flex; align-items: center; gap: 6px; padding: 0 9px; overflow: hidden; box-shadow: 0 4px 14px #0007;
    transition: width 0.45s cubic-bezier(.3, 1.3, .5, 1), height 0.45s cubic-bezier(.3, 1.3, .5, 1), top 0.35s, border-radius 0.35s; }
  .island.open { width: 300px; height: 100px; border-radius: 20px; flex-direction: column; align-items: flex-start; justify-content: center; gap: 9px; padding: 0 18px; }
  .island.tucked { top: 0; width: 70px; height: 5px; border-radius: 0 0 4px 4px; padding: 0; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--running); flex: none; }
  .pip { width: 14px; height: 11px; border-radius: 6px; background: var(--pip-body, #ece9f6); margin-inline-start: auto; flex: none; }
  .bar { height: 7px; border-radius: 4px; background: color-mix(in srgb, var(--text) 30%, transparent); }
  .bar.small { width: 48px; height: 6px; }
  .w1 { width: 60%; } .w2 { width: 85%; } .w3 { width: 40%; }
  .cursor { position: absolute; left: 0; top: 0; transition: transform 0.7s cubic-bezier(.4, 0, .2, 1); }
  .cursor svg { display: block; filter: drop-shadow(0 1px 2px #000a); }
  .ring { position: absolute; left: -9px; top: -9px; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #fff; animation: ring 0.6s ease-out forwards; }
  .ring.right { border-color: var(--question); }
  .badge { position: absolute; left: 16px; top: 14px; white-space: nowrap; font-size: 11px; padding: 2px 7px; border-radius: 8px; background: var(--question); color: #111; animation: badge 1.6s ease forwards; }
  .reduced .island, .reduced .cursor { transition: none; }
  .reduced .ring, .reduced .badge { animation: none; }
  @keyframes ring { from { scale: 0.4; opacity: 1; } to { scale: 1.6; opacity: 0; } }
  @keyframes badge { 0% { opacity: 0; } 15%, 80% { opacity: 1; } 100% { opacity: 0; } }
  .captions { list-style: none; padding: 0; margin: 0 auto; max-width: 380px; text-align: start; display: flex; flex-direction: column; gap: 4px; }
  .captions li { color: var(--muted); font-size: 13px; padding: 3px 10px; border-radius: 8px; transition: background 0.2s, color 0.2s; }
  .captions li.on { color: var(--text); background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .keys { font-size: 12px; margin: 10px 0 0; }
</style>
