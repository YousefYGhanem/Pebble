<script lang="ts">
  // Chat with Pip: ask anything; the answer streams in. Who answers is picked in Settings → Pip's chat.
  // Look shows Pip a window (its picture and text go with your next message); the mic starts Windows voice typing.
  import type { Action } from '../../shared/extras'
  import type { ChatState } from '../../shared/chat'
  import { markdown } from './md'
  import Icon from './Icon.svelte'
  import { t } from '../i18n.svelte'

  let { chat, act, listen = 0, name = 'Pip' }: { chat: ChatState; act: (a: Action) => void; listen?: number; name?: string } = $props()
  let text = $state('')
  let list = $state<HTMLDivElement>()
  let box = $state<HTMLTextAreaElement>()
  let speaking = $state<number | null>(null)
  let skip = $state<number[]>([]) // Word fixes you unticked

  // keep the newest words in view while the answer grows
  $effect(() => { void chat.messages.at(-1)?.text; list?.scrollTo({ top: list.scrollHeight }) })
  // the voice shortcut: type here by voice
  $effect(() => { if (listen && box) dictate() })

  function send() {
    if (!text.trim() || chat.busy) return
    // /login (what the CLI itself would say) opens the sign-in instead of asking the AI
    if (/^\/log ?in$/i.test(text.trim())) { act({ do: 'chat.signIn' }); text = ''; return }
    act({ do: 'chat.send', text })
    text = ''
  }
  function dictate() { box?.focus(); act({ do: 'chat.dictate' }) }
  function speak(at: number) {
    speaking = speaking === at ? null : at
    act({ do: 'chat.say', at: speaking })
  }
  const SUGGEST: [RegExp, string][] = [
    [/^(chrome|msedge|firefox|brave|opera|arc)$/i, 'page'],
    [/^(code|cursor|devenv|idea64|notepad\+\+)$/i, 'code'],
    [/^(windowsterminal|powershell|pwsh|cmd|wezterm-gui)$/i, 'error'],
    [/^(winword|outlook|onenote|notepad)$/i, 'text'],
    [/^excel$/i, 'sheet']
  ]
  const suggestion = $derived(chat.look ? SUGGEST.find(([re]) => re.test(chat.look!.process))?.[1] ?? 'any' : '')
</script>

