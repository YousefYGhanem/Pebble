<script lang="ts">
  // An agent's status as a shape as well as a colour (WCAG 1.4.1): ready ○, working ● (pulsing), done ✓, stopped !, needs you ?
  import type { Status } from '../../shared/state'
  import { t } from '../i18n.svelte'

  let { status, size = 10 }: { status: Status; size?: number } = $props()
</script>

<svg class="mark {status}" width={size} height={size} viewBox="0 0 10 10" role="img" aria-label={t(`i.status.${status}`)}>
  {#if status === 'ready'}<circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6" />
  {:else if status === 'running'}<circle cx="5" cy="5" r="4.5" fill="currentColor" />
  {:else}
    <circle cx="5" cy="5" r="5" fill="currentColor" />
    {#if status === 'done'}<path d="M2.8 5.2 L4.4 6.8 L7.3 3.6" fill="none" stroke="var(--background)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    {:else if status === 'error'}<path d="M5 2.4 V5.6 M5 7.4 V7.5" stroke="var(--background)" stroke-width="1.5" stroke-linecap="round" />
    {:else}<path d="M3.6 3.9 Q3.7 2.5 5 2.5 Q6.4 2.5 6.4 3.7 Q6.4 4.6 5 5.1 V5.8 M5 7.5 V7.6" fill="none" stroke="var(--background)" stroke-width="1.3" stroke-linecap="round" />{/if}
  {/if}
</svg>

<style>
  .mark { flex: none; color: var(--ready); }
  .running { color: var(--running); animation: pulse 1.2s steps(5, jump-none) infinite; } /* steps: a smooth endless animation repaints the see-through window at the screen's full rate */
  .done { color: var(--done); }
  .error { color: var(--error); }
  .question { color: var(--question); }
  @keyframes pulse { 50% { opacity: 0.35; } }
  @media (prefers-reduced-motion: reduce) { .running { animation: none; } }
  :global(.reduced) .running { animation: none; }
</style>
