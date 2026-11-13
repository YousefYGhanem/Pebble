<script lang="ts">
  // Home: a small dashboard. The date and time, Wi-Fi and Bluetooth switches, and a tile for each part of Pebble that
  // has something going on; a click goes to its page.
  import type { Action, ExtrasState } from '../../shared/extras'
  import { focusLeft, nextDue, todayProgress } from '../../shared/extras'
  import type { Session } from '../../shared/state'
  import Icon from './Icon.svelte'
  import { clock, type Page } from './pages'
  import type { Widget } from '../../shared/connectors'
  import WidgetCard from './WidgetCard.svelte'
  import { locale, t } from '../i18n.svelte'
  import { AGENT_NAMES, type Agent } from '../../shared/state'
  import { daysAt, spentOf, type Days, type Spent } from '../../shared/today'

  let { sessions, extras, widgets = [], day, update = null, now, act, go }: { sessions: Session[]; extras: ExtrasState; widgets?: Widget[]; day: Days; update?: string | null; now: number; act: (a: Action) => void; go: (p: Page) => void } = $props()
  // what your agents did today (yesterday's, until today has something)
  const days = $derived(daysAt(day, now))
  const todos = $derived(todayProgress(extras.todos, now))
  const next = $derived(nextDue(extras.todos))
  const shownDay = $derived(days.today.tasks || Object.values(days.today.spent).some(x => spentOf(x!) > 0) ? { d: days.today, label: t('i.day.today') } : days.yesterday ? { d: days.yesterday, label: t('i.day.yesterday') } : null)
  const span = (s: number) => s >= 3600 ? t('i.day.h', { h: Math.floor(s / 3600), m: Math.round((s % 3600) / 60) }) : t('i.day.m', { m: Math.max(1, Math.round(s / 60)) })
  const compact = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n)
  const spentLine = (a: string, s: Spent) => s.unit === '%' ? t('i.day.week', { agent: AGENT_NAMES[a as Agent], n: Math.round(spentOf(s)) }) : t('i.day.tokens', { agent: AGENT_NAMES[a as Agent], n: compact(spentOf(s)) })
  const cards = $derived(widgets.filter(w => w.kind === 'card').slice(0, 4))
  const date = $derived(new Date(now))
  const busy = $derived(sessions.filter(s => s.status === 'running' || s.status === 'question'))
  const r = $derived(extras.radios)
</script>

