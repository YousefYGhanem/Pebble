import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Pebble's website (GitHub Pages: https://yousefyghanem.github.io/Pebble/). npm run site:dev / site:build.
const site = fileURLToPath(new URL('.', import.meta.url))
const repo = fileURLToPath(new URL('..', import.meta.url))

/** Only the captures the content files show go into the build (images.ts globs every capture, so any can be named). */
const used = new Set(Array.from(readFileSync(`${site}content/en.ts`, 'utf8').matchAll(/src: '([^']+)'/g), m => `${m[1]}.png`))
const onlyUsedImages = (): Plugin => ({
  name: 'pebble-only-used-images',
  apply: 'build',
  generateBundle(_, bundle) {
    for (const [file, a] of Object.entries(bundle)) {
      if (a.type === 'asset' && file.endsWith('.png') && !a.names.some(n => used.has(n))) delete bundle[file]
    }
  }
})

/** In the built page only (the dev server needs its websocket): no scripts but ours, and no request but GitHub's API. */
const csp = (): Plugin => ({
  name: 'pebble-csp',
  apply: 'build',
  transformIndexHtml: () => [{
    tag: 'meta',
    attrs: { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src https://api.github.com; base-uri 'self'; form-action 'none'" },
    injectTo: 'head-prepend'
  }]
})

export default defineConfig({
  root: site,
  base: '/Pebble/',
  plugins: [svelte({ configFile: false }), onlyUsedImages(), csp()],
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
  server: { fs: { allow: [repo] } }
})
