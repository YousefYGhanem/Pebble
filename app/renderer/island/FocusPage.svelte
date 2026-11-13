<script lang="ts">
  // Focus: a timer. Pick a length, start; the island keeps it as a ring around Pip (animation #18) and chimes at the end.
  import { focusLeft, type Action, type FocusDone, type FocusTimer } from '../../shared/extras'
  import { clock } from './pages'
  import { t } from '../i18n.svelte'

  let { focus, done, sound = 'off', now, act }: { focus: FocusTimer | null; done: FocusDone | null; sound?: 'off' | 'rain' | 'deep' | 'waves'; now: number; act: (a: Action) => void } = $props()
  // a round just ended (within half an hour): offer a short break, or another round (Pomodoro: work, then rest)
  const next = $derived(!focus && done && now - done.at < 30 * 60_000 ? done : null)
  // rounds of four (Pomodoro): which one this is, and after the fourth a long break
  const ROUNDS = 4
  const doneToday = $derived(done && done.day === `${new Date(now).getFullYear()}-${new Date(now).getMonth() + 1}-${new Date(now).getDate()}` ? done.today : 0)
  const inCycle = $derived(doneToday % ROUNDS) // rounds finished in this cycle
  const longBreakDue = $derived(!!next && !next.wasBreak && doneToday > 0 && doneToday % ROUNDS === 0)
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
          {#if !next.wasBreak}<button onclick={() => start((longBreakDue ? 15 : 5) * 60, true)}>{t(longBreakDue ? 'i.focus.longBreak' : 'i.focus.break')}</button>{/if}
        </div>
      {:else if !focus}
        <div class="presets">
          {#each PRESETS as p (p)}<button class:on={minutes === p} onclick={() => (minutes = p)}>{t('i.focus.min', { n: p })}</button>{/each}
        </div>
        <label class="custom muted">{t('i.focus.or')} <input type="number" min="1" max="600" bind:value={minutes} aria-label={t('i.focus.minutes')} /> {t('i.focus.minutes')}</label>
        <button class="likely start" disabled={!(minutes >= 1)} onclick={() => start(Math.round(minutes * 60))}>{t('i.focus.startFor', { n: minutes })}</button>
      {:else}
        <div class="muted">{focus.break ? t('i.focus.onBreak') : focus.left !== undefined ? t('i.focus.paused') : t('i.focus.roundOf', { n: inCycle + 1, total: ROUNDS })}</div>
        {#if !focus.break}
          <!-- the cycle: finished rounds full, this one filling with a glowing head, then the long break -->
          <div class="track" aria-hidden="true">
            {#each Array(ROUNDS) as _, i (i)}
              <span class="seg" class:full={i < inCycle}>{#if i === inCycle}<i style:width="{(1 - left / focus.seconds) * 100}%"></i>{/if}</span>
            {/each}
            <span class="seg long">{t('i.focus.long')}</span>
          </div>
        {/if}
        <div class="row">
          {#if focus.left !== undefined}<button class="likely" onclick={() => act({ do: 'focus.resume' })}>{t('i.common.resume')}</button>
          {:else}<button onclick={() => act({ do: 'focus.pause' })}>{t('i.common.pause')}</button>{/if}
          <button class="ghost" onclick={() => act({ do: 'focus.stop' })}>{t('i.common.stop')}</button>
        </div>
      {/if}
      <!-- a sound while the round runs (made by Pebble; it stops on breaks) -->
      <div class="sounds" role="group" aria-label={t('i.focus.sound')}>
        <span class="muted">{t('i.focus.sound')}</span>
        {#each ['off', 'rain', 'deep', 'waves'] as const as k}<button class:on={sound === k} aria-pressed={sound === k} onclick={() => act({ do: 'focus.sound', sound: k })}>{t(`i.focus.sound.${k}`)}</button>{/each}
      </div>
    </div>
  </div>
</div>

<style>
  .sounds { display: flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 0.82em; }
  .sounds .muted { margin-inline-end: 4px; }
  .sounds button { padding: 2px 10px; background: none; color: var(--muted); }
  .sounds button.on { background: var(--surface3); color: var(--text); }
  .track { display: flex; gap: 5px; align-items: center; margin: 6px 0 4px; }
  .seg { position: relative; width: 38px; height: 6px; border-radius: 3px; background: var(--surface3); }
  .seg.full { background: var(--accent); }
  .seg > i { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: 3px; background: var(--accent); }
  .seg > i::after { content: ''; position: absolute; inset-inline-end: -4px; top: -2px; width: 10px; height: 10px; border-radius: 50%;
    background: var(--accent); box-shadow: 0 0 10px 2px color-mix(in srgb, var(--accent) 70%, transparent); }
  .seg.long { width: auto; height: auto; padding: 0 6px; background: none; color: var(--muted); font-size: 0.75em; }
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
