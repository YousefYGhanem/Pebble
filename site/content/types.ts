// The shape every language file (en.ts, ar.ts) fills in. tests/site-content.test.ts checks both have the same shape.

/** A screenshot from docs/screens or docs/store, by file name without .png (e.g. 'page-music'). */
export interface Shot {
  src: string
  alt: string
  /** px of the 480 px tall capture that hold the island (the rest is transparent); leave out to show it all */
  h?: number
  /** the capture's own size in px when it is not 824 × 480 (only read without h) */
  size?: [number, number]
}

/** A small labelled item a live demo uses (a mood, a theme, a notice, a key...). id is data, label is words. */
export interface Chip {
  id: string
  label: string
  sub?: string
}

/** Live demos a feature can show next to its text (site/src/live). */
export type Live = 'status' | 'usage' | 'pip' | 'peeks' | 'themes' | 'keys' | 'chat' | 'lang'

/** Pip's moods (app/shared/pip.ts) */
export type PipMood = 'idle' | 'curious' | 'focused' | 'alert' | 'happy' | 'love' | 'sleepy' | 'dizzy' | 'grumpy' | 'dancing' | 'sad'

export interface Feature {
  /** the section's #anchor */
  id: string
  /** an icon name from site/src/components/Icon.svelte */
  icon: string
  kicker: string
  title: string
  text: string
  points: string[]
  shots?: Shot[]
  live?: Live
  chips?: Chip[]
  /** how the little Pip in the corner feels while this section is on screen */
  mood?: PipMood
}

export interface Small {
  icon: string
  title: string
  text: string
}

export interface Link {
  label: string
  href: string
}

export interface Content {
  lang: 'en' | 'ar'
  dir: 'ltr' | 'rtl'
  meta: { title: string; description: string }
  nav: { skip: string; features: string; how: string; faq: string; github: string; language: string; menu: string }
  hero: {
    eyebrow: string
    title: string
    lead: string
    download: string
    downloadSub: string
    store: string
    storeSoon: string
    small: string
    worksWith: string
    agents: string[]
  }
  demo: {
    label: string
    hint: string
    agent: string
    project: string
    time: string
    working: string
    asks: string
    question: string
    allow: string
    deny: string
    done: string
    denied: string
    terminal: { title: string; prompt: string; working: string[]; ask: string; done: string[]; denied: string }
  }
  statuses: { ready: string; working: string; done: string; stopped: string; needs: string }
  story: {
    kicker: string
    title: string
    steps: { state: 'resting' | 'working' | 'ask' | 'done'; title: string; text: string }[]
  }
  featuresTitle: { kicker: string; title: string; lead: string }
  features: Feature[]
  more: { kicker: string; title: string; lead: string; items: Small[] }
  how: { kicker: string; title: string; steps: { title: string; text: string }[] }
  faq: { kicker: string; title: string; items: { q: string; a: string }[] }
  cta: { title: string; lead: string }
  footer: { tagline: string; links: Link[]; license: string; notAffiliated: string; pip: string }
}
