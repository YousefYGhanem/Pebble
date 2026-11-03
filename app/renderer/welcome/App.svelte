<script lang="ts">
  // The welcome tour (first start): language → which AIs → terminals → Pip's name → done. Every choice is saved at once,
  // like in Settings; closing the window early keeps what was chosen so far.
  import { applyTheme } from '../theme'
  import { LANGUAGES, setLanguage, t } from '../i18n.svelte'
  import { drawPip } from '../island/pip'
  import type { Mood } from '../../shared/pip'
  import type { SettingsAction, SettingsView } from '../../shared/settings-ui'

  let v = $state<SettingsView>()
  let step = $state(0)
  let name = $state('')
  let canvas = $state<HTMLCanvasElement>()
  const STEPS = 5
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  window.settingsApi.onView(next => {
    v = next
    applyTheme(next.theme)
    setLanguage(next.settings.general.language)
    if (!name) name = next.settings.pip.name
  })
  window.settingsApi.ready()
  const act = (a: SettingsAction) => window.settingsApi.act(a)
  // its first click: it may go behind other windows from now on
  let clicked = false
  const firstClick = () => { if (!clicked) { clicked = true; act({ do: 'welcome.clicked' }) } }

  function next() {
    if (step === 3 && name.trim()) act({ do: 'update', patch: { pip: { name: name.trim().slice(0, 24) } } })
    if (step === STEPS - 1) act({ do: 'welcome.done' })
    else step++
  }

  // Pip: curious while you choose, happy at the end
  const mood: Mood = $derived(step === STEPS - 1 ? 'happy' : step === 0 ? 'idle' : 'curious')
  $effect(() => {
    if (!canvas || !v) return
    const ctx = canvas.getContext('2d')!, tok = v.theme.tokens, start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const s = (now - start) / 1000
      const blink = (s % 3.6) < 0.14 ? Math.abs(1 - 2 * ((s % 3.6) / 0.14)) : 1
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, 120, 100)
      drawPip(ctx, { x: 60, y: 54 + (reduced ? 0 : Math.sin(s * 2) * 2), size: 52, mood, color: tok.text, body: tok.pipBody, visor: tok.pipVisor, open: blink, t: s })
      if (!reduced) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  })
</script>

