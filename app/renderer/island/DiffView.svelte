<script lang="ts">
  // The lines an agent changes, like an editor: red out, green in, with line numbers. New lines slide in.
  import { basename, type Diff } from '../../shared/state'
  let { diff }: { diff: Diff } = $props()
</script>

<div class="diff">
  <div class="file">{basename(diff.file)}<span>:{diff.line}</span></div>
  <div class="lines">
    {#each diff.removed as l, i (`-${diff.file}${diff.line}${i}`)}
      <div class="row out" style:animation-delay="{i * 18}ms"><span class="n">{diff.line + i}</span><span class="s">-</span><span class="t">{l}</span></div>
    {/each}
    {#each diff.added as l, i (`+${diff.file}${diff.line}${i}`)}
      <div class="row in" style:animation-delay="{(diff.removed.length + i) * 18}ms"><span class="n">{diff.line + i}</span><span class="s">+</span><span class="t">{l}</span></div>
    {/each}
  </div>
</div>

<style>
  .diff { border-radius: 10px; background: #0b0b0e; overflow: hidden; font: 11.5px/1.5 'Cascadia Mono', Consolas, monospace; }
  .file { padding: 4px 10px; color: var(--muted); background: var(--surface1); font-family: var(--font); font-size: 12px; }
  .file span { opacity: 0.6; }
  .lines { max-height: 150px; overflow: auto; }
  .row { display: flex; white-space: pre; animation: slide 0.12s ease-out both; }
  .n { flex: none; width: 38px; padding-right: 8px; text-align: right; color: var(--muted); }
  .s { flex: none; width: 14px; }
  .t { overflow: hidden; text-overflow: ellipsis; }
  .out { background: #ff453a1f; color: #ffb4ae; }
  .in { background: #30d1581c; color: #a9f0bb; }
  @keyframes slide { from { opacity: 0; transform: translateX(-6px); } }
  @media (prefers-reduced-motion: reduce) { .row { animation: none; } }
</style>
