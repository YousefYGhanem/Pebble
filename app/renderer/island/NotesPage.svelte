<script lang="ts">
  // Notes: quick notes, kept on this PC (userData/notes.json). The list on the left, the note on the right; saved as you
  // type (half a second after you stop).
  import { todayProgress, type Action, type Note, type Todo } from '../../shared/extras'
  import Icon from './Icon.svelte'
  import { t } from '../i18n.svelte'
  import { undo } from './undo.svelte'
  import { ago } from './pages'

  let { notes, todos = [], now, act }: { notes: Note[]; todos?: Todo[]; now: number; act: (a: Action) => void } = $props()
  let tab = $state<'notes' | 'todo'>('notes')
  // a new task: its words, a time (today, or tomorrow if that time has passed), every day or once
  let task = $state(''), time = $state(''), daily = $state(false)
  function addTask() {
    if (!task.trim()) return
    let due: number | undefined
    if (time) {
      const [h, m] = time.split(':').map(Number)
      const d = new Date(now); d.setHours(h!, m!, 0, 0)
      due = d.getTime() <= now ? d.getTime() + 86_400_000 : d.getTime()
    }
    act({ do: 'todo.add', text: task.trim(), due, daily: daily || undefined })
    task = ''; time = ''; daily = false
  }
  const at = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const progress = $derived(todayProgress(todos, now))
  let selected = $state<string>()
  let draft = $state<Note[]>([])
  let timer: ReturnType<typeof setTimeout> | undefined
  // follow main, except while you are typing (your words win)
  $effect(() => { if (!timer) draft = notes.map(n => ({ ...n })) })
  const current = $derived(draft.find(n => n.id === selected) ?? draft[0])
  const titleOf = (n: Note) => n.text.split('\n')[0]?.trim() || t('i.notes.untitled')

  function save() {
    clearTimeout(timer)
    timer = setTimeout(() => { timer = undefined; act({ do: 'notes.save', notes: $state.snapshot(draft) }) }, 500)
  }
  function add() {
    const n = { id: crypto.randomUUID(), text: '', at: Date.now() }
    draft = [n, ...draft]
    selected = n.id
    save()
  }
  function remove(id: string) {
    const before = $state.snapshot(draft)
    draft = draft.filter(n => n.id !== id)
    save()
    // undo also cancels the pending save of the list without it
    undo.offer(t('i.undo.note'), { undo: () => { clearTimeout(timer); timer = undefined; act({ do: 'notes.save', notes: before }) } })
  }
</script>

