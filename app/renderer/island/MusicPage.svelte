<script lang="ts">
  // Music: what plays on this PC (any player, from Windows' media controls). Cover, song, a progress line you can click
  // to jump, controls, volume, and the lyrics: the line before, the one sung now (big) and the next. The album's colour
  // rises from the bottom of the page.
  import { fly } from 'svelte/transition'
  import { lyricIndex, positionNow, type Action, type ExtrasState } from '../../shared/extras'
  import Icon from './Icon.svelte'
  import Wave from './Wave.svelte'
  import { clock } from './pages'
  import { t } from '../i18n.svelte'

  let { extras, now, color, act, reduced }: { extras: ExtrasState; now: number; color: string | null; act: (a: Action) => void; reduced: boolean } = $props()
  const m = $derived(extras.media)
  const pos = $derived(m ? positionNow(m, now) : 0)
  const line = $derived(extras.lyrics && m ? lyricIndex(extras.lyrics, pos + 250) : -1) // a quarter second early reads better
  // the system volume; while you drag, your value wins (Windows' answer catches up on its own)
  let volume = $state(50)
  let dragging = false
  $effect(() => { if (!dragging && extras.volume) volume = extras.volume.level })

  // the keyboard: arrows 5 s, Page Up/Down 30 s, Home/End the start and the end
  function seekKey(e: KeyboardEvent) {
    if (!m?.canSeek || !m.durationMs) return
    const step = { ArrowRight: 5000, ArrowUp: 5000, ArrowLeft: -5000, ArrowDown: -5000, PageUp: 30000, PageDown: -30000 }[e.key]
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? m.durationMs - 1000 : step !== undefined ? pos + step : null
    if (to === null) return
    e.preventDefault()
    act({ do: 'media', action: 'seek', positionMs: Math.max(0, Math.min(m.durationMs, Math.round(to))) })
  }
  function seek(e: MouseEvent) {
    if (!m?.canSeek || !m.durationMs) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    act({ do: 'media', action: 'seek', positionMs: Math.round(((e.clientX - r.left) / r.width) * m.durationMs) })
  }
</script>

<div class="page music" style:--album={color ?? '255, 255, 255'}>
  <div class="page-head"><span class="page-title">{t('i.page.music')}</span><span class="page-time">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span class="pip-room"></span></div>
  {#if !m}
    <div class="empty">{t('i.music.nothing')}</div>
  {:else}
    <div class="top">
      {#if extras.art}<img class="cover" src={extras.art} alt="" />{:else}<div class="cover none"><Icon name="music" size={28} /></div>{/if}
      <div class="info">
        <div class="title">{m.title}</div>
        <div class="muted">{m.artist}{m.album ? ` · ${m.album}` : ''}</div>
        <div class="controls">
          <button class="icon ghost" aria-label={t('i.music.previous')} disabled={!m.canPrevious} onclick={() => act({ do: 'media', action: 'previous' })}><Icon name="previous" size={16} /></button>
          <button class="icon play" aria-label={m.playing ? t('i.common.pause') : t('i.common.play')} onclick={() => act({ do: 'media', action: 'toggle' })}><Icon name={m.playing ? 'pause' : 'play'} size={16} /></button>
          <button class="icon ghost" aria-label={t('i.music.next')} disabled={!m.canNext} onclick={() => act({ do: 'media', action: 'next' })}><Icon name="next" size={16} /></button>
          {#if m.playing}<Wave color="rgb(var(--album))" bars={7} height={20} />{/if}
          <label class="vol" title={t('i.music.volume')}><Icon name="volume" size={14} /><input type="range" min="0" max="100" bind:value={volume} oninput={() => { dragging = true; act({ do: 'volume', volume }) }} onchange={() => (dragging = false)} aria-label={t('i.music.volume')} /></label>
        </div>
      </div>
    </div>
    <div class="progress" role="slider" tabindex="0" aria-label={t('i.music.position')} aria-valuemin={0} aria-valuemax={Math.round((m.durationMs ?? 0) / 1000)} aria-valuenow={Math.round(pos / 1000)} aria-valuetext={clock(pos)} onclick={seek} onkeydown={seekKey} class:seekable={m.canSeek}>
      <div class="fill" style:width="{m.durationMs ? (pos / m.durationMs) * 100 : 0}%"></div>
    </div>
    <div class="times muted"><span>{clock(pos)}</span><span>{m.durationMs ? clock(m.durationMs) : ''}</span></div>
    {#if extras.lyrics}
      <div class="lyrics">
        <!-- the line before or after: a click jumps there -->
        <button class="ly muted" disabled={!m?.canSeek || !extras.lyrics[line - 1]} onclick={() => act({ do: 'media', action: 'seek', positionMs: extras.lyrics![line - 1]!.t })}>{extras.lyrics[line - 1]?.text ?? ''}</button>
        {#key line}
          <div class="ly now" in:fly={{ y: reduced ? 0 : 10, duration: reduced ? 0 : 280 }}>{extras.lyrics[line]?.text ?? '♪'}</div>
        {/key}
        <button class="ly muted" disabled={!m?.canSeek || !extras.lyrics[line + 1]} onclick={() => act({ do: 'media', action: 'seek', positionMs: extras.lyrics![line + 1]!.t })}>{extras.lyrics[line + 1]?.text ?? ''}</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .music { background: linear-gradient(to top, rgba(var(--album), 0.22), transparent 70%); border-radius: 0 0 26px 26px; }
  .top { display: flex; gap: 14px; align-items: center; }
  .cover { width: 84px; height: 84px; border-radius: 14px; object-fit: cover; flex: none; box-shadow: 0 8px 24px rgba(var(--album), 0.35); }
  .cover.none { display: grid; place-items: center; background: var(--surface2); color: var(--muted); }
  .info { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .title { font-weight: 700; font-size: 1.12em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .controls { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
  .play { background: var(--text); color: var(--background); }
  .vol { margin-inline-start: auto; display: inline-flex; align-items: center; gap: 6px; color: var(--muted); }
  .vol input { width: 90px; }
  /* a 5 px line in a 21 px target (Fitts; WCAG 2.5.8) */
  .progress { height: 5px; padding: 8px 0; margin: -8px 0; background: var(--surface2) content-box; }
  .progress.seekable { cursor: pointer; }
  .fill { height: 100%; border-radius: 3px; background: rgb(var(--album)); transition: width 1s linear; }
  .times { display: flex; justify-content: space-between; font-size: 0.82em; margin-top: -6px; font-variant-numeric: tabular-nums; }
  button.ly { background: none; padding: 0 8px; border-radius: var(--r-s); font: inherit; }
  button.ly:not(:disabled):hover { color: var(--text); background: var(--surface1); }
  button.ly:disabled { opacity: 1; cursor: default; }
  .lyrics { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0 6px; text-align: center; }
  .ly { min-height: 1.4em; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ly.now { font-size: 1.15em; font-weight: 700; }
</style>
