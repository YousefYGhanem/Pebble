/// <reference types="vite/client" />
import type { IslandApi } from '../shared/ipc'

declare global {
  interface Window { pebble: IslandApi }
}
