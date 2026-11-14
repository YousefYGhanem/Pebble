<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import Icon from './Icon.svelte'

  // Not on the Store yet: looks like a store badge, reads "coming soon", and is not a link.
</script>

<span class="btn store">
  <span class="bag"><Icon name="bag" size={20} /></span>
  <span class="label">
    <small>{site.c.hero.storeSoon}</small>
    <span>{site.c.hero.store}</span>
  </span>
</span>

<style>
  .store { background: #000; color: #f3f3f6; border: 1px solid rgb(255 255 255 / 0.22); cursor: default; opacity: 0.72; }
  .bag { display: grid; place-items: center; inline-size: 2rem; block-size: 2rem; border-radius: 0.55rem; background: linear-gradient(135deg, #3a3550, #1a1726); color: #cfc6ff; }
  .label small { order: -1; }
</style>
