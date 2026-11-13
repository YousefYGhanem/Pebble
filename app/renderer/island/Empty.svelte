<script lang="ts">
  // A page with nothing on it yet: what goes here, and (sometimes) the one thing to do about it.
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'
  let { icon, text, children }: { icon: string; text: string; children?: Snippet } = $props()
</script>

<div class="blank">
  <span class="mark" aria-hidden="true"><Icon name={icon} size={18} /></span>
  <span class="words">{text}</span>
  {#if children}<span class="do">{@render children()}</span>{/if}
</div>

<style>
  .blank { display: flex; align-items: center; gap: 12px; padding: 10px 4px 12px; color: var(--muted); }
  .mark { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--surface2); color: var(--accent-text); }
  .words { flex: 1; min-width: 0; line-height: 1.35; }
  .do { flex: none; }
</style>
