<script lang="ts">
  import type { Feature } from '../../content/types'
  import { contentOf, site } from '../lib/i18n.svelte'
  import LanguageSwitch from '../components/LanguageSwitch.svelte'

  // The same island line in both languages, each in its own direction; the switch changes this whole page.
  let { f: _f }: { f: Feature } = $props()
  const LANGS = ['en', 'ar'] as const
</script>

<div class="lang">
  {#each LANGS as l (l)}
    {@const c = contentOf(l)}
    <div class="row" class:on={site.lang === l} lang={l} dir={c.dir}>
      <span class="glyph">?</span>
      <span class="txt"><b>{c.demo.project}</b> · {c.statuses.needs}</span>
      <span class="btns"><i>{c.demo.deny}</i><i class="go">{c.demo.allow}</i></span>
    </div>
  {/each}
  <div class="sw"><LanguageSwitch /></div>
</div>

<style>
  .lang { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.9rem; }
  .row {
    display: flex; align-items: center; gap: 0.7rem; padding: 0.75rem 0.9rem; border-radius: 1.4rem;
    background: linear-gradient(180deg, #1b1a24, #0c0b11); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08);
    opacity: 0.55; transition: opacity 0.4s, transform 0.5s var(--spring);
  }
  .row.on { opacity: 1; transform: scale(1.02); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 40px -10px rgb(245 158 11 / 0.5); }
  .glyph { display: grid; place-items: center; inline-size: 1.4rem; block-size: 1.4rem; border-radius: 50%; background: #f59e0b; color: #0c0b11; font-weight: 800; font-size: 0.8rem; flex: none; }
  .txt { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .btns { display: flex; gap: 0.4rem; }
  .btns i { font-style: normal; font-size: 0.85rem; padding: 0.3rem 0.8rem; border-radius: 999px; background: #2a2934; }
  .btns .go { background: #7c5cff; color: #fff; }
  .sw { justify-self: center; margin-block-start: 0.5rem; }
</style>
