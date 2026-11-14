<script lang="ts">
  import type { Feature } from '../../content/types'
  import Status from './Status.svelte'
  import Usage from './Usage.svelte'
  import Moods from './Moods.svelte'
  import Peeks from './Peeks.svelte'
  import Themes from './Themes.svelte'
  import Keys from './Keys.svelte'
  import Chat from './Chat.svelte'
  import Lang from './Lang.svelte'

  // Which live demo a feature shows (its `live` field in the content files).
  let { f }: { f: Feature } = $props()
  const DEMOS = { status: Status, usage: Usage, pip: Moods, peeks: Peeks, themes: Themes, keys: Keys, chat: Chat, lang: Lang }
  const Demo = $derived(f.live ? DEMOS[f.live] : null)
</script>

{#if Demo}<div class="live"><Demo {f} /></div>{/if}

<style>
  .live {
    position: relative;
    padding: clamp(1.25rem, 3vw, 2rem);
    border-radius: 1.5rem;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.02));
    border: 1px solid var(--stroke);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 30px 60px -30px rgb(0 0 0 / 0.7);
    overflow: hidden;
  }
</style>
