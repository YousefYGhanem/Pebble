<script lang="ts">
  import type { Feature } from '../../content/types'
  import { pipColors } from '../../../app/shared/pip'
  import { site } from '../lib/i18n.svelte'
  import PipCanvas from '../components/PipCanvas.svelte'
  import { ticker } from './ticker.svelte'

  // The real built-in themes (themes/*.json): the island takes each one's colours, and slides left, middle, right.
  let { f }: { f: Feature } = $props()
  type Tokens = { background: string; text: string; muted: string; accent: string; running: string; pipBody?: string; pipVisor?: string }
  const THEMES = Object.fromEntries(Object.entries(import.meta.glob<{ tokens: Tokens }>('../../../themes/*.json', { eager: true, import: 'default' }))
    .map(([p, t]) => [p.split('/').pop()!.replace('.json', ''), t.tokens]))
  const chips = $derived((f.chips ?? []).filter(c => THEMES[c.id]))
  const tick = ticker(2000)
  const POS = ['center', 'right', 'center', 'left'] as const
  const theme = $derived(chips[tick.n % Math.max(1, chips.length)])
  const tok = $derived(theme ? THEMES[theme.id]! : THEMES.default!)
  const pos = $derived(POS[tick.n % POS.length])
</script>

<div class="themes" use:tick.watch>
  <div class="screen" style:--bg={tok.background} style:--fg={tok.text} style:--run={tok.running} style:--accent={tok.accent}>
    <div class="track" data-pos={pos}>
      <div class="island">
        <span class="dot"></span>
        <span class="line">{site.c.demo.project} · {site.c.demo.working}</span>
        <span class="pip"><PipCanvas mood="focused" scale={0.62} colors={pipColors({ look: 'theme', body: '', visor: '' }, tok)} eyes={tok.running} /></span>
      </div>
    </div>
    <div class="windows" aria-hidden="true"><i></i><i></i></div>
  </div>
  <div class="chips" role="group" aria-label={f.kicker}>
    {#each chips as c, i (c.id)}
      <button type="button" aria-pressed={c === theme} onclick={() => { tick.stop(); tick.n = i }}>
        <span class="sw" style:background={THEMES[c.id]!.background} style:border-color={THEMES[c.id]!.accent}></span>{c.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .themes { display: grid; gap: 1.25rem; }
  .screen { position: relative; block-size: 210px; border-radius: 1.1rem; overflow: hidden; background: linear-gradient(160deg, #1a1530, #0b0a12 60%, #0d1a24); border: 1px solid var(--stroke); }
  .track { position: absolute; inset-block-start: 0.8rem; inset-inline: 0.8rem; display: flex; justify-content: center; transition: transform 0.7s var(--spring); }
  /* physical: the island's spot along the top of the screen */
  .track[data-pos='left'] { transform: translateX(-26%); }
  .track[data-pos='right'] { transform: translateX(26%); }
  .island {
    position: relative; display: flex; align-items: center; gap: 0.55rem;
    inline-size: min(17rem, 70%); block-size: 2.5rem; padding: 0 3rem 0 0.9rem; border-radius: 1.25rem;
    background: var(--bg); color: var(--fg); font-size: 0.85rem; white-space: nowrap;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--fg) 12%, transparent), 0 16px 30px -10px rgb(0 0 0 / 0.7), 0 0 40px -10px var(--accent);
    transition: background 0.6s, color 0.6s, box-shadow 0.6s;
  }
  .dot { inline-size: 0.55rem; block-size: 0.55rem; border-radius: 50%; background: var(--run); flex: none; transition: background 0.6s; }
  .line { overflow: hidden; text-overflow: ellipsis; }
  .pip { position: absolute; right: 0.45rem; inset-block-start: 0.15rem; inline-size: 2.4rem; block-size: 2.2rem; }
  .windows i { position: absolute; border-radius: 0.6rem; background: rgb(255 255 255 / 0.04); border: 1px solid rgb(255 255 255 / 0.06); }
  .windows i:first-child { inset: 4.5rem 45% 1rem 1rem; }
  .windows i:last-child { inset: 5.5rem 1rem 1.6rem 58%; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
  button {
    display: inline-flex; align-items: center; gap: 0.45rem; font: inherit; font-size: 0.85rem; color: var(--muted); cursor: pointer;
    padding: 0.4rem 0.8rem; border-radius: 999px; background: rgb(255 255 255 / 0.04); border: 1px solid var(--stroke); transition: color 0.2s, background 0.3s;
  }
  button[aria-pressed='true'] { color: #fff; background: rgb(124 92 255 / 0.2); border-color: rgb(124 92 255 / 0.5); }
  .sw { inline-size: 0.9rem; block-size: 0.9rem; border-radius: 50%; border: 2px solid; }
</style>
