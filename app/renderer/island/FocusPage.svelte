<script lang="ts">
  // Focus: a timer. Pick a length, start; the island keeps it as a ring around Pip (animation #18) and chimes at the end.
  import { focusLeft, type Action, type FocusTimer } from '../../shared/extras'
  import { clock } from './pages'

  let { focus, now, act }: { focus: FocusTimer | null; now: number; act: (a: Action) => void } = $props()
  const PRESETS = [5, 15, 25, 45, 60]
  let minutes = $state(25)
  const left = $derived(focus ? focusLeft(focus, now) : minutes * 60)
  const progress = $derived(focus ? left / focus.seconds : 1)
</script>

<div class="page">
  <div class="page-head"><span class="page-title">Focus</span><span class="page-time"></span><span class="pip-room"></span></div>
  <div class="focus">
    <div class="dial">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" class="track" />
        <circle cx="60" cy="60" r="52" class="arc" stroke-dasharray="{progress * 326.7} 326.7" />
      </svg>
      <span class="time">{clock(left * 1000)}</span>
    </div>
    <div class="side">
      {#if !focus}
        <div class="presets">
          {#each PRESETS as p (p)}<button class:on={minutes === p} onclick={() => (minutes = p)}>{p} min</button>{/each}
        </div>
        <label class="custom muted">or <input type="number" min="1" max="600" bind:value={minutes} aria-label="Minutes" /> minutes</label>
        <button class="likely start" disabled={!(minutes >= 1)} onclick={() => act({ do: 'focus.start', seconds: Math.round(minutes * 60) })}>Start</button>
      {:else}
        <div class="muted">{focus.left !== undefined ? 'Paused' : 'Focus time. The island shows the ring around Pip.'}</div>
        <div class="row">
          {#if focus.left !== undefined}<button class="likely" onclick={() => act({ do: 'focus.resume' })}>Resume</button>
          {:else}<button onclick={() => act({ do: 'focus.pause' })}>Pause</button>{/if}
          <button onclick={() => act({ do: 'focus.stop' })}>Stop</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .focus { display: flex; gap: 22px; align-items: center; padding-bottom: 10px; }
  .dial { position: relative; width: 130px; height: 130px; flex: none; display: grid; place-items: center; }
  .dial svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .track { fill: none; stroke: #ffffff17; stroke-width: 7; }
  .arc { fill: none; stroke: var(--accent); stroke-width: 7; stroke-linecap: round; transition: stroke-dasharray 1s linear; }
  .time { font-size: 1.7em; font-weight: 700; font-variant-numeric: tabular-nums; }
  .side { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; }
  .presets .on { background: var(--accent); color: var(--on-accent); }
  .custom input { width: 60px; font: inherit; color: var(--text); background: #ffffff0d; border: 1px solid #ffffff1a; border-radius: 8px; padding: 3px 6px; }
  .row { display: flex; gap: 8px; }
  .start { min-width: 120px; }
</style>