<div class="page">
  <div class="page-head">
    <span class="page-title">{t('i.page.notes')}</span>
    <div class="kinds" role="group" aria-label={t('i.notes.kinds')}>
      <button class:on={tab === 'notes'} aria-pressed={tab === 'notes'} onclick={() => (tab = 'notes')}>{t('i.page.notes')}</button>
      <button class:on={tab === 'todo'} aria-pressed={tab === 'todo'} onclick={() => (tab = 'todo')}>{t('i.todo.title')}{#if progress.total} · {progress.done}/{progress.total}{/if}</button>
    </div>
    {#if tab === 'notes'}
      <button class="ghost" onclick={add}><Icon name="plus" size={13} />{t('i.common.new')}</button>
      <!-- in the header, not over the text it would hide -->
      {#if current}<button class="ghost" onclick={() => remove(current.id)}><Icon name="trash" size={12} />{t('i.common.delete')}</button>{/if}
    {/if}
    <span class="page-time"></span><span class="pip-room"></span>
  </div>
  {#if tab === 'todo'}
    <form class="addtask" onsubmit={e => { e.preventDefault(); addTask() }}>
      <input type="text" bind:value={task} maxlength="300" placeholder={t('i.todo.new')} aria-label={t('i.todo.new')} />
      <input type="time" bind:value={time} aria-label={t('i.todo.time')} title={t('i.todo.time')} />
      <label class="daily"><input type="checkbox" bind:checked={daily} />{t('i.todo.daily')}</label>
      <button type="submit" class="likely" disabled={!task.trim()}><Icon name="plus" size={13} /></button>
    </form>
    <div class="tasks">
      {#each todos.filter(x => !undo.hides(`todo:${x.id}`)) as x (x.id)}
        <div class="task" class:done={x.done}>
          <input type="checkbox" checked={x.done} onchange={() => act({ do: 'todo.toggle', id: x.id })} aria-label={x.text} />
          <span class="ttext">{x.text}</span>
          {#if x.due && !x.done}<span class="when">{at(x.due)}{#if x.daily} · {t('i.todo.everyDay')}{/if}</span>{/if}
          <button class="ghost" aria-label={t('i.common.delete')} title={t('i.common.delete')} onclick={() => undo.offer(t('i.undo.todo'), { hides: `todo:${x.id}`, commit: () => act({ do: 'todo.remove', id: x.id }) })}><Icon name="close" size={11} /></button>
        </div>
      {:else}
        <div class="empty">{t('i.todo.none')}</div>
      {/each}
    </div>
  {:else if !draft.length}
    <div class="empty">{t('i.notes.none')}</div>
  {:else}
    <div class="notes">
      <div class="list">
        {#each draft as n (n.id)}
          <button class="item" class:on={n.id === current?.id} onclick={() => (selected = n.id)}><span class="name">{titleOf(n)}</span><small>{ago(n.at, now)}</small></button>
        {/each}
      </div>
      {#if current}
        <div class="editor">
          <textarea bind:value={current.text} oninput={() => { current.at = Date.now(); save() }} placeholder={t('i.notes.write')}></textarea>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .kinds { display: flex; gap: 2px; padding: 2px; border-radius: var(--r-pill); background: var(--surface1); }
  .kinds button { padding: 3px 11px; font-size: 0.82em; background: none; color: var(--muted); }
  .kinds button.on { background: var(--surface3); color: var(--text); }
  .addtask { display: flex; gap: 8px; align-items: center; }
  .addtask input[type='text'] { flex: 1; min-width: 0; font: inherit; color: var(--text); background: var(--surface1); border: 1px solid var(--stroke); border-radius: var(--r-m); padding: 6px 10px; }
  .addtask input[type='time'] { font: inherit; color: var(--text); background: var(--surface1); border: 1px solid var(--stroke); border-radius: var(--r-m); padding: 5px 8px; color-scheme: dark; }
  .daily { display: inline-flex; align-items: center; gap: 4px; font-size: 0.85em; color: var(--muted); white-space: nowrap; }
  .tasks { display: flex; flex-direction: column; gap: 2px; max-height: 200px; overflow: auto; margin-bottom: 8px; }
  .task { display: flex; align-items: center; gap: 10px; padding: 5px 6px; border-radius: var(--r-m); }
  .task:hover { background: var(--surface1); }
  .task input { accent-color: var(--accent); width: 16px; height: 16px; flex: none; }
  .ttext { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .task.done .ttext { color: var(--muted); text-decoration: line-through; }
  .when { flex: none; font-size: 0.8em; color: var(--accent-text); }
  .notes { display: grid; grid-template-columns: 170px 1fr; gap: 12px; height: 220px; margin-bottom: 8px; }
  .list { display: flex; flex-direction: column; gap: 2px; overflow: auto; }
  .item { display: flex; flex-direction: column; text-align: start; background: none; border-radius: 10px; padding: 6px 10px; color: var(--muted); }
  .item .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item small { font-size: 0.78em; opacity: 0.7; }
  .item.on { background: var(--surface2); color: var(--text); }
  .editor { position: relative; display: flex; }
  textarea { flex: 1; resize: none; font: inherit; line-height: 1.5; color: var(--text); background: var(--surface1); border: 1px solid var(--stroke); border-radius: 12px; padding: 10px 12px; }
  textarea:focus { outline: 2px solid var(--accent); outline-offset: 0; }
</style>
