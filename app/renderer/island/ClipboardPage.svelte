<script lang="ts">
  // Clipboard: your last copied texts (kept in memory only, never on disk). Click one to copy it again.
  import type { Action, ExtrasState } from '../../shared/extras'
  import Icon from './Icon.svelte'
  import { ago } from './pages'
  import { t } from '../i18n.svelte'
  import { undo } from './undo.svelte'

  let { extras, now, act, enabled }: { extras: ExtrasState; now: number; act: (a: Action) => void; enabled: boolean } = $props()
  let copied = $state(-1)

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
    <span class="page-time">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span class="pip-room"></span>
  </div>
  {#if !enabled}
    <div class="empty">{t('i.clip.off')}</div>
  {:else if !extras.clipboard.length || undo.hides('clipboard')}
    <div class="empty">{t('i.clip.empty')}</div>
  {:else}
    <div class="list">
      {#each extras.clipboard as c (c.id)}
        <button class="row" onclick={() => copy(c.id)} title={t('i.clip.again')}>
          <span class="text">{c.text}</span>
          <span class="when muted">{copied === c.id ? t('i.clip.copied') : ago(c.at, now)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .list { display: flex; flex-direction: column; max-height: 270px; overflow: auto; margin: 0 -8px 8px; }
  .row { display: flex; gap: 12px; align-items: flex-start; text-align: left; background: none; border-radius: 10px; padding: 7px 8px; }
  .row:hover { background: #ffffff10; }
  .text { flex: 1; min-width: 0; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; }
  .when { flex: none; font-size: 0.82em; padding-top: 1px; }
</style>