<svelte:window onpointerdown={firstClick} onkeydown={e => { firstClick(); if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') next() }} />

{#if v}
  {@const s = v.settings}
  <main>
    <canvas bind:this={canvas} width="240" height="200" style="width:120px;height:100px" aria-hidden="true"></canvas>
    {#key step}
      <div class="step">
        {#if step === 0}
          <h1>{t('welcome.hello')}</h1>
          <p>{t('welcome.helloHint')}</p>
          <label class="field"><span>{t('welcome.language')}</span>
            <select value={s.general.language} onchange={e => act({ do: 'update', patch: { general: { language: (e.currentTarget as HTMLSelectElement).value } } })}>
              {#each LANGUAGES as l}<option value={l.id}>{l.name}</option>{/each}
            </select></label>
        {:else if step === 1}
          <h1>{t('welcome.agents')}</h1>
          <p>{t('welcome.agentsHint')}</p>
          <div class="list">
            {#each v.agents.filter(g => g.available || g.connected) as g}
              <label class="row"><span>{g.name}</span><input type="checkbox" class="switch" checked={g.connected} onchange={() => act({ do: 'agent', id: g.id })} /></label>
            {:else}
              <p class="muted">{t('agents.notFound')}</p>
            {/each}
          </div>
        {:else if step === 2}
          <h1>{t('welcome.terminals')}</h1>
          <p>{t('welcome.terminalsHint')}</p>
          <div class="list">
            {#each v.terminals as term}
              <label class="row"><span>{({ powershell: 'Windows PowerShell', pwsh: 'PowerShell 7', bash: 'Git Bash' } as Record<string, string>)[term.id] ?? term.id}</span>
                <input type="checkbox" class="switch" checked={term.on} onchange={() => act({ do: 'terminal', id: term.id })} /></label>
            {/each}
          </div>
        {:else if step === 3}
          <h1>{t('welcome.name')}</h1>
          <p>{t('welcome.nameHint')}</p>
          <!-- svelte-ignore a11y_autofocus -->
          <input class="name" type="text" maxlength="24" bind:value={name} autofocus aria-label={t('pip.name')} />
        {:else}
          <h1>{t('welcome.ready', { name: name.trim() || 'Pip' })}</h1>
          <p>{t('welcome.readyHint', { toggle: s.general.toggleShortcut.replace('Control', 'Ctrl'), buddy: s.general.buddyShortcut.replace('Control', 'Ctrl') })}</p>
        {/if}
      </div>
    {/key}
    <footer>
      <div class="dots" aria-label={t('welcome.step', { n: step + 1, total: STEPS })}>
        {#each Array(STEPS) as _, i}<i class:on={i === step}></i>{/each}
      </div>
      {#if step > 0 && step < STEPS - 1}<button class="ghost" onclick={() => step--}>{t('welcome.back')}</button>{/if}
      {#if step < STEPS - 1}<button class="ghost" onclick={() => act({ do: 'welcome.done' })}>{t('welcome.skip')}</button>{/if}
      <button class="go" onclick={next}>{t(step === STEPS - 1 ? 'welcome.done' : 'welcome.next')}</button>
    </footer>
  </main>
{/if}

<style>
  :global(html), :global(body) { margin: 0; height: 100%; background: var(--background); color: var(--text); font: 14px var(--font); user-select: none; }
  :global(*) { box-sizing: border-box; }
  main { height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 28px 40px 22px; text-align: center; }
  .step { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; animation: in 0.28s cubic-bezier(.2, .9, .3, 1.2); }
  h1 { font-size: 21px; font-weight: 600; margin: 10px 0 6px; }
  p { color: var(--muted); margin: 0 0 18px; line-height: 1.5; max-width: 420px; }
  .muted { color: var(--muted); }
  .field { display: flex; flex-direction: column; gap: 8px; align-items: center; }
  .list { width: 100%; max-width: 380px; background: color-mix(in srgb, var(--text) 5%, transparent); border-radius: 12px; padding: 4px 16px; text-align: start; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; }
  .row + .row { border-top: 1px solid color-mix(in srgb, var(--text) 7%, transparent); }
  select, .name { font: inherit; color: inherit; background: color-mix(in srgb, var(--text) 7%, var(--background)); border: 1px solid color-mix(in srgb, var(--text) 12%, transparent); border-radius: 10px; padding: 8px 12px; min-width: 220px; }
  .name { font-size: 18px; text-align: center; }
  .switch { appearance: none; width: 40px; height: 22px; border-radius: 11px; background: color-mix(in srgb, var(--text) 20%, transparent); position: relative; cursor: pointer; transition: background 0.15s; }
  .switch::after { content: ''; position: absolute; top: 3px; inset-inline-start: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--text); transition: translate 0.18s cubic-bezier(.3, 1.4, .6, 1); }
  .switch:checked { background: var(--accent); }
  .switch:checked::after { translate: 18px; background: var(--on-accent); }
  :global([dir='rtl']) .switch:checked::after { translate: -18px; }
  footer { width: 100%; display: flex; align-items: center; gap: 8px; }
  .dots { display: flex; gap: 6px; margin-inline-end: auto; }
  .dots i { width: 7px; height: 7px; border-radius: 50%; background: color-mix(in srgb, var(--text) 22%, transparent); transition: width 0.2s, background 0.2s; }
  .dots i.on { width: 20px; border-radius: 4px; background: var(--accent); }
  button { font: inherit; color: inherit; border: 0; border-radius: 10px; padding: 9px 18px; cursor: pointer; }
  .ghost { background: none; color: var(--muted); }
  .ghost:hover { color: var(--text); }
  .go { background: var(--accent); color: var(--on-accent); font-weight: 600; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } }
  @media (prefers-reduced-motion: reduce) { .step { animation: none; } }
</style>
