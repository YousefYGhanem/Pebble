<script lang="ts">
  import { site, setLang, type Lang } from '../lib/i18n.svelte'

  // Each language names itself, so these two words are not in the content files.
  const LANGS: { id: Lang; label: string; name: string }[] = [{ id: 'en', label: 'EN', name: 'English' }, { id: 'ar', label: 'عربي', name: 'العربية' }]
</script>

<div class="switch" role="group" aria-label={site.c.nav.language}>
  {#each LANGS as l (l.id)}
    <button type="button" lang={l.id} aria-pressed={site.lang === l.id} aria-label={l.name} onclick={() => setLang(l.id)}>{l.label}</button>
  {/each}
</div>

<style>
  .switch { display: inline-flex; padding: 3px; border-radius: 999px; background: rgb(255 255 255 / 0.06); border: 1px solid var(--stroke); }
  button {
    font: inherit; font-size: 0.82rem; font-weight: 600; color: var(--muted);
    background: transparent; border: 0; border-radius: 999px; padding: 0.3rem 0.7rem; cursor: pointer;
    transition: color 0.2s, background 0.3s var(--ease-out);
  }
  button:hover { color: var(--text); }
  button[aria-pressed='true'] { background: var(--accent); color: #fff; }
</style>
