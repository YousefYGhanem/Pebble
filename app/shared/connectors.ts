import { z } from 'zod'

// Connectors: small plugins that bring other apps and web services into the island (GitHub, weather, scores…).
// A plugin is a folder with plugin.json (this schema) and a script (main). See docs/PLUGINS.md.

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
  name: z.string().min(1).max(60),
  version: z.string().max(20).default('1.0.0'),
  description: z.string().max(300).default(''),
  main: z.string().regex(/^[\w.-]+\.js$/).default('index.js'),
  permissions: z.object({
    /** hosts fetch may reach (exact, or *.example.com) */
    net: z.array(z.string().min(1).max(200)).max(20).default([]),
    /** setting keys that are secrets: stored encrypted, only given to this plugin */
    secrets: z.array(z.string()).max(10).default([]),
    notify: z.boolean().default(false),
    webhook: z.boolean().default(false),
    /** the titles and programs of open windows */
    windows: z.boolean().default(false)
  }).default({ net: [], secrets: [], notify: false, webhook: false, windows: false }),
  settings: z.array(z.object({
    key: z.string().regex(/^\w{1,40}$/),
    label: z.string().max(120),
    type: z.enum(['string', 'number', 'boolean', 'list']).default('string'),
    required: z.boolean().default(false),
    default: z.unknown().optional(),
    /** chosen from the values found at the address in this other setting (Settings: "Find values") */
    pick: z.string().regex(/^\w{1,40}$/).optional()
  })).max(20).default([])
})

export type Manifest = z.infer<typeof manifestSchema>

/** What a plugin shows. chip: next to Pip; activity: the island while it is live; card: Home and the Widgets page. */
export interface Widget {
  plugin: string
  id: string
  kind: 'chip' | 'activity' | 'card'
  title?: string
  text: string
  /** an Icon name (music, files, agents…), or a single emoji */
  icon?: string
  tone?: 'ok' | 'warn' | 'error' | 'info'
  /** a card's extra lines */
  lines?: string[]
  /** 0–100: a progress line under an activity */
  progress?: number
  /** since when (ms since 1970): the island counts the time next to an activity (a call) */
  since?: number
  /** opened in your browser on a click (http/https only) */
  link?: string
  at: number
}

export interface ConnectorInfo {
  id: string
  name: string
  description: string
  builtIn: boolean
  enabled: boolean
  /** running now */
  running: boolean
  /** what is missing or went wrong, in words */
  problem?: string
}

/** The manifest's permissions as sentences, for the "allow this plugin?" question. */
export function describePermissions(m: Manifest): string[] {
  const p = m.permissions, out: string[] = []
  if (p.net.includes('*')) out.push('Connect to any website')
  else if (p.net.length) out.push(`Connect to: ${p.net.join(', ')}`)
  if (p.secrets.length) out.push(`Keep a secret for it: ${p.secrets.join(', ')} (stored encrypted)`)
  if (p.notify) out.push('Show notifications')
  if (p.webhook) out.push('Receive messages at its own local web address')
  if (p.windows) out.push('See the titles and programs of your open windows')
  if (!out.length) out.push('Nothing beyond showing its widgets')
  return out
}

/** host allowed by a pattern list ("api.github.com", "*.espn.com") */
export function hostAllowed(host: string, patterns: string[]): boolean {
  const h = host.toLowerCase()
  return patterns.some(p => {
    const q = p.toLowerCase()
    if (q === '*') return true // any site (feed readers, website watchers)
    return q.startsWith('*.') ? h === q.slice(2) || h.endsWith(q.slice(1)) : h === q
  })
}
