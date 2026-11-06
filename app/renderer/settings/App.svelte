<script lang="ts">
  // The Settings window. Every control saves at once through main (settings.json, checked by the same schema); main
  // sends the whole view back after each change, so what you see is always what is saved.
  import { applyTheme } from '../theme'
  import { LANGUAGES, setLanguage, t, tOr } from '../i18n.svelte'
  import { accelerator, type SettingsAction, type SettingsView } from '../../shared/settings-ui'
  import { CHIPS } from '../../shared/settings'
  import { SCENES, type Scene } from '../../shared/island'
  import { OUTFITS } from '../../shared/pip'
  import { PROVIDERS } from '../../shared/chat'

  let v = $state<SettingsView>()
  let tab = $state('general')
  let pickFilter = $state('')
  let recording = $state<'toggleShortcut' | 'tuckShortcut' | 'buddyShortcut' | 'voiceShortcut' | null>(null)

  window.settingsApi.onView(next => { v = next; applyTheme(next.theme); setLanguage(next.settings.general.language) })
  window.settingsApi.ready()

  const act = (a: SettingsAction) => window.settingsApi.act(a)
  /** set('island.style', 'notch') → { island: { style: 'notch' } } */
  function set(path: string, value: unknown) {
    const patch = path.split('.').reduceRight<unknown>((inner, k) => ({ [k]: inner }), value)
    act({ do: 'update', patch: patch as Record<string, unknown> })
  }
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value)
  const text = (e: Event) => (e.currentTarget as HTMLInputElement).value

  const TABS = ['general', 'island', 'look', 'agents', 'chat', 'extras', 'connectors', 'advanced'] as const
  const SHELLS: Record<string, string> = { powershell: 'Windows PowerShell', pwsh: 'PowerShell 7', bash: 'Git Bash' }
  const SHORTCUTS = ['toggleShortcut', 'tuckShortcut', 'buddyShortcut', 'voiceShortcut'] as const
  const SIZES = [['restingWidth', 60, 600], ['restingHeight', 20, 60], ['width', 120, 1200], ['height', 24, 80], ['askWidth', 200, 1200], ['openWidth', 300, 1400], ['offsetTop', 0, 200]] as const

  function record(e: KeyboardEvent) {
    if (!recording) return
    e.preventDefault()
    if (e.key === 'Escape') { recording = null; return }
    if (e.key === 'Backspace' || e.key === 'Delete') { set(`general.${recording}`, ''); recording = null; return }
    const keys = accelerator(e)
    if (keys) { set(`general.${recording}`, keys); recording = null }
  }
  // Pip's chat: the model list comes from the provider (again when you switch provider or add a key)
  $effect(() => {
    if (tab !== 'chat' || !v) return
    const m = v.chatModels
    if (!m || (m.provider !== v.settings.chat.provider && !m.loading)) act({ do: 'chat.models' })
  })
  const diagnosis = $derived(v?.diagnostics && v.diagnostics !== 'running' ? v.diagnostics : null)
</script>

<svelte:window onkeydown={record} />

