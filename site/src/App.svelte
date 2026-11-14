<script lang="ts">
  import { site } from './lib/i18n.svelte'
  import { reveal } from './lib/motion'
  import Nav from './components/Nav.svelte'
  import Hero from './components/Hero.svelte'
  import Story from './components/Story.svelte'
  import Feature from './components/Feature.svelte'
  import More from './components/More.svelte'
  import Steps from './components/Steps.svelte'
  import Faq from './components/Faq.svelte'
  import Cta from './components/Cta.svelte'
  import Footer from './components/Footer.svelte'
  import Buddy from './components/Buddy.svelte'

  const c = $derived(site.c)
</script>

<a class="skip" href="#main">{c.nav.skip}</a>
<div class="backdrop" aria-hidden="true"></div>
<div class="progress" aria-hidden="true"></div>
<Nav />

<main id="main" tabindex="-1">
  <Hero />
  <Story />
  <section class="features" id="features" aria-labelledby="features-title">
    <header class="container head" use:reveal>
      <p class="kicker">{c.featuresTitle.kicker}</p>
      <h2 id="features-title">{c.featuresTitle.title}</h2>
      <p class="lead">{c.featuresTitle.lead}</p>
    </header>
    {#each c.features as f, i (f.id)}
      <Feature {f} flip={i % 2 === 1} />
    {/each}
  </section>
  <More />
  <Steps />
  <Faq />
  <Cta />
</main>

<Footer />
<Buddy />

<style>
  .features { padding-block-start: var(--section-pad); scroll-margin-top: var(--nav-h); }
  .head { text-align: center; max-inline-size: 46rem; margin-block-end: 1rem; }
</style>
