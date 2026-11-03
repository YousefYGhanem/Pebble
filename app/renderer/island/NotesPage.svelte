<script lang="ts">
  // Notes: quick notes, kept on this PC (userData/notes.json). The list on the left, the note on the right; saved as you
  // type (half a second after you stop).
  import type { Action, Note } from '../../shared/extras'
  import Icon from './Icon.svelte'

  let { notes, act }: { notes: Note[]; act: (a: Action) => void } = $props()
  let selected = $state<string>()
  let draft = $state<Note[]>([])
  let timer: ReturnType<typeof setTimeout> | undefined
  // follow main, except while you are typing (your words win)
  $effect(() => { if (!timer) draft = notes.map(n => ({ ...n })) })
  const current = $derived(draft.find(n => n.id === selected) ?? draft[0])
  const titleOf = (n: Note) => n.text.split('\n')[0]?.trim() || 'Empty note'

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
    draft = draft.filter(n => n.id !== id)
    save()
  }
</script>

<div class="page">
  <div class="page-head">
    <span class="page-title">Notes</span>
    <button class="ghost" onclick={add}><Icon name="plus" size={13} />New</button>
    <span class="page-time"></span><span class="pip-room"></span>
  </div>
  {#if !draft.length}
    <div class="empty">No notes yet. “New” starts one.</div>
  {:else}
    <div class="notes">
      <div class="list">
        {#each draft as n (n.id)}
          <button class="item" class:on={n.id === current?.id} onclick={() => (selected = n.id)}>{titleOf(n)}</button>
        {/each}
      </div>
      {#if current}
        <div class="editor">
          <textarea bind:value={current.text} oninput={() => { current.at = Date.now(); save() }} placeholder="Write something…"></textarea>
          <button class="ghost del" onclick={() => remove(current.id)}><Icon name="trash" size={12} />Delete</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .notes { display: grid; grid-template-columns: 170px 1fr; gap: 12px; height: 220px; margin-bottom: 8px; }
  .list { display: flex; flex-direction: column; gap: 2px; overflow: auto; }
  .item { text-align: left; background: none; border-radius: 10px; padding: 7px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--muted); }
  .item.on { background: #ffffff16; color: var(--text); }
  .editor { position: relative; display: flex; }
  textarea { flex: 1; resize: none; font: inherit; line-height: 1.5; color: var(--text); background: #ffffff0b; border: 1px solid #ffffff14; border-radius: 12px; padding: 10px 12px; }
  textarea:focus { outline: 2px solid var(--accent); outline-offset: 0; }
  .del { position: absolute; right: 6px; bottom: 6px; font-size: 0.85em; }
</style>
