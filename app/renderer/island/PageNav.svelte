<script lang="ts">
  // The page row at the bottom of the open island: an icon per page, the current one lit. Arrow keys go left/right.
  import Icon from './Icon.svelte'
  import { PAGES, type Page } from './pages'
  import { t } from '../i18n.svelte'
  let { page = $bindable(), badges = {} }: { page: Page; badges?: Partial<Record<Page, boolean>> } = $props()

  function key(e: KeyboardEvent) {
    const i = PAGES.findIndex(p => p.id === page)
    if (e.key === 'ArrowRight') page = PAGES[(i + 1) % PAGES.length]!.id
    if (e.key === 'ArrowLeft') page = PAGES[(i - 1 + PAGES.length) % PAGES.length]!.id
  }
</script>

<div class="nav" role="tablist" aria-label={t('i.page.pages')} tabindex="-1" onkeydown={key}>
  {#each PAGES as p (p.id)}
    <button role="tab" aria-selected={p.id === page} aria-label={t(`i.page.${p.id}`)} title={t(`i.page.${p.id}`)} class:on={p.id === page} onclick={e => { e.stopPropagation(); page = p.id }}>
      <Icon name={p.icon} size={15} />
      {#if badges[p.id]}<i class="badge"></i>{/if}
    </button>
  {/each}
</div>

<style>
  .nav { display: flex; justify-content: center; gap: 4px; padding: 4px 0 10px; }
  button { position: relative; width: 34px; height: 28px; padding: 0; display: grid; place-items: center; background: none; color: var(--muted); border-radius: 10px; }
  button:hover { color: var(--text); background: #ffffff0f; }
  button.on { color: var(--text); background: #ffffff1a; }
  .badge { position: absolute; top: 4px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--question); }
</style>
