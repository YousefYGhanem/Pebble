<script lang="ts">
  // Notes: quick notes, kept on this PC (userData/notes.json). The list on the left, the note on the right; saved as you
  // type (half a second after you stop).
  import type { Action, Note } from '../../shared/extras'
  import Icon from './Icon.svelte'
  import { t } from '../i18n.svelte'
  import { undo } from './undo.svelte'
  import { ago } from './pages'

  let { notes, now, act }: { notes: Note[]; now: number; act: (a: Action) => void } = $props()
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
    <button class="ghost" onclick={add}><Icon name="plus" size={13} />{t('i.common.new')}</button>
    <!-- in the header, not over the text it would hide -->
    {#if current}<button class="ghost" onclick={() => remove(current.id)}><Icon name="trash" size={12} />{t('i.common.delete')}</button>{/if}
    <span class="page-time"></span><span class="pip-room"></span>
  </div>
  {#if !draft.length}
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
  .notes { display: grid; grid-template-columns: 170px 1fr; gap: 12px; height: 220px; margin-bottom: 8px; }
  .list { display: flex; flex-direction: column; gap: 2px; overflow: auto; }
  .item { display: flex; flex-direction: column; text-align: start; background: none; border-radius: 10px; padding: 6px 10px; color: var(--muted); }
  .item .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item small { font-size: 0.78em; opacity: 0.7; }
  .item.on { background: #ffffff16; color: var(--text); }
  .editor { position: relative; display: flex; }
  textarea { flex: 1; resize: none; font: inherit; line-height: 1.5; color: var(--text); background: #ffffff0b; border: 1px solid #ffffff14; border-radius: 12px; padding: 10px 12px; }
  textarea:focus { outline: 2px solid var(--accent); outline-offset: 0; }
</style>
