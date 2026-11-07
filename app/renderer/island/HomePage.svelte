<script lang="ts">
  // Home: a small dashboard. The date and time, Wi-Fi and Bluetooth switches, and a tile for each part of Pebble that
  // has something going on; a click goes to its page.
  import type { Action, ExtrasState } from '../../shared/extras'
  import { focusLeft } from '../../shared/extras'
  import type { Session } from '../../shared/state'
  import Icon from './Icon.svelte'
  import { clock, type Page } from './pages'
  import type { Widget } from '../../shared/connectors'
  import WidgetCard from './WidgetCard.svelte'
  import { locale, t } from '../i18n.svelte'
  import { AGENT_NAMES, type Agent } from '../../shared/state'
  import { daysAt, spentOf, type Days, type Spent } from '../../shared/today'

  let { sessions, extras, widgets = [], day, now, act, go }: { sessions: Session[]; extras: ExtrasState; widgets?: Widget[]; day: Days; now: number; act: (a: Action) => void; go: (p: Page) => void } = $props()
  // what your agents did today (yesterday's, until today has something)
  const days = $derived(daysAt(day, now))
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
      {:else}<span class="value muted">Quiet</span>{/if}
    </button>

    <button class="tile" onclick={() => go('music')}>
      <span class="label"><Icon name="music" size={13} />{t('i.page.music')}</span>
      {#if extras.media}
        <span class="music">
          {#if extras.art}<img src={extras.art} alt="" />{/if}
          <span class="line"><b>{extras.media.title}</b><br /><span class="muted">{extras.media.artist}</span></span>
        </span>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <span class="playpause" role="button" tabindex="-1" aria-label={extras.media.playing ? t('i.common.pause') : t('i.common.play')}
          onclick={e => { e.stopPropagation(); act({ do: 'media', action: 'toggle' }) }}><Icon name={extras.media.playing ? 'pause' : 'play'} size={13} /></span>
      {:else}<span class="value muted">Nothing playing</span>{/if}
    </button>

    <button class="tile" onclick={() => go('focus')}>
      <span class="label"><Icon name="focus" size={13} />{t('i.page.focus')}</span>
      {#if extras.focus}<span class="value">{clock(focusLeft(extras.focus, now) * 1000)}</span><span class="muted line">{extras.focus.left !== undefined ? t('i.home.paused') : t('i.home.left')}</span>
      {:else}<span class="value muted">Start a timer</span>{/if}
    </button>

    <button class="tile" onclick={() => go(extras.shelf.length ? 'files' : 'notes')}>
      <span class="label"><Icon name={extras.shelf.length ? 'files' : 'notes'} size={13} />{extras.shelf.length ? t('i.page.files') : t('i.page.notes')}</span>
      {#if extras.shelf.length}<span class="value">{t('i.home.onShelf', { n: extras.shelf.length })}</span>
      {:else if extras.notes.length}<span class="muted line">{extras.notes[0]!.text.split('\n')[0]}</span>
      {:else}<span class="value muted">Empty</span>{/if}
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

  <div class="system muted">
    <span>{t('i.home.cpu', { n: extras.system.cpu })}</span><span>{t('i.home.memory', { n: extras.system.ram })}</span>
  </div>
</div>

<style>
  .when { display: flex; align-items: baseline; gap: 10px; }
  .big { font-size: 1.5em; font-weight: 700; font-variant-numeric: tabular-nums; }
  .radio { width: 32px; height: 32px; padding: 0; display: grid; place-items: center; background: #ffffff12; color: var(--muted); }
  .radio.on { background: #0a84ff; color: #fff; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left; min-height: 92px; padding: 10px 12px; border-radius: 16px; background: #ffffff0d; }
  .tile:hover { background: #ffffff17; }
  .label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 0.85em; }
  .value { font-weight: 600; }
  .line { max-width: 100%; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.86em; }
  .music { display: flex; gap: 8px; align-items: center; min-width: 0; }
  .music img { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex: none; }
  .playpause { position: absolute; right: 8px; top: 8px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--text); color: var(--background); }
  .day { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: start; padding: 10px 12px; border-radius: 16px; background: #ffffff0d; }
  .day:hover { background: #ffffff17; }
  .facts { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.9em; }
  .system { display: flex; gap: 16px; font-size: 0.85em; padding-bottom: 6px; }
</style>
