import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// One entry per window: add a preload + html pair here when a new window arrives (settings, buddy, …).
export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve(__dirname, 'app/main/index.ts'), 'connector-runner': resolve(__dirname, 'app/main/connectors/runner.ts') } } }
  },
  preload: {
    build: { rollupOptions: { input: { island: resolve(__dirname, 'app/preload/island.ts'), guard: resolve(__dirname, 'app/preload/guard.ts'), settings: resolve(__dirname, 'app/preload/settings.ts') } } }
  },
  renderer: {
    root: resolve(__dirname, 'app/renderer'),
    plugins: [svelte()],
    build: { rollupOptions: { input: {
      island: resolve(__dirname, 'app/renderer/island/index.html'),
      guard: resolve(__dirname, 'app/renderer/guard/index.html'),
      settings: resolve(__dirname, 'app/renderer/settings/index.html'),
      welcome: resolve(__dirname, 'app/renderer/welcome/index.html'),
      'pip-gallery': resolve(__dirname, 'app/renderer/pip-gallery/index.html') // a design page for Pip (not shipped to users' screens)
    } } }
  }
})
