<script lang="ts">
  // The Agents page, like a Live Activity: one tab per session. Left: what it does now, a live timer and the steps
  // of this turn. Right: the code it changes, or its answer, with a reply box once it stopped. Questions, plans and
  // permissions take the full width. Bottom: plan usage and context, and "jump to terminal".
  import type { Answer, HistoryItem, Usage } from '../../shared/ipc'
  import { AGENT_NAMES, summary, type Session } from '../../shared/state'
  import AskView from './AskView.svelte'
  import DiffView from './DiffView.svelte'
  import Icon from './Icon.svelte'

  let { sessions, usage, history, now, selected = $bindable(), onanswer, onreply, onjump, ondismiss, onseen }: {
    sessions: Session[]; usage: Usage; history: HistoryItem[]; now: number; selected: string | undefined
    onanswer: (id: string, a: Answer) => void; onreply: (id: string, text: string) => void
    onjump: (id: string) => void; ondismiss: (id: string) => void; onseen: (ids: string[]) => void
  } = $props()

  let showHistory = $state(false)
  let draft = $state('')
  const s = $derived(sessions.find(x => x.id === selected) ?? sessions[0])
  const time = $derived(new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  // done and error count as seen once you look at them here
  $effect(() => { if (s && !showHistory && (s.status === 'done' || s.status === 'error') && !s.seenAt) onseen([s.id]) })

  const clock = (ms: number) => {
    const t = Math.max(0, Math.round(ms / 1000)), m = Math.floor(t / 60), sec = t % 60
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(sec).padStart(2, '0')}`
  }
  const ago = (at: number) => {
    const m = Math.round((now - at) / 60000)
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(at).toLocaleDateString()
  }
  const STATUS = { ready: 'Ready', running: 'Working', question: 'Needs you', done: 'Done', error: 'Stopped' } as const

  function send() {
    if (!s || !draft.trim()) return
    onreply(s.id, draft)
    draft = ''
  }

  // usage ring: r = 9 → circumference ≈ 56.5
  const ring = (used: number) => `${(Math.min(100, used) / 100) * 56.5} 56.5`
  const tone = (used: number) => (used >= 95 ? 'var(--error)' : used >= 80 ? 'var(--question)' : 'var(--text)')
</script>

<div class="page">
  <header>
    <div class="tabs" role="tablist">
      {#each sessions as x (x.id)}
        <button role="tab" aria-selected={!showHistory && x.id === s?.id} class="tab" class:on={!showHistory && x.id === s?.id} onclick={e => { e.stopPropagation(); selected = x.id; showHistory = false }}>
          <span class="dot {x.status}"></span>{x.project}
        </button>
      {/each}
      <button role="tab" aria-selected={showHistory} class="tab" class:on={showHistory} title="History" onclick={e => { e.stopPropagation(); showHistory = !showHistory }}>
        <Icon name="history" />{#if !sessions.length}History{/if}
      </button>
    </div>
    <span class="time">{time}</span>
    <span class="pip-room"></span>
  </header>

  {#if showHistory}
    <div class="history">
      {#each history as h (h.at)}
        <div class="h-item">
          <div class="h-top"><b>{h.project}</b><span>{AGENT_NAMES[h.agent]} · {clock(h.seconds * 1000)}{h.files ? ` · ${h.files} file${h.files > 1 ? 's' : ''}` : ''} · {ago(h.at)}</span></div>
          <div class="h-prompt">{h.prompt}</div>
          {#if h.result}<div class="h-result">{h.result.split('\n')[0]}</div>{/if}
        </div>
      {:else}
        <div class="empty">Finished turns show up here.</div>
      {/each}
    </div>
  {:else if !s}
    <div class="empty">No agent sessions yet. Start Claude Code or Codex in a terminal.</div>
  {:else if s.ask}
    <AskView session={s} onanswer={a => onanswer(s.id, a)} />
  {:else}
    <div class="body">
      <div class="left">
        <div class="status {s.status}">
          {STATUS[s.status]}
          {#if s.status === 'running' && s.startedAt}<span class="timer">{clock(now - s.startedAt)}</span>{/if}
        </div>
        {#if s.prompt}<div class="prompt" title={s.prompt}>{s.prompt}</div>{/if}
        {#if summary(s.steps)}<div class="summary">{summary(s.steps)}</div>{/if}
        <ol class="steps">
          {#each s.steps.slice(-6) as step, i (step.at + step.text)}
            <li class:failed={step.failed} class:current={s.status === 'running' && i === Math.min(5, s.steps.length - 1)}>
              <Icon name={step.kind} size={13} /><span>{step.text}</span>
            </li>
          {/each}
        </ol>
      </div>
      <div class="right">
        {#if s.status === 'running' && s.diff}
          <DiffView diff={s.diff} />
        {:else if s.message}
          <div class="card message">{s.message}</div>
        {:else}
          <div class="card muted">{s.detail || 'Waiting for the next step…'}</div>
        {/if}
        {#if s.replyable}
          <div class="reply">
            <textarea rows="1" placeholder="Reply to {AGENT_NAMES[s.agent]}…" bind:value={draft}
              onkeydown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}></textarea>
            <button class="likely" disabled={!draft.trim()} onclick={send}>Send</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if !showHistory}
    <footer>
      {#if usage.fiveHour}
        <span class="usage" title="Claude plan usage">
          <svg width="20" height="20" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" class="track" /><circle cx="11" cy="11" r="9" class="arc" style:stroke={tone(usage.fiveHour.used)} stroke-dasharray={ring(usage.fiveHour.used)} /></svg>
          5h {Math.round(usage.fiveHour.used)}%{#if usage.sevenDay}{` · week ${Math.round(usage.sevenDay.used)}%`}{/if}
        </span>
      {/if}
      {#if s?.context !== undefined}<span class="meta">context {Math.round(s.context)}%</span>{/if}
      {#if s}<span class="meta">{AGENT_NAMES[s.agent]}{s.provider ? ` · ${s.provider}` : ''}{s.model ? ` · ${s.model}` : ''}</span>{/if}
      <span class="grow"></span>
      {#if s?.windowPid}<button class="link" onclick={e => { e.stopPropagation(); onjump(s.id) }}><Icon name="jump" size={13} />Jump to terminal</button>{/if}
      {#if s && !s.ask}<button class="link" onclick={e => { e.stopPropagation(); ondismiss(s.id) }}>Hide</button>{/if}
    </footer>
  {/if}
</div>

<style>
  .page { padding: 0 18px 12px; display: flex; flex-direction: column; gap: 10px; }
  header { height: 44px; display: flex; align-items: center; gap: 12px; }
  .tabs { flex: 1; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
  .pip-room { width: 52px; flex: none; } /* where Pip sits */
  .tab { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: none; color: var(--muted); white-space: nowrap; }
  .tab.on { background: #ffffff17; color: var(--text); }
  .time { color: var(--muted); flex: none; }

  .body { display: grid; grid-template-columns: 250px 1fr; gap: 16px; min-height: 0; }
  .left { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .status { font-size: 1.35em; font-weight: 700; display: flex; align-items: baseline; gap: 8px; color: var(--c, var(--text)); }
  .status.running { --c: var(--running); }
  .status.done { --c: var(--done); }
  .status.error { --c: var(--error); }
  .status.question { --c: var(--question); }
  .timer { font-size: 0.7em; font-weight: 500; color: var(--muted); font-variant-numeric: tabular-nums; }
  .prompt { color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .summary { font-size: 0.85em; color: var(--muted); }
  .steps { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .steps li { display: flex; align-items: center; gap: 7px; font-size: 0.88em; color: var(--muted); min-width: 0; animation: up 0.18s ease-out both; }
  .steps li span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .steps li :global(svg) { flex: none; }
  .steps li.current { color: var(--text); }
  .steps li.current :global(svg) { color: var(--running); animation: pulse 1.2s ease-in-out infinite; }
  .steps li.failed { color: var(--error); }
  @keyframes up { from { opacity: 0; transform: translateY(4px); } }

  .right { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .card { border-radius: 12px; padding: 10px 12px; background: #ffffff0d; max-height: 170px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; }
  .card.muted { color: var(--muted); }
  .reply { display: flex; gap: 8px; align-items: flex-end; }
  .reply textarea { flex: 1; font: inherit; color: var(--text); background: #ffffff0d; border: 1px solid #ffffff1a; border-radius: 12px; padding: 6px 10px; resize: none; max-height: 90px; field-sizing: content; }
  .reply textarea:focus { outline: 2px solid var(--accent); outline-offset: 0; }

  .history { display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow: auto; }
  .h-item { padding: 7px 0; border-top: 1px solid #ffffff12; }
  .h-top { display: flex; gap: 10px; align-items: baseline; }
  .h-top span { color: var(--muted); font-size: 0.85em; }
  .h-prompt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .h-result { color: var(--muted); font-size: 0.9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: var(--muted); padding: 6px 0 4px; }

  footer { display: flex; align-items: center; gap: 12px; font-size: 0.85em; color: var(--muted); min-height: 24px; }
  .usage { display: inline-flex; align-items: center; gap: 6px; }
  .usage svg { transform: rotate(-90deg); }
  .track { fill: none; stroke: #ffffff1f; stroke-width: 3; }
  .arc { fill: none; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.6s ease-out; }
  .grow { flex: 1; }
  .link { display: inline-flex; align-items: center; gap: 5px; background: none; color: var(--muted); padding: 2px 6px; }
  .link:hover { color: var(--text); }

  .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--c, var(--ready)); }
  .dot.running { --c: var(--running); }
  .dot.done { --c: var(--done); }
  .dot.error { --c: var(--error); }
  .dot.question { --c: var(--question); }
  @keyframes pulse { 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .steps li, .steps li.current :global(svg) { animation: none; } }
</style>
