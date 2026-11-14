<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import Icon from './Icon.svelte'

  // Not on the Store yet: a quiet badge that reads "coming soon", and is not a link.
</script>

<span class="btn quiet store">
  <Icon name="bag" size={18} />
  <span>{site.c.hero.store}</span>
  <span class="soon">{site.c.hero.storeSoon}</span>
</span>

<style>
  .store { cursor: default; color: #bdbacb; }
  .soon {
    margin-inline-start: 0.15rem; padding: 0.18rem 0.55rem; border-radius: 999px;
    font-size: 0.7rem; font-weight: 500; letter-spacing: 0.01em; white-space: nowrap;
    color: var(--muted); border: 1px dashed var(--stroke-strong);
  }
</style>
