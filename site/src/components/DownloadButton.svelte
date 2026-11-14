<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { release, loadRelease } from '../lib/release.svelte'
  import { magnetic } from '../lib/motion'
  import Icon from './Icon.svelte'

  let { compact = false }: { compact?: boolean } = $props()
  loadRelease()
</script>

<a class="btn primary" class:compact href={release.href} use:magnetic rel="noopener">
  <Icon name="download" size={compact ? 16 : 20} />
  <span class="label">
    <span>{site.c.hero.download}</span>
    {#if !compact}<small>{release.version ? `${site.c.hero.downloadSub} · ${release.version}` : site.c.hero.downloadSub}</small>{/if}
  </span>
</a>
