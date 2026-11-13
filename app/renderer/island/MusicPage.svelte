<script lang="ts">
  // Music: what plays on this PC (any player, from Windows' media controls). Cover with the player it comes from, song, a
  // progress line you can click to jump (a wave while it plays), controls, volume, and the lyrics beside it: a column that
  // follows the song. The album's colour rises from the bottom of the page.
  import Empty from './Empty.svelte'
  import { lyricIndex, positionNow, type Action, type ExtrasState } from '../../shared/extras'
  import Icon from './Icon.svelte'
  import Wave from './Wave.svelte'
  import { clock, hhmm } from './pages'
  import { t } from '../i18n.svelte'

  // the player the music comes from, in words ("SpotifyAB.SpotifyMusic_…!Spotify" → "Spotify")
  const SOURCES: [RegExp, string][] = [[/spotify/i, 'Spotify'], [/msedge|edge/i, 'Edge'], [/chrome/i, 'Chrome'], [/firefox/i, 'Firefox'], [/brave/i, 'Brave'],
    [/opera/i, 'Opera'], [/applemusic|apple/i, 'Apple Music'], [/zune|mediaplayer|music\.ui/i, 'Media Player'], [/vlc/i, 'VLC'], [/youtube/i, 'YouTube'], [/deezer/i, 'Deezer'], [/tidal/i, 'TIDAL']]
  const sourceOf = (app: string) => SOURCES.find(([r]) => r.test(app))?.[1] ?? app.replace(/^.*!/, '').replace(/\.exe$/i, '').slice(0, 16)
  let lyricList = $state<HTMLDivElement>()
  // Player (both side by side) or Lyrics (the words alone, wide and big)
  let view = $state<'player' | 'lyrics'>('player')
  // each app's own volume (Windows' volume mixer): read while it is open
  let mixer = $state(false)
  $effect(() => {
    if (!mixer) return
    act({ do: 'mixer.refresh' })
    const timer = setInterval(() => act({ do: 'mixer.refresh' }), 3000)
    return () => clearInterval(timer)
  })
  // the line sung now, in the middle of the column (the list scrolls itself)
  $effect(() => {
    const el = lyricList?.children[line] as HTMLElement | undefined
    if (lyricList && el) lyricList.scrollTo({ top: el.offsetTop - lyricList.clientHeight / 2 + el.offsetHeight / 2, behavior: reduced ? 'auto' : 'smooth' })
  })
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
  <div class="page-head"><span class="page-title">{t('i.page.music')}</span>
    <button class="ghost" class:on={mixer} aria-pressed={mixer} onclick={() => (mixer = !mixer)}><Icon name="volume" size={13} />{t('i.mixer.apps')}</button>
    {#if m && extras.lyrics}
      <div class="seg" role="group" aria-label={t('i.music.view')}>
        <button class:on={view === 'player'} aria-pressed={view === 'player'} onclick={() => (view = 'player')}>{t('i.music.player')}</button>
        <button class:on={view === 'lyrics'} aria-pressed={view === 'lyrics'} onclick={() => (view = 'lyrics')}>{t('i.music.lyrics')}</button>
      </div>
    {/if}<span class="page-time">{hhmm(now)}</span><span class="pip-room"></span></div>
  {#if mixer}
    <div class="mixer">
      {#each extras.mixer ?? [] as app (app.name)}
        <div class="app">
          <button class="icon ghost" aria-label={t(app.muted ? 'i.quick.unmute' : 'i.quick.mute')} aria-pressed={app.muted} onclick={() => act({ do: 'mixer.set', name: app.name, muted: !app.muted })}><Icon name={app.muted ? 'mute' : 'volume'} size={14} /></button>
          <span class="aname">{app.name}</span>
          <input type="range" min="0" max="100" value={app.volume} aria-label={app.name} onchange={e => act({ do: 'mixer.set', name: app.name, volume: Number((e.currentTarget as HTMLInputElement).value) })} />
          <span class="aval">{app.volume}%</span>
        </div>
      {:else}
        <div class="empty">{t('i.mixer.none')}</div>
      {/each}
    </div>
  {:else if !m}
    <Empty icon="music" text={t('i.music.nothing')} />
  {:else}
    <div class="body" class:withLyrics={!!extras.lyrics} class:lyricsOnly={!!extras.lyrics && view === 'lyrics'}>
    <div class="player">
    <div class="top">
      <div class="coverbox">
        {#if extras.art}<img class="cover" src={extras.art} alt="" />{:else}<div class="cover none"><Icon name="music" size={28} /></div>{/if}
        {#if m.app}<span class="source">{sourceOf(m.app)}</span>{/if}
      </div>
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
      <!-- the played part waves while it plays (flat when paused) -->
      <div class="fill" class:wavy={m.playing && !reduced} style:width="{m.durationMs ? (pos / m.durationMs) * 100 : 0}%"></div>
    </div>
    <div class="times muted"><span>{clock(pos)}</span><span>{m.durationMs ? clock(m.durationMs) : ''}</span></div>
    </div>
    {#if extras.lyrics}
      <!-- every line in a column that follows the song: the one sung now is bright, the others fade; a click jumps there -->
      <div class="lyrics" bind:this={lyricList}>
        {#each extras.lyrics as l, i (i)}
          <button class="ly" class:now={i === line} class:past={i < line} disabled={!m.canSeek} onclick={() => act({ do: 'media', action: 'seek', positionMs: l.t })}>{l.text || '♪'}</button>
        {/each}
      </div>
    {/if}
    </div>
  {/if}
</div>

<style>
  .music { background: linear-gradient(to top, rgba(var(--album), 0.22), transparent 70%); border-radius: 0 0 26px 26px; }
  .mixer { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow: auto; padding-bottom: 8px; }
  .app { display: flex; align-items: center; gap: 10px; }
  .aname { width: 140px; flex: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .app input { flex: 1; }
  .aval { width: 40px; text-align: end; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 0.85em; }
  .page-head .ghost.on { color: var(--text); background: var(--surface2); }
  .body { display: flex; flex-direction: column; gap: 10px; }
  .body.withLyrics { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr); gap: 18px; align-items: start; }
  .body.lyricsOnly { grid-template-columns: 1fr; }
  .body.lyricsOnly .player { display: none; }
  .body.lyricsOnly .lyrics { height: 190px; padding: 70px 0; }
  .body.lyricsOnly .ly { text-align: center; font-size: 1.12em; }
  .body.lyricsOnly .ly.now { font-size: 1.4em; }
  .seg { display: flex; gap: 2px; padding: 2px; border-radius: var(--r-pill); background: var(--surface1); }
  .seg button { padding: 3px 12px; font-size: 0.84em; background: none; color: var(--muted); }
  .seg button.on { background: var(--surface3); color: var(--text); }
  .player { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .top { display: flex; gap: 14px; align-items: center; }
  .coverbox { position: relative; flex: none; }
  .source { position: absolute; inset-inline-end: -6px; bottom: -6px; padding: 1px 7px; border-radius: var(--r-pill); font-size: 10px; font-weight: 600;
    background: rgb(var(--album)); color: #111; box-shadow: 0 2px 8px #0006; }
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
  /* a wave cut out of the fill (a still shape: no frames to draw) */
  .fill.wavy { height: 10px; margin-top: -2.5px; border-radius: 0;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='10'%3E%3Cpath d='M0 5 Q4.5 0 9 5 T18 5' fill='none' stroke='black' stroke-width='2.4'/%3E%3C/svg%3E") repeat-x 0 0 / 18px 10px;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='10'%3E%3Cpath d='M0 5 Q4.5 0 9 5 T18 5' fill='none' stroke='black' stroke-width='2.4'/%3E%3C/svg%3E") repeat-x 0 0 / 18px 10px; }
  .times { display: flex; justify-content: space-between; font-size: 0.82em; margin-top: -6px; font-variant-numeric: tabular-nums; }
  .lyrics { display: flex; flex-direction: column; gap: 2px; height: 150px; overflow-y: auto; scrollbar-width: none; padding: 50px 0;
    -webkit-mask: linear-gradient(transparent, #000 30%, #000 70%, transparent); mask: linear-gradient(transparent, #000 30%, #000 70%, transparent); }
  .lyrics::-webkit-scrollbar { display: none; }
  .ly { background: none; padding: 2px 6px; border-radius: var(--r-s); font: inherit; text-align: start; color: var(--muted); opacity: 0.75; transition: color 0.3s, opacity 0.3s, font-size 0.3s; }
  .ly.past { opacity: 0.45; }
  .ly.now { color: var(--text); opacity: 1; font-weight: 700; font-size: 1.08em; }
  .ly:not(:disabled):hover { color: var(--text); background: var(--surface1); }
  .ly:disabled { cursor: default; }
</style>
