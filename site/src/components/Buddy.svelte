<script lang="ts">
  import { site } from '../lib/i18n.svelte'
  import { buddy } from '../lib/buddy.svelte'
  import type { PipMood } from '../../content/types'
  import PipCanvas from './PipCanvas.svelte'

  // Pip keeps you company once the hero is out of sight: he feels the section on screen and minds being poked
  // (the app's rule in app/shared/pip.ts: 3 pokes in 3 s make him grumpy, 6 dizzy). Asleep after 40 s without input.
  let pokes = $state<number[]>([])
  let now = $state(Date.now())
  let lastInput = Date.now()
  let hover = $state(false)

  $effect(() => {
    if (!buddy.show) return
    const id = setInterval(() => (now = Date.now()), 500)
    const wake = () => (lastInput = Date.now())
    addEventListener('pointermove', wake, { passive: true })
    addEventListener('keydown', wake)
    addEventListener('scroll', wake, { passive: true })
    return () => { clearInterval(id); removeEventListener('pointermove', wake); removeEventListener('keydown', wake); removeEventListener('scroll', wake) }
  })

  const mood = $derived.by((): PipMood => {
    const recent = pokes.filter(t => now - t < 3000).length
    if (recent >= 6) return 'dizzy'
    if (recent >= 3) return 'grumpy'
    if (recent >= 1) return 'love'
    if (hover) return 'curious'
    if (now - lastInput > 40000) return 'sleepy'
    return buddy.mood
  })
  function poke() {
    now = Date.now()
    pokes = [...pokes.filter(t => now - t < 3000), now]
  }
</script>

<button type="button" class="buddy" class:show={buddy.show} aria-label={site.c.footer.pip} tabindex={buddy.show ? 0 : -1}
  onclick={poke} onpointerenter={() => (hover = true)} onpointerleave={() => (hover = false)}>
  {#if buddy.show}<PipCanvas {mood} scale={0.5} />{/if}
</button>

<style>
  .buddy {
    position: fixed; z-index: 40; inset-block-end: 1.1rem; inset-inline-end: 1.1rem;
    inline-size: 4.4rem; block-size: 4.4rem; padding: 0; border-radius: 50%; cursor: pointer;
    background: radial-gradient(circle at 50% 35%, rgb(124 92 255 / 0.28), rgb(14 13 21 / 0.92) 70%);
    border: 1px solid rgb(185 168 255 / 0.25);
    box-shadow: 0 16px 40px -10px rgb(0 0 0 / 0.8), 0 0 30px -8px rgb(124 92 255 / 0.6);
    opacity: 0; translate: 0 1.5rem; scale: 0.6; pointer-events: none; visibility: hidden;
    transition: opacity 0.3s, translate 0.6s var(--spring), scale 0.6s var(--spring), visibility 0s 0.6s;
  }
  .buddy.show { opacity: 1; translate: 0 0; scale: 1; pointer-events: auto; visibility: visible; transition-delay: 0s; }
  .buddy:active { scale: 0.92; }
  @media (max-width: 640px) { .buddy { inline-size: 3.6rem; block-size: 3.6rem; inset-block-end: 0.8rem; inset-inline-end: 0.8rem; } }
</style>
