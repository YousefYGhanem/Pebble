<script lang="ts">
  // Files: the shelf (drop files on the island to keep them here; drag them out into any app; click to open) and the
  // phone drop: a QR code your phone's camera opens, with soft radar rings while it waits (animation #14).
  import { scale } from 'svelte/transition'
  import { backOut } from 'svelte/easing'
  import type { Action, ExtrasState } from '../../shared/extras'
  import Icon from './Icon.svelte'
  import { t } from '../i18n.svelte'
  import { undo } from './undo.svelte'

  let { extras, now, act, reduced }: { extras: ExtrasState; now: number; act: (a: Action) => void; reduced: boolean } = $props()
  const drop = $derived(extras.drop)
  // what an undo offer is holding back stays out of sight until it is settled
  const shelf = $derived(extras.shelf.filter(f => !undo.hides(`shelf:${f.path}`)))
  const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
</script>

<div class="page">
  <div class="page-head">
    <span class="page-title">{t('i.page.files')}</span>
    {#if !drop}<button class="ghost" onclick={() => act({ do: 'drop.start' })}><Icon name="phone" size={14} />{t('i.files.phone')}</button>{/if}
    {#if shelf.length && !drop}<button class="ghost" onclick={() => undo.offer(t('i.undo.shelf'), { hides: 'shelf', commit: () => act({ do: 'shelf.clear' }) })}>{t('i.files.clearAll')}</button>{/if}
    <span class="page-time">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span class="pip-room"></span>
  </div>

  {#if drop}
    <div class="drop">
      <div class="qr" class:radar={!drop.connected && !reduced}>
        <img src={drop.qr} alt={t('i.files.qr')} />
        {#if drop.connected}<span class="ok"><Icon name="check" size={18} /></span>{/if}
      </div>
      <div class="drop-text">
        <div class="title">{drop.connected ? t('i.files.connected') : t('i.files.scan')}</div>
        <div class="muted">{t('i.files.how')}</div>
        {#if drop.blocked && !drop.connected}
          <div class="warn">{drop.blocked === 'public' ? t('i.files.public') : t('i.files.firewall')}
            <button onclick={() => act({ do: drop.blocked === 'public' ? 'drop.network' : 'drop.allow' })}>{drop.blocked === 'public' ? t('i.files.makePrivate') : t('i.files.allow')}</button></div>
        {/if}
        {#if !drop.connected}<div class="muted small">{t('i.files.notOpening')}</div>{/if}
        {#if drop.received}<div>{t('i.files.received', { n: drop.received })}</div>{/if}
        <div class="muted small">{t('i.files.stops', { n: Math.max(1, Math.round((drop.expiresAt - now) / 60000)) })}</div>
        <button onclick={() => act({ do: 'drop.stop' })}>{t('i.common.stop')}</button>
      </div>
    </div>
  {:else if !shelf.length}
    <div class="empty">{t('i.files.empty')}</div>
  {:else}
    <div class="shelf">
      {#each shelf as f (f.path)}
        <div class="file" draggable="true" title={f.path} role="button" tabindex="0"
          in:scale={{ start: 0.6, duration: reduced ? 0 : 420, easing: backOut }}
          ondragstart={e => { e.preventDefault(); act({ do: 'shelf.drag', path: f.path }) }}
          ondblclick={() => act({ do: 'shelf.open', path: f.path })}
          onkeydown={e => e.key === 'Enter' && act({ do: 'shelf.open', path: f.path })}>
          {#if f.icon}<img src={f.icon} alt="" />{:else}<span class="noicon"><Icon name="files" size={22} /></span>{/if}
          <span class="name">{f.name}</span>
          <span class="muted small">{size(f.size)}</span>
          <span class="tools">
            <button class="ghost" title="Show in folder" aria-label="Show in folder" onclick={() => act({ do: 'shelf.reveal', path: f.path })}><Icon name="folder" size={12} /></button>
            <button class="ghost" title="Remove from shelf" aria-label="Remove from shelf" onclick={() => undo.offer(t('i.undo.file'), { hides: `shelf:${f.path}`, commit: () => act({ do: 'shelf.remove', path: f.path }) })}><Icon name="close" size={12} /></button>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .shelf { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 8px; }
  .file { position: relative; flex: none; width: 96px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px 8px; border-radius: 14px; background: #ffffff0b; cursor: grab; animation: float 3.2s steps(8, jump-none) infinite; }
  .file:nth-child(2n) { animation-delay: -1.6s; }
  .file:hover { background: #ffffff16; }
  .file img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; }
  .noicon { width: 56px; height: 56px; display: grid; place-items: center; color: var(--muted); }
  .name { max-width: 100%; font-size: 0.85em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .small { font-size: 0.78em; }
  .warn { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--question); font-size: 0.85em; }
  .tools { position: absolute; top: 2px; right: 2px; display: none; }
  .file:hover .tools, .file:focus-within .tools { display: flex; }
  .tools button { padding: 3px; }
  @keyframes float { 50% { transform: translateY(-3px); } }
  @media (prefers-reduced-motion: reduce) { .file { animation: none; } }

  .drop { display: flex; gap: 18px; align-items: center; padding-bottom: 8px; }
  .qr { position: relative; flex: none; width: 150px; height: 150px; border-radius: 16px; background: #fff; display: grid; place-items: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45); }
  .qr img { width: 134px; height: 134px; image-rendering: pixelated; }
  .qr.radar::before, .qr.radar::after { content: ''; position: absolute; inset: -2px; border-radius: 18px; border: 2px solid var(--running); animation: ring 2.8s cubic-bezier(0.15, 0.6, 0.3, 1) infinite; pointer-events: none; }
  .qr.radar::after { animation-delay: 1.4s; }
  @keyframes ring { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(1.24); opacity: 0; } }
  .ok { position: absolute; right: -8px; bottom: -8px; width: 30px; height: 30px; border-radius: 50%; background: var(--done); color: #fff; display: grid; place-items: center; }
  .drop-text { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .title { font-weight: 600; }
</style>
