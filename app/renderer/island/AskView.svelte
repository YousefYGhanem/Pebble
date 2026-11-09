<script lang="ts">
  // What a session asks, in full: a permission (with the change it makes), Claude's multiple-choice questions,
  // or a plan to approve or send back with feedback.
  import type { Answer } from '../../shared/ipc'
  import { diffOf, risky, type Session } from '../../shared/state'
  import DiffView from './DiffView.svelte'
  import { markdown } from './md'
  import { t } from '../i18n.svelte'
  /** text from an agent goes into the sentence as text, never as markup */
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

  let { session, onanswer }: { session: Session; onanswer: (a: Answer) => void } = $props()
  const ask = $derived(session.ask!)

  // questions: picked labels per question, plus your own words
  let picked = $state<Record<string, string[]>>({})
  let other = $state<Record<string, string>>({})
  let feedback = $state('')

  const answerFor = (q: string) => (other[q]?.trim() ? other[q]!.trim() : (picked[q] ?? []).join(', '))
  const complete = $derived(ask.kind === 'question' && ask.questions.every(q => answerFor(q.question)))

  function pick(q: string, label: string, multi: boolean) {
    const now = picked[q] ?? []
    picked[q] = multi ? (now.includes(label) ? now.filter(x => x !== label) : [...now, label]) : [label]
    other[q] = ''
  }

  function send() {
    if (ask.kind !== 'question' || !complete) return
    onanswer({ kind: 'question', answers: Object.fromEntries(ask.questions.map(q => [q.question, answerFor(q.question)])) })
  }

  const permissionDiff = $derived(ask.kind === 'permission' ? diffOf(ask.tool, ask.input) : undefined)
</script>

<div class="ask">
  {#if ask.kind === 'permission'}
    <div class="title">{@html t('i.ask.wantsTo', { project: `<b>${esc(session.project)}</b>`, tool: `<b>${esc(ask.tool)}</b>` })}</div>
    {#if permissionDiff}
      <DiffView diff={permissionDiff} />
    {:else}
      <pre class="command">{ask.summary}</pre>
    {/if}
    <div class="buttons">
      <button class:likely={!risky(ask.tool)} onclick={() => onanswer({ kind: 'permission', choice: 'allow' })}>{t('i.ask.allow')}</button>
      {#if ask.canAlways}<button onclick={() => onanswer({ kind: 'permission', choice: 'always' })}>{t('i.ask.always')}</button>{/if}
      <button onclick={() => onanswer({ kind: 'permission', choice: 'deny' })}>{t('i.ask.deny')}</button>
    </div>
  {:else if ask.kind === 'question'}
    {#each ask.questions as q (q.question)}
      <div class="question">
        {#if q.header}<span class="chip">{q.header}</span>{/if}
        <div class="q">{q.question}</div>
        <div class="options">
          {#each q.options as o (o.label)}
            <button class="option" class:on={(picked[q.question] ?? []).includes(o.label)} title={o.description} onclick={() => pick(q.question, o.label, !!q.multiSelect)}>
              {o.label}{#if o.description}<small>{o.description}</small>{/if}
            </button>
          {/each}
        </div>
        <input placeholder={t('i.ask.own')} bind:value={other[q.question]} onkeydown={e => e.key === 'Enter' && send()} />
      </div>
    {/each}
    <div class="buttons"><button class="likely" disabled={!complete} onclick={send}>{t('i.ask.sendAnswer')}</button></div>
  {:else}
    <div class="title">{@html t('i.ask.hasPlan', { project: `<b>${esc(session.project)}</b>` })}</div>
    <div class="plan">{@html markdown(ask.plan)}</div>
    <textarea rows="2" placeholder={t('i.ask.change')} bind:value={feedback}></textarea>
    <div class="buttons">
      <button class="likely" onclick={() => onanswer({ kind: 'plan', approve: true })}>{t('i.ask.approve')}</button>
      <button onclick={() => onanswer({ kind: 'plan', approve: false, feedback })}>{feedback.trim() ? t('i.ask.feedback') : t('i.ask.keepPlanning')}</button>
    </div>
  {/if}
</div>

<style>
  .ask { display: flex; flex-direction: column; gap: 10px; }
  .title { line-height: 1.35; }
  .command { margin: 0; padding: 8px 10px; border-radius: 10px; background: var(--surface1); font: 12px/1.45 'Cascadia Mono', Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 120px; overflow: auto; }
  .buttons { display: flex; gap: 8px; }
  .buttons button { flex: 1; }
  .question { display: flex; flex-direction: column; gap: 6px; }
  .chip { align-self: flex-start; font-size: 0.8em; padding: 1px 8px; border-radius: 999px; background: var(--surface2); color: var(--muted); }
  .q { font-weight: 600; }
  .options { display: flex; flex-wrap: wrap; gap: 6px; }
  .option { display: flex; flex-direction: column; align-items: flex-start; border-radius: 12px; text-align: left; max-width: 100%; }
  .option small { color: var(--muted); font-size: 0.82em; }
  .option.on { background: var(--accent); color: var(--on-accent); }
  .option.on small { color: inherit; opacity: 0.8; }
  .plan { max-height: 170px; overflow: auto; padding: 8px 12px; border-radius: 10px; background: var(--surface1); line-height: 1.45; }
  .plan :global(h3), .plan :global(h4), .plan :global(h5) { margin: 6px 0 2px; font-size: 1em; }
  .plan :global(p) { margin: 2px 0; }
  .plan :global(ul), .plan :global(ol) { margin: 2px 0; padding-left: 20px; }
  .plan :global(code) { font-family: 'Cascadia Mono', Consolas, monospace; font-size: 0.92em; background: var(--surface2); padding: 0 4px; border-radius: 4px; }
  .plan :global(pre) { background: #00000055; padding: 6px 8px; border-radius: 8px; overflow: auto; }
  input, textarea { font: inherit; color: var(--text); background: var(--surface1); border: 1px solid var(--stroke); border-radius: 10px; padding: 6px 10px; resize: none; }
  input:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: 0; }
</style>
