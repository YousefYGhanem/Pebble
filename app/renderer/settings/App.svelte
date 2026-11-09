<script lang="ts">
  // The Settings window. Every control saves at once through main (settings.json, checked by the same schema); main
  // sends the whole view back after each change, so what you see is always what is saved.
  import { applyTheme } from '../theme'
  import { LANGUAGES, setLanguage, t, tOr } from '../i18n.svelte'
  import { accelerator, THEME_COLORS, type SettingsAction, type SettingsView } from '../../shared/settings-ui'
  import { CHIPS, DEFAULTS } from '../../shared/settings'
  import { WORDS } from '../../shared/i18n'
  import { SCENES, type Scene } from '../../shared/island'
  import { OUTFITS, PIP_LOOKS, pipColors, type PipLookId } from '../../shared/pip'
  import { drawPip } from '../island/pip'
  import { PROVIDERS } from '../../shared/chat'

  let v = $state<SettingsView>()
  let tab = $state('general')
  let pickFilter = $state('')
  let recording = $state<'toggleShortcut' | 'tuckShortcut' | 'buddyShortcut' | 'voiceShortcut' | null>(null)

  let tabAsked = 0
  window.settingsApi.onView(next => {
    if (next.openTab && next.openTab.n !== tabAsked) { tabAsked = next.openTab.n; tab = next.openTab.tab }
    v = next; applyTheme(next.theme); setLanguage(next.settings.general.language) })
  window.settingsApi.ready()

  const act = (a: SettingsAction) => window.settingsApi.act(a)
  /** set('island.style', 'notch') → { island: { style: 'notch' } } */
  function set(path: string, value: unknown) {
    const patch = path.split('.').reduceRight<unknown>((inner, k) => ({ [k]: inner }), value)
    act({ do: 'update', patch: patch as Record<string, unknown> })
  }
  // clearing history waits 5 s, and the same button undoes it meanwhile
  let clearing = $state<ReturnType<typeof setTimeout> | null>(null)
  function clearHistory() {
    if (clearing) { clearTimeout(clearing); clearing = null; return }
    clearing = setTimeout(() => { clearing = null; act({ do: 'history.clear' }) }, 5000)
  }
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value)
  const text = (e: Event) => (e.currentTarget as HTMLInputElement).value

  // the icons you can choose, shown as they look (build/icons)
  const ICONS = Object.fromEntries(Object.entries(import.meta.glob<string>('../../../build/icons/*.svg', { query: '?url', import: 'default', eager: true }))
    .flatMap(([p, url]) => { const m = /\/(\w+)\.svg$/.exec(p); return m ? [[m[1]!, url]] : [] }))
  /** a still Pip in the given colours (canvas at 2x) */
  function paintPip(canvas: HTMLCanvasElement, o: { look: PipLookId; body: string; visor: string; tok: { running?: string; pipBody?: string; pipVisor?: string } }) {
    const paint = (o: { look: PipLookId; body: string; visor: string; tok: { running?: string; pipBody?: string; pipVisor?: string } }) => {
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, 56, 48)
      drawPip(ctx, { x: 28, y: 26, size: 26, mood: 'idle', color: o.tok.running ?? '#53e4ff', ...pipColors(o, o.tok), open: 1, t: 0 })
    }
    paint(o)
    return { update: paint }
  }
  const TABS = ['general', 'island', 'look', 'pip', 'agents', 'chat', 'extras', 'connectors', 'advanced'] as const
  type Tab = (typeof TABS)[number]

  // ---------- search (about 70 settings in 9 tabs: people search before they guess a tab) ----------
  let query = $state('')
  let searchBox = $state<HTMLInputElement>()
  /** which tab a word lives in, by its key's first part */
  const HOME: Record<string, Tab> = {
    general: 'general', update: 'general', notify: 'general', rest: 'general', island: 'island', size: 'island', chip: 'island',
    look: 'look', colors: 'look', motion: 'look', icon: 'look', pipLook: 'pip', pip: 'pip', agents: 'agents', terminals: 'agents',
    chat: 'chat', apps: 'chat', extras: 'extras', guard: 'extras', connectors: 'connectors', advanced: 'advanced', diag: 'advanced'
  }
  /** words that are states, not settings (shown only sometimes: nothing to go to) */
  const NOT_FOUND = new Set(['colors.custom', 'colors.revert', 'connectors.on', 'connectors.off', 'connectors.attention', 'connectors.starting', 'general.taken', 'general.reset', 'size.reset', 'advanced.restartNow', 'advanced.historyCleared'])
  const results = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || !v) return []
    const vars = { pip: v.settings.pip.name, name: v.settings.pip.name, count: '', n: '', min: '', max: '', version: '', port: '', error: '', percent: '' }
    const out: { tab: Tab; label: string; hint?: string }[] = [], seen = new Set<string>()
    const add = (tab: Tab, label: string, hint?: string) => { const id = tab + label; if (!seen.has(id) && out.length < 30) { seen.add(id); out.push({ tab, label, hint }) } }
    for (const key of Object.keys(WORDS.en!)) {
      const home = HOME[key.split('.')[0]!]
      if (!home || NOT_FOUND.has(key)) continue
      const text = t(key, vars)
      if (!text.toLowerCase().includes(q)) continue
      // a hint finds its setting: the result names the setting, with the hint under it
      const base = key.endsWith('Hint') ? key.slice(0, -4) : null
      if (base && base in WORDS.en!) add(home, t(base, vars), text)
      else add(home, text)
    }
    for (const c of v.connectors) {
      const name = tOr(`c.${c.id}.name`, c.name), desc = tOr(`c.${c.id}.desc`, c.description)
      if ((name + ' ' + desc).toLowerCase().includes(q)) add('connectors', name, desc)
    }
    return out
  })
  /** a result: its tab, then its row in view (a folded part opens), lit for a moment */
  function go(r: { tab: Tab; label: string }) {
    query = ''
    tab = r.tab
    setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>('main .row > span, main .col > span, main h2, main summary, main .icon span, main .seg button')]
        .find(e => e.textContent?.includes(r.label))
      if (!el) return
      el.closest('details')?.setAttribute('open', '')
      const target = el.closest<HTMLElement>('.row, .col, h2, summary, .icons, .seg') ?? el
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      target.classList.add('found')
      setTimeout(() => target.classList.remove('found'), 1800)
    }, 60)
  }
  function keys(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); searchBox?.focus(); return }
    if (e.key === 'Escape' && query && document.activeElement === searchBox) { query = ''; return }
    record(e)
  }

  /** shortcuts as Windows writes them ("Ctrl+Alt+P") */
  const keysLabel = (k: string) => k.replace(/\bCommandOrControl\b|\bControl\b/g, 'Ctrl')
  /** the port typed this session: Pebble listens on it after a restart */
  let portEdited = $state(false)
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

