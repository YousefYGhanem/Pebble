<script lang="ts">
  // Widgets: every connector's card, and the connectors that need something (a key, a city…) or failed.
  import type { ConnectorInfo, Widget } from '../../shared/connectors'
  import type { Action } from '../../shared/extras'
  import WidgetCard from './WidgetCard.svelte'
  import { t, tOr } from '../i18n.svelte'

  let { widgets, connectors, now, act }: { widgets: Widget[]; connectors: ConnectorInfo[]; now: number; act: (a: Action) => void } = $props()
  const cards = $derived(widgets.filter(w => w.kind !== 'chip'))
  const trouble = $derived(connectors.filter(c => c.enabled && c.problem))
</script>

<div class="page">
  <div class="page-head"><span class="page-title">{t('i.page.widgets')}</span><span class="page-time">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span class="pip-room"></span></div>
  {#if !cards.length && !trouble.length}
    <div class="empty">{t('i.widgets.none')}</div>
  {/if}
  {#if cards.length}
    <div class="grid">
      {#each cards as w (w.plugin + '/' + w.id)}<WidgetCard {w} onopen={() => act({ do: 'widget.open', plugin: w.plugin, id: w.id })} />{/each}
    </div>
  {/if}
  {#each trouble as c (c.id)}<div class="trouble"><b>{tOr(`c.${c.id}.name`, c.name)}:</b> {c.problem}</div>{/each}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; max-height: 280px; overflow: auto; padding-bottom: 4px; }
  .trouble { font-size: 0.86em; color: var(--question); padding-bottom: 6px; }
</style>
