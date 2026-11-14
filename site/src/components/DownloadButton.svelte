<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { release, loadRelease } from '../lib/release.svelte'
  import Icon from './Icon.svelte'

  let { compact = false }: { compact?: boolean } = $props()
  loadRelease()
</script>

<a class="btn shiny" class:compact href={release.href} rel="noopener">
  <span class="sb-in">
    <Icon name="download" size={compact ? 15 : 18} />
    <span class="label">
      <span>{site.c.hero.download}</span>
      {#if !compact}<small>{release.version ? `${site.c.hero.downloadSub} · ${release.version}` : site.c.hero.downloadSub}</small>{/if}
    </span>
  </span>
</a>