<div class="page">
  <div class="page-head">
    <div class="when">
      <span class="big">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span class="muted">{date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
    <span class="page-time"></span>
    {#if update}<button class="likely" onclick={() => act({ do: 'update.install' })}><Icon name="download" size={13} />{t('i.home.update', { version: update })}</button>{/if}
    {#if r}
      <button class="radio" class:on={r.wifi} title={t('i.home.wifi')} aria-label="Wi-Fi" aria-pressed={!!r.wifi}
        onclick={() => act({ do: 'radio', kind: 'wifi', on: !r.wifi })} oncontextmenu={e => { e.preventDefault(); act({ do: 'open', what: 'wifi' }) }}><Icon name="wifi" size={15} /></button>
      <button class="radio" class:on={r.bluetooth} title={t('i.home.bluetooth')} aria-label="Bluetooth" aria-pressed={!!r.bluetooth}
        onclick={() => act({ do: 'radio', kind: 'bluetooth', on: !r.bluetooth })} oncontextmenu={e => { e.preventDefault(); act({ do: 'open', what: 'bluetooth' }) }}><Icon name="bluetooth" size={15} /></button>
    {/if}
    <button class="radio" title={t('i.home.settings')} aria-label={t('i.home.settings')} onclick={() => act({ do: 'settings.open' })}><Icon name="settings" size={15} /></button>
    <span class="pip-room"></span>
  </div>

  <div class="tiles">
    <button class="tile" onclick={() => go('agents')}>
      <span class="label"><Icon name="agents" size={13} />{t('i.page.agents')}</span>
      {#if busy.length}<span class="value">{t('i.home.working', { n: busy.length })}</span><span class="muted line">{busy[0]!.project} · {busy[0]!.detail}</span>
      {:else if sessions.length}<span class="value">{t('i.home.allDone')}</span><span class="muted line">{sessions[0]!.project}</span>
      {:else}<span class="value muted">{t('i.home.quiet')}</span>{/if}
    </button>

    <div class="tilewrap">
    <button class="tile" onclick={() => go('music')} aria-label={extras.media ? `${t('i.home.openMusic')}: ${extras.media.title}` : undefined}>
      <span class="label"><Icon name="music" size={13} />{t('i.page.music')}</span>
      {#if extras.media}
        <span class="music">
          {#if extras.art}<img src={extras.art} alt="" />{/if}
          <span class="line"><b>{extras.media.title}</b><br /><span class="muted">{extras.media.artist}</span></span>
        </span>
      {:else}<span class="value muted">{t('i.home.nothingPlaying')}</span>{/if}
    </button>
      <!-- its own button, next to the tile (not inside it): the keyboard reaches it too -->
      {#if extras.media}<button class="playpause" aria-label={extras.media.playing ? t('i.common.pause') : t('i.common.play')}
        onclick={() => act({ do: 'media', action: 'toggle' })}><Icon name={extras.media.playing ? 'pause' : 'play'} size={13} /></button>{/if}
    </div>

    <button class="tile" onclick={() => go('focus')}>
      <span class="label"><Icon name="focus" size={13} />{t('i.page.focus')}</span>
      {#if extras.focus}<span class="value">{clock(focusLeft(extras.focus, now) * 1000)}</span><span class="muted line">{extras.focus.left !== undefined ? t('i.home.paused') : t('i.home.left')}</span>
      {:else}<span class="value muted">{t('i.home.startTimer')}</span>{/if}
    </button>

    <!-- always Files, in the same place (spatial memory) -->
    <button class="tile" onclick={() => go('files')}>
      <span class="label"><Icon name="files" size={13} />{t('i.page.files')}</span>
      {#if extras.shelf.length}<span class="value">{t('i.home.onShelf', { n: extras.shelf.length })}</span>
      {:else}<span class="value muted">{t('i.home.empty')}</span><span class="muted line">{t('i.home.dropHint')}</span>{/if}
    </button>
  </div>

  {#if cards.length}
    <div class="tiles">
      {#each cards as w (w.plugin + '/' + w.id)}<WidgetCard {w} onopen={() => act({ do: 'widget.open', plugin: w.plugin, id: w.id })} />{/each}
    </div>
  {/if}

  {#if shownDay}
    {@const d = shownDay.d}
    <button class="day" onclick={() => go('agents')}>
      <span class="label"><Icon name="agents" size={13} />{shownDay.label}</span>
      <span class="facts">
        <span class="value">{t('i.day.done', { n: d.tasks })}</span>
        {#if d.seconds}<span>{t('i.day.time', { time: span(d.seconds) })}</span>{/if}
        {#if d.files}<span>{t('i.day.files', { n: d.files })}</span>{/if}
        {#each Object.entries(d.spent) as [a, s]}{#if spentOf(s!) > 0}<span class="muted">{spentLine(a, s!)}</span>{/if}{/each}
      </span>
    </button>
  {/if}

  {#if extras.prayer}<span class="todoline muted"><Icon name="moon" size={13} />{t('i.prayer.next', { name: t(`prayer.${extras.prayer.name}`), time: new Date(extras.prayer.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</span>{/if}
  {#if extras.glasses}<span class="todoline muted"><Icon name="water" size={13} />{t('i.well.today', { n: extras.glasses })}</span>{/if}
  {#if todos.total}
    <button class="todoline" onclick={() => go('notes')}><Icon name="check" size={13} />{t('i.todo.today', { done: todos.done, total: todos.total })}
      {#if next}<span class="muted">· {t('i.todo.next', { text: next.text, time: new Date(next.due!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</span>{/if}</button>
  {/if}

  <!-- quick controls: what you change often, one click away -->
  <div class="quick">
    {#if extras.volume}
      <label class="vol" title={t('i.music.volume')}>
        <button class="qbtn" aria-label={t(extras.volume.muted ? 'i.quick.unmute' : 'i.quick.mute')} aria-pressed={extras.volume.muted} onclick={() => act({ do: 'volume', muted: !extras.volume!.muted })}><Icon name={extras.volume.muted ? 'mute' : 'volume'} size={14} /></button>
        <input type="range" min="0" max="100" value={extras.volume.level} onchange={e => act({ do: 'volume', volume: Number((e.currentTarget as HTMLInputElement).value) })} aria-label={t('i.music.volume')} />
      </label>
    {/if}
    {#if extras.mic !== null}
      <button class="qbtn" class:off={extras.mic} aria-pressed={extras.mic} title={t(extras.mic ? 'i.quick.micOn' : 'i.quick.micOff')} aria-label={t(extras.mic ? 'i.quick.micOn' : 'i.quick.micOff')} onclick={() => act({ do: 'mic.toggle' })}><Icon name={extras.mic ? 'micoff' : 'mic'} size={14} /></button>
    {/if}
    {#if extras.power}
      <div class="power" role="group" aria-label={t('i.quick.power')}>
        {#each ['efficiency', 'balanced', 'performance'] as const as p}<button class:on={extras.power === p} aria-pressed={extras.power === p} onclick={() => act({ do: 'power', mode: p })}>{t(`i.quick.${p}`)}</button>{/each}
      </div>
    {/if}
    <span class="load muted">CPU {extras.system.cpu}% · RAM {extras.system.ram}%</span>
  </div>
</div>

<style>
  .quick { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; font-size: 0.85em; }
  .vol { display: inline-flex; align-items: center; gap: 4px; }
  .vol input { width: 110px; }
  .qbtn { width: 30px; height: 28px; padding: 0; display: inline-grid; place-items: center; background: var(--surface1); color: var(--text); }
  .qbtn.off { color: var(--error); }
  .power { display: flex; gap: 2px; padding: 2px; border-radius: var(--r-pill); background: var(--surface1); }
  .power button { padding: 3px 10px; background: none; color: var(--muted); }
  .power button.on { background: var(--surface3); color: var(--text); }
  .load { margin-inline-start: auto; font-variant-numeric: tabular-nums; }
  .todoline { display: flex; align-items: center; gap: 8px; background: none; padding: 2px 4px; font-size: 0.88em; text-align: start; }
  .todoline .muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when { display: flex; align-items: baseline; gap: 10px; }
  .big { font-size: 1.5em; font-weight: 700; font-variant-numeric: tabular-nums; }
  .radio { width: 32px; height: 32px; padding: 0; display: grid; place-items: center; background: var(--surface2); color: var(--muted); }
  .radio.on { background: var(--accent); color: var(--on-accent); }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: start; min-height: 92px; padding: 10px 12px; border-radius: 16px; background: var(--surface1); }
  .tile:hover { background: var(--surface2); }
  .label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 0.85em; }
  .value { font-weight: 600; }
  .line { max-width: 100%; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.86em; }
  .music { display: flex; gap: 8px; align-items: center; min-width: 0; }
  .music img { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex: none; }
  .tilewrap { position: relative; display: grid; }
  .playpause { position: absolute; inset-inline-end: 8px; top: 8px; width: 28px; height: 28px; padding: 0; border-radius: 50%; display: grid; place-items: center; background: var(--text); color: var(--background); }
  .day { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: start; padding: 10px 12px; border-radius: 16px; background: var(--surface1); }
  .day:hover { background: var(--surface2); }
  .facts { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.9em; }
</style>
