<script lang="ts">
  // Clipboard: your last copied texts (kept in memory only, never on disk). Click one to copy it again.
  import { looksSecret, maskSecret, type Action, type ExtrasState } from '../../shared/extras'
  import Icon from './Icon.svelte'
  import { ago, hhmm } from './pages'
  import { t } from '../i18n.svelte'
  import { undo } from './undo.svelte'

  let { extras, now, act, enabled }: { extras: ExtrasState; now: number; act: (a: Action) => void; enabled: boolean } = $props()
  let copied = $state(-1)
  let kind = $state<'all' | 'text' | 'pictures'>('all')
  const hasPictures = $derived(extras.clipboard.some(c => c.image))

  function copy(id: number) {
    act({ do: 'clip.copy', id })
    copied = id
    setTimeout(() => { if (copied === id) copied = -1 }, 1200)
  }
</script>

<div class="page">
  <div class="page-head">
    <span class="page-title">{t('i.page.clipboard')}</span>
    {#if extras.clipboard.length && !undo.hides('clipboard')}<button class="ghost" onclick={() => undo.offer(t('i.undo.clipboard'), { hides: 'clipboard', commit: () => act({ do: 'clip.clear' }) })}><Icon name="trash" size={13} />{t('i.common.clear')}</button>{/if}
    <span class="page-time">{hhmm(now)}</span><span class="pip-room"></span>
  
    {#if hasPictures}
      <div class="kinds" role="group" aria-label={t('i.clip.kinds')}>
        {#each ['all', 'text', 'pictures'] as const as k}<button class:on={kind === k} aria-pressed={kind === k} onclick={() => (kind = k)}>{t(`i.clip.${k}`)}</button>{/each}
      </div>
    {/if}
  </div>
  {#if !enabled}
    <div class="empty">{t('i.clip.off')}</div>
  {:else if !extras.clipboard.length || undo.hides('clipboard')}
    <div class="empty">{t('i.clip.empty')}</div>
  {:else}
    <div class="list">
      {#each extras.clipboard.filter(c => !undo.hides(`clipboard:${c.id}`) && (kind === 'all' || (kind === 'pictures') === !!c.image)) as c (c.id)}
        <div class="row">
          <button class="copy" onclick={() => copy(c.id)} title={t('i.clip.again')}>
            <!-- a key or a token shows only its ends: the island is on screen for anyone to see -->
            {#if c.image}<img class="pic" src={c.image} alt="" /><span class="text muted">{t('i.clip.picture')} · {c.size}</span>
            {:else}<span class="text" class:secret={looksSecret(c.text)}>{looksSecret(c.text) ? maskSecret(c.text) : c.text}</span>{/if}
            <span class="when muted">{copied === c.id ? t('i.clip.copied') : ago(c.at, now)}</span>
          </button>
          <button class="ghost remove" class:pinned={c.pinned} title={t(c.pinned ? 'i.clip.unpin' : 'i.clip.pin')} aria-label={t(c.pinned ? 'i.clip.unpin' : 'i.clip.pin')} aria-pressed={!!c.pinned}
            onclick={() => act({ do: 'clip.pin', id: c.id })}><Icon name="pin" size={12} /></button>
          <button class="ghost remove" title={t('i.clip.remove')} aria-label={t('i.clip.remove')}
            onclick={() => undo.offer(t('i.undo.clip'), { hides: `clipboard:${c.id}`, commit: () => act({ do: 'clip.remove', id: c.id }) })}><Icon name="close" size={12} /></button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .kinds { display: flex; gap: 2px; padding: 2px; border-radius: var(--r-pill); background: var(--surface1); }
  .kinds button { padding: 3px 11px; font-size: 0.82em; background: none; color: var(--muted); }
  .kinds button.on { background: var(--surface3); color: var(--text); }
  .pic { width: 56px; height: 40px; object-fit: cover; border-radius: var(--r-s); flex: none; }
  .list { display: flex; flex-direction: column; max-height: 270px; overflow: auto; margin: 0 -8px 8px; }
  .row { display: flex; align-items: flex-start; border-radius: 10px; }
  .row:hover, .row:focus-within { background: var(--surface2); }
  .copy { flex: 1; min-width: 0; display: flex; gap: 12px; align-items: flex-start; text-align: start; background: none; padding: 7px 8px; }
  .secret { font-family: ui-monospace, Consolas, monospace; letter-spacing: 0.04em; }
  .remove { flex: none; padding: 6px; margin: 2px 4px 0 0; opacity: 0.45; }
  .row:hover .remove, .remove:focus-visible, .remove.pinned { opacity: 1; }
  .remove.pinned { color: var(--accent-text); }
  .text { flex: 1; min-width: 0; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; }
  .when { flex: none; font-size: 0.82em; padding-top: 1px; }
</style>
