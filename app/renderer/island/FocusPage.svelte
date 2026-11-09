<script lang="ts">
  // Focus: a timer. Pick a length, start; the island keeps it as a ring around Pip (animation #18) and chimes at the end.
  import { focusLeft, type Action, type FocusDone, type FocusTimer } from '../../shared/extras'
  import { clock } from './pages'
  import { t } from '../i18n.svelte'

  let { focus, done, now, act }: { focus: FocusTimer | null; done: FocusDone | null; now: number; act: (a: Action) => void } = $props()
  // a round just ended (within half an hour): offer a short break, or another round (Pomodoro: work, then rest)
  const next = $derived(!focus && done && now - done.at < 30 * 60_000 ? done : null)
  const start = (seconds: number, isBreak = false) => act({ do: 'focus.start', seconds, break: isBreak || undefined })
  const PRESETS = [5, 15, 25, 45, 60]
  let minutes = $state(25)
  const left = $derived(focus ? focusLeft(focus, now) : minutes * 60)
  const progress = $derived(focus ? left / focus.seconds : 1)
</script>

<div class="page">
  <div class="page-head"><span class="page-title">{t('i.page.focus')}</span><span class="page-time"></span><span class="pip-room"></span></div>
  <div class="focus">
    <div class="dial">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" class="track" />
        <circle cx="60" cy="60" r="52" class="arc" stroke-dasharray="{progress * 326.7} 326.7" />
      </svg>
      <span class="time">{clock(left * 1000)}</span>
    </div>
    <div class="side">
      {#if next}
        <div class="title">{next.wasBreak ? t('i.focus.breakOver') : t('i.focus.roundDone')}</div>
        {#if next.today}<div class="muted">{t('i.focus.today', { n: next.today })}</div>{/if}
        <div class="row">
          <button class="likely" onclick={() => start(next.round)}>{t('i.focus.another', { n: Math.round(next.round / 60) })}</button>
          {#if !next.wasBreak}<button onclick={() => start(5 * 60, true)}>{t('i.focus.break')}</button>{/if}
        </div>
      {:else if !focus}
        <div class="presets">
          {#each PRESETS as p (p)}<button class:on={minutes === p} onclick={() => (minutes = p)}>{t('i.focus.min', { n: p })}</button>{/each}
        </div>
        <label class="custom muted">{t('i.focus.or')} <input type="number" min="1" max="600" bind:value={minutes} aria-label={t('i.focus.minutes')} /> {t('i.focus.minutes')}</label>
        <button class="likely start" disabled={!(minutes >= 1)} onclick={() => start(Math.round(minutes * 60))}>{t('i.focus.startFor', { n: minutes })}</button>
      {:else}
        <div class="muted">{focus.break ? t('i.focus.onBreak') : focus.left !== undefined ? t('i.focus.paused') : t('i.focus.running')}</div>
        <div class="row">
          {#if focus.left !== undefined}<button class="likely" onclick={() => act({ do: 'focus.resume' })}>{t('i.common.resume')}</button>
          {:else}<button onclick={() => act({ do: 'focus.pause' })}>{t('i.common.pause')}</button>{/if}
          <button class="ghost" onclick={() => act({ do: 'focus.stop' })}>{t('i.common.stop')}</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .title { font-weight: 600; }
  .focus { display: flex; gap: 22px; align-items: center; padding-bottom: 10px; }
  .dial { position: relative; width: 130px; height: 130px; flex: none; display: grid; place-items: center; }
  .dial svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--surface2); stroke-width: 7; }
  .arc { fill: none; stroke: var(--accent); stroke-width: 7; stroke-linecap: round; transition: stroke-dasharray 1s linear; }
  .time { font-size: 1.7em; font-weight: 700; font-variant-numeric: tabular-nums; }
  .side { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; }
  .presets .on { background: var(--accent); color: var(--on-accent); }
  .custom input { width: 60px; font: inherit; color: var(--text); background: var(--surface1); border: 1px solid var(--stroke); border-radius: 8px; padding: 3px 6px; }
  .row { display: flex; gap: 8px; }
  .start { min-width: 120px; }
</style>