<svelte:window onkeydown={keys} />

{#if v}
  {@const s = v.settings}
  {@const pip = s.pip.name}
  <div class="shell">
    <nav aria-label={t('nav.label')}>
      <div class="brand">Pebble <span class="muted">{v.version}</span></div>
      <input class="search" type="search" bind:this={searchBox} bind:value={query} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} />
      {#each TABS as id}
        <button class:active={tab === id && !query} aria-current={tab === id ? 'page' : undefined} onclick={() => { query = ''; tab = id }}>{t(`tab.${id}`)}</button>
      {/each}
    </nav>

    <main>
      {#if v.error}<div class="error" role="alert">{t('notSaved', { error: v.error })}</div>{/if}

      {#if query.trim().length >= 2}
        <h1>{t('search.results', { q: query.trim() })}</h1>
        <section>
          {#each results as r (r.tab + r.label)}
            <button class="result" onclick={() => go(r)}><span>{r.label}<small>{t(`tab.${r.tab}`)}{#if r.hint} · {r.hint}{/if}</small></span><span aria-hidden="true">›</span></button>
          {:else}
            <div class="row"><span class="muted">{t('search.none')}</span></div>
          {/each}
        </section>

      {:else if tab === 'general'}
        <h1>{t('tab.general')}</h1>
        <section>
          <label class="row"><span>{t('general.language')}<small>{t('general.languageHint')}</small></span>
            <select value={s.general.language} onchange={e => set('general.language', text(e))}>
              {#each LANGUAGES as l}<option value={l.id}>{l.name}</option>{/each}
            </select></label>
          <label class="row"><span>{t('general.startWithWindows')}</span>
            <input type="checkbox" class="switch" checked={s.general.startWithWindows} onchange={() => set('general.startWithWindows', !s.general.startWithWindows)} /></label>
          {#each SHORTCUTS as key}
            <div class="row"><span>{t(`general.${key}`, { pip })}{#if key === 'tuckShortcut'}<small>{t('general.tuckHint')}</small>{/if}
                {#if v.shortcutsTaken?.includes(key)}<small class="warn">{t('general.taken')}</small>{/if}</span>
              <span class="inline">
                {#if s.general[key] !== DEFAULTS.general[key]}<button class="ghost" title={t('general.reset')} aria-label={t('general.reset')} onclick={() => set(`general.${key}`, DEFAULTS.general[key])}>↺</button>{/if}
                <button class="key" class:rec={recording === key} onclick={() => (recording = recording === key ? null : key)}>
                  {recording === key ? t('general.pressKeys') : keysLabel(s.general[key]) || t('general.none')}
                </button></span></div>
          {/each}
          <button class="link" onclick={() => act({ do: 'welcome' })}>{t('general.welcome')}</button>
          {#if s.general.tipsSeen.length}<button class="link" onclick={() => set('general.tipsSeen', [])}>{t('general.tipsAgain')}</button>{/if}
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
          {#each ['asks', 'done', 'connectors', 'extras'] as const as k}
            <label class="row sub"><span>{t(`notify.${k}`)}<small>{t(`notify.${k}Hint`)}</small></span>
              <input type="checkbox" class="switch" checked={s.features.notify[k]} disabled={!s.features.toasts} onchange={() => set(`features.notify.${k}`, !s.features.notify[k])} /></label>
          {/each}
          <label class="row"><span>{t('notify.sound')}</span>
            <input type="checkbox" class="switch" checked={s.features.sound} onchange={() => set('features.sound', !s.features.sound)} /></label>
          <label class="row"><span>{t('notify.doneSeconds')}<small>{t('unit.seconds')}</small></span>
            <input type="number" min="1" max="600" value={s.features.doneSeconds} onchange={e => set('features.doneSeconds', num(e))} /></label>
          <label class="row"><span>{t('notify.usage')}<small>{t('notify.usageHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.features.usageAlerts} onchange={() => set('features.usageAlerts', !s.features.usageAlerts)} /></label>
        </section>
        <h2>{t('rest.title')} <span class="muted">· {t('rest.hint')}</span></h2>
        <section>
          {#each ['away', 'games', 'battery'] as const as k}
            <label class="row"><span>{t(`rest.${k}`)}{#if k === 'battery'}<small>{t('rest.batteryHint')}</small>{/if}</span>
              <input type="checkbox" class="switch" checked={s.features.rest[k]} onchange={() => set(`features.rest.${k}`, !s.features.rest[k])} /></label>
          {/each}
        </section>

      {:else if tab === 'island'}
        <h1>{t('tab.island')}</h1>
        <section>
          <div class="row"><span>{t('island.shape')}</span>
            <div class="seg">
              <button class:on={s.island.style === 'notch'} aria-pressed={s.island.style === 'notch'} onclick={() => set('island.style', 'notch')}>{t('island.notch')}</button>
              <button class:on={s.island.style === 'floating'} aria-pressed={s.island.style === 'floating'} onclick={() => set('island.style', 'floating')}>{t('island.floating')}</button>
            </div></div>
          <div class="row"><span>{t('island.opens')}</span>
            <div class="seg">
              <button class:on={s.island.openOn === 'hover'} aria-pressed={s.island.openOn === 'hover'} onclick={() => set('island.openOn', 'hover')}>{t('island.hover')}</button>
              <button class:on={s.island.openOn === 'click'} aria-pressed={s.island.openOn === 'click'} onclick={() => set('island.openOn', 'click')}>{t('island.click')}</button>
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
        <h2>{t('island.pages')} <span class="muted">· {t('island.pagesHint')}</span></h2>
        <section>
          {#each ['chat', 'music', 'files', 'clipboard', 'notes', 'focus', 'widgets'] as const as id}
            <label class="row"><span>{t(`i.page.${id}`)}</span>
              <input type="checkbox" class="switch" checked={!s.island.hiddenPages.includes(id)}
                onchange={() => set('island.hiddenPages', s.island.hiddenPages.includes(id) ? s.island.hiddenPages.filter(x => x !== id) : [...s.island.hiddenPages, id])} /></label>
          {/each}
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
        <details class="more">
          <summary>{t('island.size')}</summary>
          <section>
            {#each SIZES as [key, min, max]}
              <label class="row"><span>{t(`size.${key}`)}<small>{t('unit.px', { min, max })}</small></span>
                <input type="number" {min} {max} value={s.island[key]} onchange={e => set(`island.${key}`, num(e))} /></label>
            {/each}
            <button class="link" onclick={() => set('island', Object.fromEntries(SIZES.map(([k]) => [k, DEFAULTS.island[k]])))}>{t('size.reset')}</button>
          </section>
        </details>

      {:else if tab === 'look'}
        {@const tok = v.theme.tokens}
        <h1>{t('tab.look')}</h1>
        <section>
          <label class="row"><span>{t('look.theme')}</span>
            <select value={s.theme} onchange={e => set('theme', text(e))}>
              {#each v.themes as th}<option value={th.id}>{tOr(`theme.${th.id}`, th.name)}</option>{/each}
            </select></label>
          {#if s.theme === 'custom'}<div class="row"><span>{t('colors.custom')}</span><button onclick={() => set('theme', 'default')}>{t('colors.revert')}</button></div>{/if}
          <details class="more inner" open={s.theme === 'custom'}>
          <summary>{t('colors.customize')}</summary>
          <div class="col"><span>{t('colors.title')}<small>{t('colors.hint')}</small></span>
            <div class="island-preview" style:background={tok.background} style:color={tok.text} style:border-radius="{tok.radius}px">
              {#each ['ready', 'running', 'done', 'error', 'question'] as const as st}<i style:background={tok[st]}></i>{/each}
              <b>Claude Code</b><span style:color={tok.muted}>{t('colors.sample')}</span>
              <em style:background={tok.accent}></em>
            </div>
            <div class="swatches">
              {#each THEME_COLORS as k}
                <label class="swatch"><input type="color" value={tok[k]} onchange={e => act({ do: 'theme.edit', tokens: { [k]: text(e) } })} /><span>{t(`colors.${k}`)}</span></label>
              {/each}
            </div></div>
          <label class="row"><span>{t('colors.radius')}<small>{tok.radius}px</small></span>
            <input type="range" min="0" max="40" step="1" value={tok.radius} onchange={e => act({ do: 'theme.edit', tokens: { radius: num(e) } })} /></label>
          </details>
          <div class="row"><span>{t('look.motion')}</span>
            <div class="seg">
              {#each ['system', 'full', 'reduced'] as const as m}
                <button class:on={s.motion.mode === m} aria-pressed={s.motion.mode === m} onclick={() => set('motion.mode', m)}>{t(`motion.${m}`)}</button>
              {/each}
            </div></div>
          <label class="row"><span>{t('look.speed')}<small>{s.motion.speed.toFixed(2)}×</small></span>
            <input type="range" min="0.5" max="2" step="0.05" value={s.motion.speed} onchange={e => set('motion.speed', num(e))} /></label>
          <button class="link" onclick={() => act({ do: 'open', what: 'themes' })}>{t('look.themesFolder')}</button>
          <div class="col"><span>{t('look.icon')}<small>{t('look.iconHint')}</small></span>
            <div class="icons" role="radiogroup" aria-label={t('look.icon')}>
              {#each ['lavender', 'cream', 'graphite'] as const as id}
                <button class="icon" class:on={s.general.icon === id} role="radio" aria-checked={s.general.icon === id} onclick={() => set('general.icon', id)}>
                  <img src={ICONS[id]} alt="" width="56" height="56" /><span>{t(`icon.${id}`)}</span></button>
              {/each}
            </div></div>
        </section>

      {:else if tab === 'pip'}
        <h1>{pip} <span class="muted">· {t('pip.done', { count: v.pip.done })}</span></h1>
        <h2>{t('pipLook.title', { name: pip })} <span class="muted">· {t('pipLook.hint')}</span></h2>
        <section>
          <div class="icons" role="radiogroup" aria-label={t('pipLook.title', { name: pip })}>
            {#each PIP_LOOKS as id}
              <button class="icon" class:on={s.pip.look === id} role="radio" aria-checked={s.pip.look === id} onclick={() => set('pip.look', id)}>
                <canvas width="112" height="96" style:width="56px" style:height="48px" use:paintPip={{ ...s.pip, look: id, tok: v.theme.tokens }}></canvas>
                <span>{id === 'theme' ? t('pipLook.theme') : id === 'custom' ? t('pipLook.custom') : t(`icon.${id}`)}</span></button>
            {/each}
          </div>
          {#if s.pip.look === 'custom'}
            <label class="row"><span>{t('pipLook.body')}</span>
              <input type="color" value={s.pip.body} onchange={e => set('pip.body', text(e))} /></label>
            <label class="row"><span>{t('pipLook.visor')}</span>
              <input type="color" value={s.pip.visor} onchange={e => set('pip.visor', text(e))} /></label>
          {/if}
        </section>
        <h2>{t('pip.about', { name: pip })}</h2>
        <section>
          <label class="row"><span>{t('pip.name')}<small>{t('pip.nameHint')}</small></span>
            <input type="text" maxlength="24" value={s.pip.name} onchange={e => set('pip.name', text(e).trim() || 'Pip')} /></label>
          <div class="outfits">
            {#each [{ id: 'auto', name: t('pip.auto'), ok: true, hint: '' }, { id: 'none', name: t('pip.none'), ok: true, hint: '' },
              ...OUTFITS.map(o => ({ id: o.id, name: tOr(`o.${o.id}`, o.name), ok: v!.pip.wearable.includes(o.id), hint: o.tasks !== undefined ? t('pip.tasks', { count: o.tasks }) : t('pip.inSeason') })),
              ...v.pip.custom.map(id => ({ id, name: id, ok: true, hint: t('pip.yours') }))] as o}
              <button class="outfit" class:on={s.pip.outfit === o.id} aria-pressed={s.pip.outfit === o.id} disabled={!o.ok} onclick={() => set('pip.outfit', o.id)}>
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
            <div class="row"><span>{x.name}<small class:okay={v.chatKeys[x.id]}>{t(v.chatKeys[x.id] ? 'secret.savedState' : 'secret.notSetState')}</small></span>
              <span class="inline">
                {#if v.chatKeys[x.id]}<button class="ghost" onclick={() => act({ do: 'chat.key', provider: x.id, value: '' })}>{t('secret.remove')}</button>{/if}
                <input type="password" autocomplete="off" aria-label={x.name} placeholder={t(v.chatKeys[x.id] ? 'secret.replace' : 'secret.paste')}
                  onchange={e => { const k = text(e); (e.currentTarget as HTMLInputElement).value = ''; act({ do: 'chat.key', provider: x.id, value: k }) }} /></span></div>
          {/each}
        </section>
        <details class="more" open={s.chatApps.desktop.length > 0}>
        <summary>{t('apps.experimental')}</summary>
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
        </details>

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
          <label class="row"><span>{t('guard.onlyDuringFocus')}<small>{t('guard.onlyDuringFocusHint')}</small></span>
            <input type="checkbox" class="switch" checked={s.focusGuard.onlyDuringFocus} onchange={() => set('focusGuard.onlyDuringFocus', !s.focusGuard.onlyDuringFocus)} /></label>
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
            <label class="row head"><span><b>{tOr(`c.${c.id}.name`, c.name)}</b>{#if !c.builtIn}<em>{t('connectors.yours')}</em>{/if}<small>{tOr(`c.${c.id}.desc`, c.description)}</small>
              <small class="state" class:okay={c.enabled && c.running && !c.problem} class:warn={c.enabled && !!c.problem}>{t(!c.enabled ? 'connectors.off' : c.problem ? 'connectors.attention' : c.running ? 'connectors.on' : 'connectors.starting')}</small></span>
              <input type="checkbox" class="switch" checked={c.enabled} onchange={() => act({ do: 'connector', id: c.id })} /></label>
            {#if c.enabled && c.problem}<div class="problem">{c.problem}</div>{/if}
            <!-- what a connector needs shows when it is on (the tab is a list, not a wall of forms) -->
            {#if c.enabled}
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
                <label class="row"><span>{tOr(`c.${c.id}.${f.key}`, f.label)}{#if f.secret}<small class:okay={f.set}>{t(f.set ? 'secret.savedState' : 'secret.notSetState')}</small>{:else if f.required}<small>{t('connectors.needed')}</small>{/if}</span>
                  {#if f.secret}
                    <input type="password" autocomplete="off" placeholder={t(f.set ? 'secret.replace' : 'secret.paste')}
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
            {/if}
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
            <span class="inline">{#if portEdited}<button onclick={() => act({ do: 'restart' })}>{t('advanced.restartNow')}</button>{/if}
              <input type="number" min="1024" max="65535" value={s.server.port} onchange={e => { portEdited = true; set('server.port', num(e)) }} /></span></label>
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
          <button onclick={clearHistory}>{clearing ? `${t('advanced.historyCleared')} · ${t('i.common.undo')}` : t('advanced.history')}</button>
        </section>
        <!-- apart from the everyday buttons, so a slip does not end Pebble -->
        <section class="actions apart">
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
  .brand { font-weight: 600; font-size: 16px; padding: 4px 12px 12px; }
  .search { margin: 0 2px 10px; min-width: 0 !important; width: auto; }
  .result { display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: start; background: none; padding: 10px 4px; border-radius: 8px; }
  .result > span:first-child { display: flex; flex-direction: column; gap: 2px; }
  .result + .result { border-top: 1px solid var(--stroke); border-radius: 0; }
  :global(.found) { animation: found 1.8s ease-out; border-radius: 8px; }
  @keyframes found { 0%, 40% { background: color-mix(in srgb, var(--accent) 26%, transparent); } }
  details.more { margin-top: 22px; }
  details.more.inner { margin: 0; padding: 4px 0; border-top: 1px solid var(--stroke); }
  details.more > summary { cursor: pointer; font-weight: 600; padding: 6px 0 10px; color: var(--text); }
  details.more.inner > summary { font-weight: 400; padding: 10px 0; }
  .inline { display: flex; align-items: center; gap: 8px; }
  .ghost { background: none; }
  small.okay { color: var(--done); }
  small.warn { color: var(--question); }
  section.actions.apart { margin-top: 28px; }
  .row.sub { padding-inline-start: 18px; }
  nav button { text-align: start; padding: 9px 12px; border-radius: 8px; background: none; }
  nav button:hover { background: color-mix(in srgb, var(--text) 7%, transparent); }
  nav button.active { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--text); font-weight: 600; }
  main { overflow-y: auto; padding: 24px 36px 48px; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 16px; }
  h2 { font-size: 14px; font-weight: 600; margin: 26px 0 8px; }
  .muted, small { color: var(--muted); font-weight: 400; }
  section { background: color-mix(in srgb, var(--text) 4%, transparent); border-radius: var(--r-l); padding: 4px 16px; display: flex; flex-direction: column; animation: rise 0.18s ease-out; }
  section.card { margin-bottom: 12px; }
  section.actions { flex-direction: row; flex-wrap: wrap; gap: 8px; padding: 14px 16px; margin-top: 12px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 0; min-height: 48px; }
  .row + .row, .col + .row, .row + .col { border-top: 1px solid var(--stroke); }
  .col { display: flex; flex-direction: column; gap: 8px; padding: 11px 0; }
  .row > span, .col > span { display: flex; flex-direction: column; gap: 2px; }
  .head em { font-style: normal; font-size: 11px; color: var(--accent-text); }
  button, input, select, textarea { font: inherit; color: inherit; }
  button { border: 0; cursor: pointer; border-radius: var(--r-m); padding: 8px 14px; background: color-mix(in srgb, var(--text) 9%, transparent); transition: background 0.12s; }
  button:hover { background: color-mix(in srgb, var(--text) 14%, transparent); }
  button:disabled { opacity: 0.45; cursor: default; }
  button.link { background: none; padding: 10px 0; color: var(--accent-text); align-self: flex-start; }
  button.danger { color: var(--error); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  input[type='number'], input[type='text'], input[type='password'], input[type='search'], select, textarea {
    background: color-mix(in srgb, var(--text) 7%, var(--background)); border: 1px solid var(--stroke); border-radius: var(--r-m); padding: 7px 10px;
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
  .icons { display: flex; gap: 10px; }
  .island-preview { display: flex; align-items: center; gap: 8px; padding: 10px 16px; max-width: 420px; font-size: 13px; border: 1px solid var(--stroke); }
  .island-preview i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .island-preview b { margin-inline-start: 4px; }
  .island-preview em { margin-inline-start: auto; width: 26px; height: 14px; border-radius: 7px; flex: none; }
  .swatches { display: flex; flex-wrap: wrap; gap: 8px 14px; }
  .swatch { display: flex; align-items: center; gap: 6px; font-size: 0.9em; }
  .swatch input { width: 30px; height: 24px; padding: 0; border: none; background: none; }
  .icon { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 14px; border: 2px solid transparent; }
  .icon.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .pickbar { display: flex; gap: 8px; align-items: center; }
  .picks { display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow-y: auto; }
  .pick { display: flex; justify-content: space-between; gap: 16px; text-align: start; background: none; padding: 7px 10px; }
  .pick span { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pick b { font-weight: 600; white-space: nowrap; }
  @keyframes rise { from { opacity: 0; transform: translateY(4px); } }
  @media (prefers-reduced-motion: reduce) { section { animation: none; } .switch::after { transition: none; } :global(.found) { animation: none; outline: 2px solid var(--accent); } }
</style>
