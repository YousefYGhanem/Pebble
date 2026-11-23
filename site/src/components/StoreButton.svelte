<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import Icon from './Icon.svelte'

  // Pebble on the Microsoft Store (listed as Pebble Pet): the Store installs and updates it.
  const STORE_URL = 'https://apps.microsoft.com/detail/9PJNR7CT4ZN7'
</script>

<a class="btn quiet store" href={STORE_URL} target="_blank" rel="noopener">
  <Icon name="bag" size={18} />
  <span class="label"><small>{site.c.hero.storeSub}</small><span>{site.c.hero.store}</span></span>
</a>

<style>
  .label { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
  .label small { font-size: 0.7rem; font-weight: 500; color: var(--muted); }
</style>