{#if v}
  {@const s = v.settings}
  {@const pip = s.pip.name}
  <div class="shell">
    <nav aria-label={t('nav.label')}>
      <div class="brand">Pebble <span class="muted">{v.version}</span></div>
      {#each TABS as id}
        <button class:active={tab === id} aria-current={tab === id ? 'page' : undefined} onclick={() => (tab = id)}>{t(`tab.${id}`)}</button>
      {/each}
    </nav>

    <main>
      {#if v.error}<div class="error" role="alert">{t('notSaved', { error: v.error })}</div>{/if}

      {#if tab === 'general'}
        <h1>{t('tab.general')}</h1>
        <section>
          <label class="row"><span>{t('general.language')}<small>{t('general.languageHint')}</small></span>
            <select value={s.general.language} onchange={e => set('general.language', text(e))}>
              {#each LANGUAGES as l}<option value={l.id}>{l.name}</option>{/each}
            </select></label>
          <label class="row"><span>{t('general.startWithWindows')}</span>
            <input type="checkbox" class="switch" checked={s.general.startWithWindows} onchange={() => set('general.startWithWindows', !s.general.startWithWindows)} /></label>
          {#each SHORTCUTS as key}
            <div class="row"><span>{t(`general.${key}`, { pip })}</span>
              <button class="key" class:rec={recording === key} onclick={() => (recording = recording === key ? null : key)}>
                {recording === key ? t('general.pressKeys') : s.general[key] || t('general.none')}
              </button></div>
          {/each}
          <button class="link" onclick={() => act({ do: 'welcome' })}>{t('general.welcome')}</button>
        </section>
        <h2>{t('update.title')} <span class="muted">· {v.version}</span></h2>
        <section>
          <label class="row"><span>{t('update.auto')}<small>{t('update.autoHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.general.updates} onchange={() => set('general.updates', !s.general.updates)} /></label>
          <div class="row"><span>{t(`update.${v.update.state}`, { version: v.update.version ?? '', percent: v.update.percent ?? 0, error: v.update.error ?? '' })}</span>
            {#if v.update.state === 'ready'}<button onclick={() => act({ do: 'update.install' })}>{t('update.install')}</button>
            {:else if v.update.state !== 'off'}<button disabled={v.update.state === 'checking' || v.update.state === 'downloading'} onclick={() => act({ do: 'update.check' })}>{t('update.check')}</button>{/if}</div>
        </section>
        <h2>{t('notify.title')}</h2>
        <section>
          <label class="row"><span>{t('notify.toasts')}<small>{t('notify.toastsHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.features.toasts} onchange={() => set('features.toasts', !s.features.toasts)} /></label>
          <label class="row"><span>{t('notify.sound')}</span>
            <input type="checkbox" class="switch" checked={s.features.sound} onchange={() => set('features.sound', !s.features.sound)} /></label>
          <label class="row"><span>{t('notify.doneSeconds')}<small>{t('unit.seconds')}</small></span>
            <input type="number" min="1" max="600" value={s.features.doneSeconds} onchange={e => set('features.doneSeconds', num(e))} /></label>
        </section>

      {:else if tab === 'island'}
        <h1>{t('tab.island')}</h1>
        <section>
          <div class="row"><span>{t('island.shape')}</span>
            <div class="seg">
              <button class:on={s.island.style === 'notch'} onclick={() => set('island.style', 'notch')}>{t('island.notch')}</button>
              <button class:on={s.island.style === 'floating'} onclick={() => set('island.style', 'floating')}>{t('island.floating')}</button>
            </div></div>
          <div class="row"><span>{t('island.opens')}</span>
            <div class="seg">
              <button class:on={s.island.openOn === 'hover'} onclick={() => set('island.openOn', 'hover')}>{t('island.hover')}</button>
              <button class:on={s.island.openOn === 'click'} onclick={() => set('island.openOn', 'click')}>{t('island.click')}</button>
            </div></div>
          {#if v.displays.length > 1}
            <label class="row"><span>{t('island.screen')}</span>
              <select value={String(s.island.display)} onchange={e => { const x = text(e); set('island.display', x === 'main' ? 'main' : Number(x)) }}>
                <option value="main">{t('island.mainScreen')}</option>
                {#each v.displays as d}<option value={String(d.id)}>{d.label}</option>{/each}
              </select></label>
          {/if}
          <label class="row"><span>{t('island.gameMode')}</span>
            <input type="checkbox" class="switch" checked={s.island.gameMode} onchange={() => set('island.gameMode', !s.island.gameMode)} /></label>
          <label class="row"><span>{t('island.seeThrough')}<small>{s.island.seeThrough}%</small></span>
            <input type="range" min="0" max="60" value={s.island.seeThrough} onchange={e => set('island.seeThrough', num(e))} /></label>
          <label class="row"><span>{t('island.skins')}<small>{t('island.skinsHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.island.skins} onchange={() => set('island.skins', !s.island.skins)} /></label>
        </section>
        <h2>{t('island.resting')}</h2>
        <section>
          {#each ['left', 'right'] as const as side}
            <label class="row"><span>{t(`island.${side}`, { pip })}</span>
              <select value={s.island.chips[side]} onchange={e => set(`island.chips.${side}`, text(e))}>
                {#each CHIPS as c}<option value={c}>{t(`chip.${c}`)}</option>{/each}
                {#each v.chipWidgets as w}<option value={w.id}>{w.label}</option>{/each}
              </select></label>
          {/each}
        </section>
        <h2>{t('island.size')}</h2>
        <section>
          {#each SIZES as [key, min, max]}
            <label class="row"><span>{t(`size.${key}`)}<small>{t('unit.px', { min, max })}</small></span>
              <input type="number" {min} {max} value={s.island[key]} onchange={e => set(`island.${key}`, num(e))} /></label>
          {/each}
        </section>

      {:else if tab === 'look'}
        <h1>{t('tab.look')}</h1>
        <section>
          <label class="row"><span>{t('look.theme')}</span>
            <select value={s.theme} onchange={e => set('theme', text(e))}>
              {#each v.themes as th}<option value={th.id}>{tOr(`theme.${th.id}`, th.name)}</option>{/each}
            </select></label>
          <div class="row"><span>{t('look.motion')}</span>
            <div class="seg">
              {#each ['system', 'full', 'reduced'] as const as m}
                <button class:on={s.motion.mode === m} onclick={() => set('motion.mode', m)}>{t(`motion.${m}`)}</button>
              {/each}
            </div></div>
          <label class="row"><span>{t('look.speed')}<small>{s.motion.speed.toFixed(2)}×</small></span>
            <input type="range" min="0.5" max="2" step="0.05" value={s.motion.speed} onchange={e => set('motion.speed', num(e))} /></label>
          <button class="link" onclick={() => act({ do: 'open', what: 'themes' })}>{t('look.themesFolder')}</button>
        </section>
        <h2>{pip} <span class="muted">· {t('pip.done', { count: v.pip.done })}</span></h2>
        <section>
          <label class="row"><span>{t('pip.name')}<small>{t('pip.nameHint')}</small></span>
            <input type="text" maxlength="24" value={s.pip.name} onchange={e => set('pip.name', text(e).trim() || 'Pip')} /></label>
          <div class="outfits">
            {#each [{ id: 'auto', name: t('pip.auto'), ok: true, hint: '' }, { id: 'none', name: t('pip.none'), ok: true, hint: '' },
              ...OUTFITS.map(o => ({ id: o.id, name: tOr(`o.${o.id}`, o.name), ok: v!.pip.wearable.includes(o.id), hint: o.tasks !== undefined ? t('pip.tasks', { count: o.tasks }) : t('pip.inSeason') })),
              ...v.pip.custom.map(id => ({ id, name: id, ok: true, hint: t('pip.yours') }))] as o}
              <button class="outfit" class:on={s.pip.outfit === o.id} disabled={!o.ok} onclick={() => set('pip.outfit', o.id)}>
                {o.name}{#if o.hint && (!o.ok || o.hint === t('pip.yours'))}<small>{o.hint}</small>{/if}
              </button>
            {/each}
          </div>
          <button class="link" onclick={() => act({ do: 'open', what: 'outfits' })}>{t('pip.addOutfit')}</button>
          <label class="row"><span>{t('pip.followMouse')}</span>
            <input type="checkbox" class="switch" checked={s.pip.followMouse} onchange={() => set('pip.followMouse', !s.pip.followMouse)} /></label>
          <label class="row"><span>{t('pip.sleep')}<small>{t('unit.minutesAway')}</small></span>
            <input type="number" min="1" max="240" value={s.pip.sleepAfterMinutes} onchange={e => set('pip.sleepAfterMinutes', num(e))} /></label>
        </section>

      {:else if tab === 'agents'}
        <h1>{t('tab.agents')}</h1>
        <section>
          {#each v.agents as g}
            <label class="row"><span>{g.name}<small>{t(g.connected ? 'agents.connected' : g.available ? 'agents.found' : 'agents.notFound')}</small></span>
              <input type="checkbox" class="switch" checked={g.connected} onchange={() => act({ do: 'agent', id: g.id })} /></label>
          {/each}
          <label class="row"><span>{t('agents.permissions')}</span>
            <input type="checkbox" class="switch" checked={s.agents.claude.answerPermissions} onchange={() => set('agents.claude.answerPermissions', !s.agents.claude.answerPermissions)} /></label>
        </section>
        <h2>{t('terminals.title')} <span class="muted">· {t('terminals.hint')}</span></h2>
        <section>
          {#each v.terminals as term}
            <label class="row"><span>{SHELLS[term.id] ?? term.id}<small>{t('terminals.newOnly')}</small></span>
              <input type="checkbox" class="switch" checked={term.on} onchange={() => act({ do: 'terminal', id: term.id })} /></label>
          {/each}
          <label class="row"><span>{t('terminals.min')}<small>{t('unit.seconds')}</small></span>
            <input type="number" min="1" max="3600" value={s.terminals.minSeconds} onchange={e => set('terminals.minSeconds', num(e))} /></label>
        </section>

      {:else if tab === 'chat'}
        {@const p = PROVIDERS.find(x => x.id === s.chat.provider)!}
        {@const models = v.chatModels?.provider === s.chat.provider ? v.chatModels : undefined}
        <h1>{t('tab.chat')}</h1>
        <section>
          <label class="row"><span>{t('chat.who')}<small>{t('chat.whoHint')}</small></span>
            <select value={s.chat.provider} onchange={e => set('chat', { provider: text(e), model: '' })}>
              {#each PROVIDERS as x}<option value={x.id}>{x.name}</option>{/each}
            </select></label>
          <label class="row"><span>{t('chat.model')}<small>{models?.loading ? t('chat.modelsLoading') : models?.error ? t('chat.modelsError', { error: models.error }) : t('chat.modelHint')}</small></span>
            <select value={s.chat.model} onchange={e => set('chat.model', text(e))}>
              <option value="">{t('chat.modelDefault', { model: p.model || t('chat.cliDefault') })}</option>
              {#if s.chat.model && !models?.list.some(m => m.id === s.chat.model)}<option value={s.chat.model}>{s.chat.model}</option>{/if}
              {#each models?.list ?? [] as m}<option value={m.id}>{m.name === m.id ? m.id : `${m.name} (${m.id})`}</option>{/each}
            </select></label>
          <label class="row"><span>{t('chat.readAloud')}<small>{t('chat.readAloudHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.chat.readAloud} onchange={() => set('chat.readAloud', !s.chat.readAloud)} /></label>
        </section>
        <h2>{t('chat.keys')} <span class="muted">· {t('chat.keysHint')}</span></h2>
        <section>
          {#each PROVIDERS.filter(x => x.key) as x}
            <label class="row"><span>{x.name}</span>
              <input type="password" autocomplete="off" placeholder={t(v.chatKeys[x.id] ? 'secret.saved' : 'secret.notSet')}
                onchange={e => { const k = text(e); (e.currentTarget as HTMLInputElement).value = ''; act({ do: 'chat.key', provider: x.id, value: k }) }} /></label>
          {/each}
        </section>
        <h2>{t('apps.title')} <span class="muted">· {t('apps.hint')}</span></h2>
        <div class="problem" role="note">{t('apps.warning')}</div>
        <section>
          <div class="col"><span>{t('apps.browser')}<small>{t('apps.browserHint')}</small></span></div>
          <div class="row"><span>{t('apps.folder')}<small>{v.extension.folder}</small></span><button onclick={() => act({ do: 'open', what: 'extension' })}>{t('apps.openFolder')}</button></div>
          <div class="row"><span>{t('apps.key')}<small>{t('apps.port', { port: v.extension.port })}</small></span><button class="key" onclick={() => act({ do: 'copyExtensionKey' })}>{t('apps.copyKey')}</button></div>
        </section>
        <h2>{t('apps.desktop')} <span class="muted">· {t('apps.desktopHint')}</span></h2>
        <section>
          {#each ['claude', 'chatgpt'] as const as id}
            <label class="row"><span>{t(`apps.${id}`)}<small>{t('apps.emptyOnly')}</small></span>
              <input type="checkbox" class="switch" checked={s.chatApps.desktop.includes(id)}
                onchange={() => set('chatApps.desktop', s.chatApps.desktop.includes(id) ? s.chatApps.desktop.filter(x => x !== id) : [...s.chatApps.desktop, id])} /></label>
          {/each}
        </section>

      {:else if tab === 'extras'}
        <h1>{t('tab.extras')}</h1>
        <section>
          <label class="row"><span>{t('extras.music')}<small>{t('extras.musicHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.music.enabled} onchange={() => set('music.enabled', !s.music.enabled)} /></label>
          <label class="row"><span>{t('extras.lyrics')}<small>{t('extras.lyricsHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.music.lyrics} disabled={!s.music.enabled} onchange={() => set('music.lyrics', !s.music.lyrics)} /></label>
          <label class="row"><span>{t('extras.clipboard')}<small>{t('extras.clipboardHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.clipboard.enabled} onchange={() => set('clipboard.enabled', !s.clipboard.enabled)} /></label>
        </section>
        <h2>{t('guard.title')}</h2>
        <section>
          <label class="row"><span>{t('guard.enabled')}</span>
            <input type="checkbox" class="switch" checked={s.focusGuard.enabled} onchange={() => set('focusGuard.enabled', !s.focusGuard.enabled)} /></label>
          <label class="col"><span>{t('guard.sites')}<small>{t('guard.sitesHint')}</small></span>
            <textarea rows="5" value={s.focusGuard.sites.join('\n')}
              onchange={e => set('focusGuard.sites', text(e).split('\n').map(x => x.trim()).filter(Boolean))}></textarea></label>
          <label class="row"><span>{t('guard.snooze')}<small>{t('unit.minutes')}</small></span>
            <input type="number" min="1" max="120" value={s.focusGuard.snoozeMinutes} onchange={e => set('focusGuard.snoozeMinutes', num(e))} /></label>
        </section>

      {:else if tab === 'connectors'}
        <h1>{t('tab.connectors')}</h1>
        {#each v.connectors as c (c.id)}
          <section class="card">
            <label class="row head"><span><b>{tOr(`c.${c.id}.name`, c.name)}</b>{#if !c.builtIn}<em>{t('connectors.yours')}</em>{/if}<small>{tOr(`c.${c.id}.desc`, c.description)}</small></span>
              <input type="checkbox" class="switch" checked={c.enabled} onchange={() => act({ do: 'connector', id: c.id })} /></label>
            {#if c.enabled && c.problem}<div class="problem">{c.problem}</div>{/if}
            {#each c.fields as f (f.key)}
              {#if f.pick}
                {@const open = v.connectorPick?.id === c.id && v.connectorPick.key === f.key ? v.connectorPick : undefined}
                <div class="col"><span>{tOr(`c.${c.id}.${f.key}`, f.label)}{#if f.value}<small>{t('pick.current', { value: String(f.value) })}</small>{/if}</span>
                  <div class="pickbar">
                    <button onclick={() => { pickFilter = ''; act({ do: 'connector.pick', id: c.id, key: f.key }) }} disabled={open?.loading}>{t(open?.loading ? 'pick.finding' : 'pick.find')}</button>
                    {#if open}<button class="link" onclick={() => act({ do: 'connector.pickClose' })}>{t('pick.close')}</button>{/if}
                  </div>
                  {#if open?.error}<div class="problem">{open.error}</div>{/if}
                  {#if open?.items.length}
                    <input type="text" placeholder={t('pick.filter')} bind:value={pickFilter} />
                    <div class="picks">
                      {#each open.items.filter(x => !pickFilter || (x.label + ' ' + x.value).toLowerCase().includes(pickFilter.toLowerCase())).slice(0, 80) as x}
                        <button class="pick" onclick={() => act({ do: 'connector.set', id: c.id, key: f.key, value: x.path })}><span>{x.label}</span><b>{x.value}</b></button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {:else if f.type === 'boolean'}
                <label class="row"><span>{tOr(`c.${c.id}.${f.key}`, f.label)}</span>
                  <input type="checkbox" class="switch" checked={f.value === true} onchange={() => act({ do: 'connector.set', id: c.id, key: f.key, value: f.value !== true })} /></label>
              {:else}
                <label class="row"><span>{tOr(`c.${c.id}.${f.key}`, f.label)}{#if f.required}<small>{t('connectors.needed')}</small>{/if}</span>
                  {#if f.secret}
                    <input type="password" autocomplete="off" placeholder={t(f.set ? 'secret.saved' : 'secret.notSet')}
                      onchange={e => { const x = text(e); (e.currentTarget as HTMLInputElement).value = ''; act({ do: 'connector.set', id: c.id, key: f.key, value: x }) }} />
                  {:else if f.type === 'number'}
                    <input type="number" value={f.value as number} onchange={e => act({ do: 'connector.set', id: c.id, key: f.key, value: num(e) })} />
                  {:else if f.type === 'list'}
                    <input type="text" value={Array.isArray(f.value) ? f.value.join(', ') : ''} placeholder={t('connectors.list')}
                      onchange={e => act({ do: 'connector.set', id: c.id, key: f.key, value: text(e).split(',').map(x => x.trim()).filter(Boolean) })} />
                  {:else}
                    <input type="text" value={String(f.value ?? '')} onchange={e => act({ do: 'connector.set', id: c.id, key: f.key, value: text(e) })} />
                  {/if}</label>
              {/if}
            {/each}
            {#if c.webhook && c.running}<button class="link" onclick={() => act({ do: 'copyWebhook', id: c.id })}>{t('connectors.webhook')}</button>{/if}
          </section>
        {/each}
        <section class="actions">
          <button onclick={() => act({ do: 'open', what: 'plugins' })}>{t('connectors.add')}</button>
          <button onclick={() => act({ do: 'open', what: 'connectors' })}>{t('connectors.edit')}</button>
        </section>

      {:else}
        <h1>{t('tab.advanced')}</h1>
        <section>
          <label class="row"><span>{t('advanced.scene')}<small>{t('advanced.sceneHint')}</small></span>
            <select value={v.scene ?? ''} onchange={e => act({ do: 'scene', scene: (text(e) || null) as Scene | null })}>
              <option value="">{t('advanced.sceneOff')}</option>
              {#each Object.entries(SCENES) as [id, label]}<option value={id}>{label}</option>{/each}
            </select></label>
          <label class="row"><span>{t('advanced.port')}<small>{t('advanced.portHint')}</small></span>
            <input type="number" min="1024" max="65535" value={s.server.port} onchange={e => set('server.port', num(e))} /></label>
        </section>
        <h2>{t('diag.title')} <span class="muted">· {t('diag.hint')}</span></h2>
        <section>
          {#if diagnosis}
            {#each diagnosis as d}
              <div class="row"><span>{d.name}{#if d.detail}<small>{d.detail}</small>{/if}</span><b class={d.ok ? 'ok' : 'bad'}>{d.ok ? '✓' : '✗'}</b></div>
            {/each}
          {/if}
          <div class="row">
            <button disabled={v.diagnostics === 'running'} onclick={() => act({ do: 'diagnose' })}>{t(v.diagnostics === 'running' ? 'diag.running' : 'diag.run')}</button>
            {#if diagnosis}<button onclick={() => act({ do: 'copyDiagnostics' })}>{t('diag.copy')}</button>{/if}
          </div>
        </section>
        <section class="actions">
          <button onclick={() => act({ do: 'open', what: 'settings' })}>{t('advanced.settings')}</button>
          <button onclick={() => act({ do: 'open', what: 'log' })}>{t('advanced.log')}</button>
          <button onclick={() => act({ do: 'history.clear' })}>{t('advanced.history')}</button>
          <button onclick={() => act({ do: 'restart' })}>{t('advanced.restart')}</button>
          <button class="danger" onclick={() => act({ do: 'quit' })}>{t('advanced.quit')}</button>
        </section>
      {/if}
    </main>
  </div>
{/if}

<style>
  :global(html), :global(body) { margin: 0; height: 100%; background: var(--background); color: var(--text); font: 14px var(--font); }
  :global(*) { box-sizing: border-box; }
  .shell { display: grid; grid-template-columns: 200px 1fr; height: 100vh; }
  nav { display: flex; flex-direction: column; gap: 2px; padding: 18px 10px; background: color-mix(in srgb, var(--text) 4%, var(--background)); border-inline-end: 1px solid color-mix(in srgb, var(--text) 8%, transparent); }
  .brand { font-weight: 600; font-size: 16px; padding: 4px 12px 16px; }
  nav button { text-align: start; padding: 9px 12px; border-radius: 8px; background: none; }
  nav button:hover { background: color-mix(in srgb, var(--text) 7%, transparent); }
  nav button.active { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--text); font-weight: 600; }
  main { overflow-y: auto; padding: 24px 36px 48px; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 16px; }
  h2 { font-size: 14px; font-weight: 600; margin: 26px 0 8px; }
  .muted, small { color: var(--muted); font-weight: 400; }
  section { background: color-mix(in srgb, var(--text) 4%, transparent); border-radius: 12px; padding: 4px 16px; display: flex; flex-direction: column; animation: rise 0.18s ease-out; }
  section.card { margin-bottom: 12px; }
  section.actions { flex-direction: row; flex-wrap: wrap; gap: 8px; padding: 14px 16px; margin-top: 12px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 0; min-height: 48px; }
  .row + .row, .col + .row, .row + .col { border-top: 1px solid color-mix(in srgb, var(--text) 7%, transparent); }
  .col { display: flex; flex-direction: column; gap: 8px; padding: 11px 0; }
  .row > span, .col > span { display: flex; flex-direction: column; gap: 2px; }
  .head em { font-style: normal; font-size: 11px; color: var(--accent); }
  button, input, select, textarea { font: inherit; color: inherit; }
  button { border: 0; cursor: pointer; border-radius: 8px; padding: 8px 14px; background: color-mix(in srgb, var(--text) 9%, transparent); transition: background 0.12s; }
  button:hover { background: color-mix(in srgb, var(--text) 14%, transparent); }
  button:disabled { opacity: 0.45; cursor: default; }
  button.link { background: none; padding: 10px 0; color: var(--accent); align-self: flex-start; }
  button.danger { color: var(--error); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  input[type='number'], input[type='text'], input[type='password'], select, textarea {
    background: color-mix(in srgb, var(--text) 7%, var(--background)); border: 1px solid color-mix(in srgb, var(--text) 12%, transparent); border-radius: 8px; padding: 7px 10px;
  }
  input[type='number'] { width: 100px; }
  input[type='text'], input[type='password'], select { min-width: 240px; }
  textarea { width: 100%; resize: vertical; }
  input[type='range'] { width: 220px; accent-color: var(--accent); }
  .switch { appearance: none; width: 40px; height: 22px; border-radius: 11px; background: color-mix(in srgb, var(--text) 20%, transparent); position: relative; cursor: pointer; flex: none; transition: background 0.15s; }
  .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--text); transition: transform 0.18s cubic-bezier(.3, 1.4, .6, 1); }
  .switch:checked { background: var(--accent); }
  .switch:checked::after { transform: translateX(18px); background: var(--on-accent); }
  :global([dir="rtl"]) .switch:checked::after { transform: translateX(-18px); }
  :global([dir="rtl"]) .switch::after { left: auto; right: 3px; }
  .ok { color: var(--done); }
  .bad { color: var(--error); }
  .switch:disabled { opacity: 0.4; cursor: default; }
  .seg { display: flex; gap: 2px; padding: 2px; border-radius: 9px; background: color-mix(in srgb, var(--text) 7%, transparent); }
  .seg button { background: none; padding: 6px 12px; }
  .seg button.on { background: var(--accent); color: var(--on-accent); }
  .key { min-width: 180px; font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
  .key.rec { outline: 2px solid var(--accent); }
  .outfits { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 0 4px; }
  .outfit { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  .outfit.on { background: var(--accent); color: var(--on-accent); }
  .outfit.on small { color: inherit; }
  .error, .problem { border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; background: color-mix(in srgb, var(--error) 18%, transparent); }
  .problem { margin: 0 0 8px; font-size: 13px; }
  .pickbar { display: flex; gap: 8px; align-items: center; }
  .picks { display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow-y: auto; }
  .pick { display: flex; justify-content: space-between; gap: 16px; text-align: start; background: none; padding: 7px 10px; }
  .pick span { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pick b { font-weight: 600; white-space: nowrap; }
  @keyframes rise { from { opacity: 0; transform: translateY(4px); } }
  @media (prefers-reduced-motion: reduce) { section { animation: none; } .switch::after { transition: none; } }
</style>
