<script lang="ts">
  // The page row at the bottom of the open island: an icon per page, the current one lit. One Tab stop (WAI-ARIA tabs):
  // the arrow keys, Home and End move between pages.
  import Icon from './Icon.svelte'
  import { PAGES, type Page } from './pages'
  import { t } from '../i18n.svelte'
  let { page = $bindable(), badges = {} }: { page: Page; badges?: Partial<Record<Page, boolean>> } = $props()

  let nav: HTMLDivElement
  function key(e: KeyboardEvent) {
    const i = PAGES.findIndex(p => p.id === page), n = PAGES.length
    const rtl = getComputedStyle(nav).direction === 'rtl'
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1
      : e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? (i + 1) % n : e.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? (i - 1 + n) % n : -1
    if (j < 0) return
    e.preventDefault()
    page = PAGES[j]!.id
    nav.querySelectorAll('button')[j]?.focus()
  }
</script>

<div class="nav" role="tablist" aria-label={t('i.page.pages')} tabindex="-1" onkeydown={key} bind:this={nav}>
  {#each PAGES as p (p.id)}
    <!-- three groups (Hick, Gestalt proximity): you and the agents · what you play and keep · your own things -->
    <button role="tab" aria-selected={p.id === page} tabindex={p.id === page ? 0 : -1} class:group={p.id === 'music' || p.id === 'notes'}
      aria-label={badges[p.id] ? `${t(`i.page.${p.id}`)} · ${t('i.page.attention')}` : t(`i.page.${p.id}`)} title={t(`i.page.${p.id}`)} class:on={p.id === page} onclick={e => { e.stopPropagation(); page = p.id }}>
      <Icon name={p.icon} size={15} />
      {#if badges[p.id]}<i class="badge"></i>{/if}
    </button>
  {/each}
</div>

<style>
  .nav { display: flex; justify-content: center; gap: 4px; padding: 4px 0 10px; }
  button { position: relative; width: 34px; height: 28px; padding: 0; display: grid; place-items: center; background: none; color: var(--muted); border-radius: 10px; }
  button:hover { color: var(--text); background: #ffffff0f; }
  button.group { margin-inline-start: 12px; }
  button.on { color: var(--text); background: #ffffff1a; }
  .badge { position: absolute; top: 4px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--question); }
</style>
