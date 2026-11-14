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
  import { glow } from '../lib/motion'

  // Which live demo a feature shows (its `live` field in the content files).
  let { f }: { f: Feature } = $props()
  const DEMOS = { status: Status, usage: Usage, pip: Moods, peeks: Peeks, themes: Themes, keys: Keys, chat: Chat, lang: Lang }
  const Demo = $derived(f.live ? DEMOS[f.live] : null)
</script>

{#if Demo}<div class="bezel" use:glow><div class="bezel-in live"><Demo {f} /></div></div>{/if}

<style>
  .live {
    padding: clamp(1.25rem, 3vw, 2rem);
    background:
      radial-gradient(80% 60% at 50% 0%, rgb(124 92 255 / 0.08), transparent 70%),
      linear-gradient(180deg, var(--surface-2), var(--surface));
  }
</style>