<div class="page">
  <div class="page-head">
    <span class="page-title">{t('i.page.chat')}</span>
    <span class="muted who">{chat.provider}</span>
    {#if chat.messages.length}<button class="ghost" onclick={() => act({ do: 'chat.clear' })}><Icon name="trash" size={12} />{t('i.common.clear')}</button>{/if}
    <span class="page-time"></span><span class="pip-room"></span>
  </div>
  {#if !chat.ready}
    <div class="empty">{t('i.chat.needsKey', { name, provider: chat.provider })} <button class="ghost" onclick={() => act({ do: 'settings.open' })}>{t('i.chat.openSettings')}</button></div>
  {:else if chat.word}
    {@const w = chat.word}
    <div class="log word">
      <div class="muted">{w.doc ? t('i.word.fixesFor', { doc: w.doc }) : t('i.word.reading')}</div>
      {#if w.busy && !w.fixes.length}<div class="msg assistant thinking" aria-label={t('i.word.readingAria', { name })}><i></i><i></i><i></i></div>{/if}
      {#if w.error}<div class="error">{w.error}</div>{/if}
      {#if w.done}<div class="done"><Icon name="check" size={13} />{t('i.word.done', { done: w.done })}</div>{/if}
      {#if !w.busy && !w.fixes.length && !w.error && !w.done}<div class="empty">{t('i.word.nothing')}</div>{/if}
      {#each w.fixes as f, i}
        <label class="fix"><input type="checkbox" checked={!skip.includes(i)} onchange={() => (skip = skip.includes(i) ? skip.filter(x => x !== i) : [...skip, i])} />
          <span><s>{f.find}</s> → <b>{f.replace}</b><small class="muted">{f.why}</small></span></label>
      {/each}
    </div>
    <div class="ask">
      <button class="ghost" onclick={() => { skip = []; act({ do: 'word.close' }) }}>{t('i.common.close')}</button>
      {#if w.fixes.length}<button class="wide go" disabled={w.busy || skip.length === w.fixes.length}
        onclick={() => { act({ do: 'word.apply', picks: w.fixes.map((_, i) => i).filter(i => !skip.includes(i)) }); skip = [] }}>{t('i.word.apply')}</button>{/if}
    </div>
  {:else if chat.windows}
    <div class="log picker">
      <div class="muted">{t('i.chat.whichWindow', { name })}</div>
      {#each chat.windows as w (w.hwnd)}
        <button class="win" onclick={() => act({ do: 'chat.look', hwnd: w.hwnd })}><b>{w.title}</b><span class="muted">{w.process}</span></button>
      {/each}
      <button class="ghost" onclick={() => act({ do: 'chat.look', hwnd: 0 })}>{t('i.common.cancel')}</button>
    </div>
  {:else}
    <div class="log" bind:this={list} aria-live="polite">
      {#if !chat.messages.length}
        <div class="empty">{t('i.chat.empty', { name })}</div>
        <!-- what Pip can do, to start with one click (an empty page that teaches) -->
        <div class="starters">
          <button class="ghost" onclick={() => act({ do: 'chat.windows' })}><Icon name="eye" size={12} />{t('i.chat.startLook')}</button>
          <button class="ghost" onclick={() => { text = t('i.chat.startExplainText'); box?.focus() }}><Icon name="chat" size={12} />{t('i.chat.startExplain')}</button>
          <button class="ghost" onclick={dictate}><Icon name="mic" size={12} />{t('i.chat.speak')}</button>
        </div>
      {/if}
      {#each chat.messages as m (m.at + m.role)}
        <div class="msg {m.role}">
          {#if m.look}<div class="seen"><Icon name="eye" size={11} />{m.look.title}</div>{/if}
          {#if m.role === 'assistant'}{@html markdown(m.text)}{:else}{m.text}{/if}
          {#if m.role === 'assistant' && !(chat.busy && m === chat.messages.at(-1))}
            <button class="say" class:on={speaking === m.at} onclick={() => speak(m.at)} aria-label={speaking === m.at ? t('i.chat.stopReading') : t('i.chat.read')}><Icon name="speaker" size={11} /></button>
          {/if}
        </div>
      {/each}
      {#if chat.busy && !chat.messages.at(-1)?.text}<div class="msg assistant thinking" aria-label={t('i.chat.thinking', { name })}><i></i><i></i><i></i></div>{/if}
      {#if chat.error}<div class="error">{chat.error}{#if chat.signIn} <button class="ghost" onclick={() => act({ do: 'chat.signIn' })}>{t('i.chat.signIn')}</button>{/if}</div>{/if}
    </div>
    {#if chat.look}
      <div class="attached">
        <Icon name="eye" size={12} /><span>{t('i.chat.sees', { name, title: chat.look.title })}</span>
        {#if /^winword$/i.test(chat.look.process)}<button class="chip" onclick={() => act({ do: 'word.check' })}>{t('i.chat.fixWord')}</button>
        {:else if !text}<button class="chip" onclick={() => (text = t(`i.chat.s.${suggestion}`))}>{t(`i.chat.s.${suggestion}`)}</button>{/if}
        <button class="ghost x" onclick={() => act({ do: 'chat.look', hwnd: 0 })} aria-label={t('i.chat.removeWindow')}><Icon name="close" size={11} /></button>
      </div>
    {/if}
    <form class="ask" onsubmit={e => { e.preventDefault(); send() }}>
      <button type="button" class="tool" onclick={() => act({ do: 'chat.windows' })} title={t('i.chat.look')} aria-label={t('i.chat.look')}><Icon name="eye" size={13} /></button>
      <button type="button" class="tool" onclick={dictate} title={t('i.chat.speak')} aria-label={t('i.chat.speak')}><Icon name="mic" size={13} /></button>
      <textarea rows="1" bind:this={box} bind:value={text} placeholder={t('i.chat.message', { name })} aria-label={t('i.chat.message', { name })}
        onkeydown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}></textarea>
      {#if chat.busy}
        <button type="button" onclick={() => act({ do: 'chat.stop' })} aria-label={t('i.common.stop')}><Icon name="stop" size={13} /></button>
      {:else}
        <button type="submit" class="go" disabled={!text.trim()} aria-label={t('i.chat.send')}><Icon name="send" size={13} /></button>
      {/if}
    </form>
  {/if}
</div>

<style>
  .starters { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 8px; }
  .starters button { display: inline-flex; align-items: center; gap: 6px; font-size: 0.86em; padding: 5px 12px; border-radius: 999px; background: var(--surface1); }
  .who { font-size: 11px; }
  .log { height: 190px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 2px 2px 8px; }
  .msg { position: relative; max-width: 85%; padding: 8px 12px; border-radius: 14px; line-height: 1.45; overflow-wrap: anywhere; animation: pop 0.2s ease-out; }
  .msg.user { align-self: flex-end; background: var(--accent); color: var(--on-accent); white-space: pre-wrap; border-bottom-right-radius: 4px; }
  .msg.assistant { align-self: flex-start; background: color-mix(in srgb, var(--text) 9%, transparent); border-bottom-left-radius: 4px; padding-right: 30px; }
  .msg.assistant :global(p) { margin: 0 0 6px; }
  .msg.assistant :global(p:last-child) { margin: 0; }
  .msg.assistant :global(pre) { overflow-x: auto; }
  .seen { display: flex; align-items: center; gap: 4px; font-size: 11px; opacity: 0.8; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .say { position: absolute; right: 6px; top: 6px; width: 20px; height: 20px; padding: 0; border-radius: 50%; display: grid; place-items: center; background: none; opacity: 0.5; }
  .say:hover, .say.on { opacity: 1; }
  .say.on { color: var(--accent); }
  .thinking { display: flex; gap: 4px; }
  .thinking i { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: dot 1s infinite steps(5, jump-none); }
  .thinking i:nth-child(2) { animation-delay: 0.15s; }
  .thinking i:nth-child(3) { animation-delay: 0.3s; }
  .error { color: var(--error); font-size: 12px; }
  .picker { gap: 4px; }
  .word { gap: 6px; }
  .fix { display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border-radius: 10px; background: color-mix(in srgb, var(--text) 6%, transparent); }
  .fix span { display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
  .fix s { color: var(--error); }
  .fix b { color: var(--done); font-weight: 500; }
  .fix input { accent-color: var(--accent); margin-top: 3px; }
  .done { display: flex; gap: 6px; align-items: center; color: var(--done); }
  .ask .wide { width: auto; border-radius: 12px; padding: 0 16px; margin-inline-start: auto; }
  .win { display: flex; justify-content: space-between; gap: 12px; text-align: start; background: none; border-radius: 10px; padding: 7px 10px; }
  .win b { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .win:hover { background: color-mix(in srgb, var(--text) 8%, transparent); }
  .attached { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 6px; animation: pop 0.2s ease-out; }
  .attached span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .chip { border-radius: 999px; padding: 3px 10px; font-size: 11px; background: color-mix(in srgb, var(--accent) 25%, transparent); white-space: nowrap; }
  .x { margin-inline-start: auto; padding: 2px 6px; }
  .ask { display: flex; gap: 6px; align-items: flex-end; margin-bottom: 8px; }
  .ask textarea { flex: 1; resize: none; max-height: 80px; field-sizing: content; font: inherit; color: inherit; background: color-mix(in srgb, var(--text) 8%, transparent); border: 0; border-radius: 12px; padding: 8px 12px; }
  .ask textarea:focus-visible { outline: 2px solid var(--accent); }
  .ask button { border-radius: 50%; width: 34px; height: 34px; display: grid; place-items: center; padding: 0; flex: none; }
  .ask .tool { background: none; }
  .ask .tool:hover { background: color-mix(in srgb, var(--text) 9%, transparent); }
  .ask .go { background: var(--accent); color: var(--on-accent); }
  .ask .go:disabled { opacity: 0.4; }
  @keyframes pop { from { opacity: 0; transform: translateY(4px) scale(0.98); } }
  @keyframes dot { 0%, 100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
  @media (prefers-reduced-motion: reduce) { .msg, .thinking i, .attached { animation: none; } }
</style>
