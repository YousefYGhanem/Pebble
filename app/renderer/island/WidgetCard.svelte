<script lang="ts">
  // A connector's card (Home and the Widgets page): title, value, a few lines; a click opens its link.
  import type { Widget } from '../../shared/connectors'
  import Icon from './Icon.svelte'
  let { w, onopen }: { w: Widget; onopen: () => void } = $props()
  const emoji = $derived(w.icon && !/^[a-z-]+$/.test(w.icon)) // "⚽" is drawn as text, "agents" as a line icon
</script>

<button class="card tone-{w.tone ?? 'info'}" onclick={onopen} disabled={!w.link} title={w.link ? 'Open' : undefined}>
  <span class="label">{#if emoji}<span>{w.icon}</span>{:else if w.icon}<Icon name={w.icon} size={13} />{/if}{w.title ?? w.plugin}</span>
  <span class="value">{w.text}</span>
  {#each w.lines ?? [] as l, i (i)}<span class="line">{l}</span>{/each}
</button>

<style>
  .card { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; min-height: 84px; padding: 10px 12px; border-radius: 16px; background: #ffffff0d; border-left: 3px solid var(--tone, transparent); min-width: 0; }
  .card:disabled { cursor: default; opacity: 1; }
  .card:not(:disabled):hover { background: #ffffff17; }
  .tone-ok { --tone: var(--done); }
  .tone-warn { --tone: var(--question); }
  .tone-error { --tone: var(--error); }
  .label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 0.85em; }
  .value { font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line { font-size: 0.84em; color: var(--muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
