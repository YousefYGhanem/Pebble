<script lang="ts">
  // The sound wave (animation #11): bars that follow the real sound level of this PC. Each bar rises fast and falls
  // slowly, like a level meter. Silence (or no level) → flat dots, never a made-up wave.
  import { onPeak } from './peak'
  let { color = 'var(--text)', bars = 5, height = 16 }: { color?: string; bars?: number; height?: number } = $props()
  $effect(() => onPeak(update))

  const SHAPE = [0.55, 0.85, 1, 0.8, 0.6, 0.9, 0.7]
  const levels: number[] = Array(12).fill(0) // enough for any bar count
  let els: HTMLSpanElement[] = []

  /** The sound level (0–1), about 30 times a second. */
  function update(peak: number) {
    for (let i = 0; i < bars; i++) {
      const target = Math.min(1, peak * 1.6 * SHAPE[i % SHAPE.length]! * (0.75 + Math.random() * 0.5))
      levels[i] = target > levels[i]! ? levels[i]! + (target - levels[i]!) * 0.7 : levels[i]! * 0.82
      if (els[i]) els[i]!.style.height = `${Math.max(3, levels[i]! * height)}px`
    }
  }
</script>

<span class="wave" style:height="{height}px" aria-hidden="true">
  {#each Array(bars) as _, i (i)}
    <span class="bar" style:background={color} bind:this={els[i]}></span>
  {/each}
</span>

<style>
  .wave { display: inline-flex; align-items: center; gap: 2px; flex: none; }
  .bar { width: 3px; height: 3px; border-radius: 2px; }
</style>
