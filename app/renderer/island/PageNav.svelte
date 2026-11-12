<script lang="ts">
  // The page row at the top of the open island: an icon per page, the current one an accent pill with its name. One Tab stop (WAI-ARIA tabs):
  // the arrow keys, Home and End move between pages.
  import Icon from './Icon.svelte'
  import { PAGES, type Page } from './pages'
  import { t } from '../i18n.svelte'
  let { page = $bindable(), badges = {}, hidden = [] }: { page: Page; badges?: Partial<Record<Page, boolean>>; hidden?: string[] } = $props()
  // the pages you keep (Settings → Island → Pages); the one you are on always shows
  const pages = $derived(PAGES.filter(p => !hidden.includes(p.id) || p.id === page))

  let nav: HTMLDivElement
  function key(e: KeyboardEvent) {
    const i = pages.findIndex(p => p.id === page), n = pages.length
    const rtl = getComputedStyle(nav).direction === 'rtl'
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1
      : e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? (i + 1) % n : e.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? (i - 1 + n) % n : -1
    if (j < 0) return
    e.preventDefault()
    page = pages[j]!.id
    nav.querySelectorAll('button')[j]?.focus()
  }
</script>

<div class="nav" role="tablist" aria-label={t('i.page.pages')} tabindex="-1" onkeydown={key} bind:this={nav}>
  {#each pages as p (p.id)}
    <!-- three groups (Hick, Gestalt proximity): you and the agents · what you play and keep · your own things -->
    <button role="tab" aria-selected={p.id === page} tabindex={p.id === page ? 0 : -1} class:group={p.id === 'music' || p.id === 'notes'}
      aria-label={badges[p.id] ? `${t(`i.page.${p.id}`)} · ${t('i.page.attention')}` : t(`i.page.${p.id}`)} title={t(`i.page.${p.id}`)} class:on={p.id === page} onclick={e => { e.stopPropagation(); page = p.id }}>
      <Icon name={p.icon} size={15} />
      {#if p.id === page}<span>{t(`i.page.${p.id}`)}</span>{/if}
      {#if badges[p.id]}<i class="badge"></i>{/if}
    </button>
  {/each}
</div>

<style>
  .nav { display: flex; justify-content: center; align-items: center; gap: 4px; padding: 10px 70px 2px; } /* 70 px: Pip's corner */
  button { position: relative; min-width: 32px; height: 28px; padding: 0 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    background: none; color: var(--muted); border-radius: var(--r-pill); }
  button:hover { color: var(--text); background: var(--surface1); }
  button.group { margin-inline-start: 12px; }
  /* the page you are on: an accent pill with its name */
  button.on { color: var(--on-accent); background: var(--accent); padding: 0 12px 0 10px; font-size: 0.86em; font-weight: 600; }
  button.on:hover { background: var(--accent); color: var(--on-accent); }
  .badge { position: absolute; top: 4px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--question); }
</style>
