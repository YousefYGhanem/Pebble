<script lang="ts">
  import type { Shot } from '../../content/types'
  import { image } from '../lib/images'
  import { spotlight } from '../lib/motion'

  // A real capture from the app, cropped to the island (the rest of a capture is transparent), with depth on hover.
  let { shot }: { shot: Shot } = $props()
  const src = $derived(image(shot.src))
  // the size the picture takes before it loads (no layout shift): the cropped part, or the whole capture
  const [w, h] = $derived(shot.h ? [824, shot.h] : shot.size ?? [824, 480])
</script>

{#if src}
  <figure class="shot" use:spotlight>
    <img {src} alt={shot.alt} width={w} height={h} loading="lazy" decoding="async" style:aspect-ratio="{w} / {h}" class:cropped={!!shot.h} />
  </figure>
{/if}

<style>
  .shot {
    margin: 0;
    transform: perspective(1000px) rotateX(calc(var(--ry, 0) * -4deg)) rotateY(calc(var(--rx, 0) * 5deg));
    transition: transform 0.6s var(--ease-out);
    filter: drop-shadow(0 30px 40px rgb(0 0 0 / 0.55));
  }
  img { display: block; inline-size: 100%; block-size: auto; border-radius: 1rem; }
  /* the island fills the middle 85% of a capture's width: trim the transparent sides */
  img.cropped { inline-size: 117%; max-inline-size: none; margin-inline: -8.5%; object-fit: cover; object-position: top; border-radius: 0; }
  @supports (animation-timeline: view()) {
    @media (prefers-reduced-motion: no-preference) {
      img { animation: drift linear both; animation-timeline: view(); }
      @keyframes drift { from { translate: 0 2.5rem; } to { translate: 0 -2.5rem; } }
    }
  }
</style>
