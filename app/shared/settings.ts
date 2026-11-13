import { z } from 'zod'
import { PROVIDER_IDS } from './chat'
import { PIP_LOOKS } from './pip'

// Everything the user can change. settings.json in userData holds only what differs from DEFAULTS;
// it is merged over DEFAULTS and then checked against this schema.
export const CHIPS = ['none', 'time', 'battery', 'cpu', 'ram', 'prayer'] as const

/** a built-in chip, or a connector's chip widget: "widget:<connector>/<widget>" */
const CHIP = z.union([z.enum(CHIPS), z.string().regex(/^widget:[a-z0-9-]+\/[\w-]+$/)])

export const settingsSchema = z.object({
  version: z.literal(1),
  theme: z.string().min(1),
  general: z.object({
    /** an i18n/<language>.json file */
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    /** the welcome tour was shown */
    welcomed: z.boolean(),
    /** tips already shown once in the island (Settings → General → Show the tips again) */
    tipsSeen: z.array(z.enum(['ask', 'tuck', 'drop'])),
    startWithWindows: z.boolean(),
    /** the tray's and the windows' icon (the installer and the exe file keep lavender) */
    icon: z.enum(['lavender', 'cream', 'graphite']),
    /** download new versions from GitHub Releases by themselves */
    updates: z.boolean(),
    toggleShortcut: z.string(),
    tuckShortcut: z.string(),
    /** screen buddy: shows Pip the window under the mouse */
    buddyShortcut: z.string(),
    /** opens the chat and starts Windows voice typing */
    voiceShortcut: z.string(),
    /** mutes the microphone for every app (and unmutes it) */
    micShortcut: z.string()
  }),
  island: z.object({
    /** notch: hangs from the top edge with curved "ears"; floating: a pill a little below it */
    style: z.enum(['notch', 'floating']),
    openOn: z.enum(['hover', 'click']),
    /** 'main' or a display id (Settings → Island → Screen) */
    display: z.union([z.literal('main'), z.number().int()]),
    restingWidth: z.number().int().min(60).max(600),
    restingHeight: z.number().int().min(20).max(60),
    width: z.number().int().min(120).max(1200),
    height: z.number().int().min(24).max(80),
    askWidth: z.number().int().min(200).max(1200),
    openWidth: z.number().int().min(300).max(1400),
    offsetTop: z.number().int().min(0).max(200),
    /** 0 = solid, 60 = mostly see-through */
    seeThrough: z.number().min(0).max(60),
    /** hide while something runs full screen on the island's screen */
    gameMode: z.boolean(),
    /** in a full-screen game, a slim strip with the time, CPU and memory instead of nothing */
    gameStrip: z.boolean(),
    /** living skins: fire or frost from the processor, a web at night, vines after a long day */
    skins: z.boolean(),
    /** the small island while something goes on: a line of text (detailed), or only its signs (minimal: a mark, a cover, Pip) */
    compact: z.enum(['detailed', 'minimal']),
    /** what the resting island shows left and right of Pip */
    chips: z.object({ left: CHIP, right: CHIP }),
    /** pages left out of the page row (Home and Agents always stay) */
    hiddenPages: z.array(z.enum(['chat', 'music', 'files', 'clipboard', 'notes', 'focus', 'widgets']))
  }),
  music: z.object({
    /** now playing from Windows' media controls (any player), with controls and a sound wave */
    enabled: z.boolean(),
    /** timed lyrics from LRCLIB (only the song's title, artist, album and length are sent) */
    lyrics: z.boolean(),
    /** a sound made by Pebble while a focus round runs */
    focusSound: z.enum(['off', 'rain', 'deep', 'waves'])
  }),
  /** your last 25 copied texts, kept in memory only (never on disk); password managers' copies are skipped */
  clipboard: z.object({ enabled: z.boolean() }),
  /** how long each app is in front today, counted on this PC only (never sent anywhere) */
  screenTime: z.object({ enabled: z.boolean() }),
  /** Pip reminds you to drink water and to stand up, within these hours (off until you switch them on) */
  wellness: z.object({
    water: z.boolean(), waterMinutes: z.number().int().min(15).max(240),
    stand: z.boolean(), standMinutes: z.number().int().min(15).max(180),
    from: z.number().int().min(0).max(23), to: z.number().int().min(1).max(24)
  }),
  /** prayer times, worked out on this PC from your city: the next one on the island, a reminder at each */
  prayer: z.object({
    enabled: z.boolean(),
    city: z.string().max(120), lat: z.number().min(-90).max(90).nullable(), lng: z.number().min(-180).max(180).nullable(),
    method: z.enum(['MuslimWorldLeague', 'Egyptian', 'Karachi', 'UmmAlQura', 'Dubai', 'MoonsightingCommittee', 'NorthAmerica', 'Kuwait', 'Qatar', 'Singapore', 'Tehran', 'Turkey']),
    madhab: z.enum(['shafi', 'hanafi']),
    /** a Windows notification at each prayer (the island always shows it) */
    notify: z.boolean(),
    /** music that plays pauses at the prayer's time */
    pauseMusic: z.boolean()
  }),
  focusGuard: z.object({
    enabled: z.boolean(),
    /** apps (program name) or sites (word in a browser tab's title) */
    sites: z.array(z.string()).max(50),
    snoozeMinutes: z.number().int().min(1).max(120)
  }),
  pip: z.object({
    /** what you call him */
    name: z.string().min(1).max(24),
    /** 'auto' (the outfit of the season), 'none', a built-in outfit id, or the name of your own SVG in the outfits folder */
    outfit: z.string(),
    /** Pip's eyes follow your mouse near the island */
    followMouse: z.boolean(),
    /** his colours: the theme's, an app icon's, or 'custom' (body, visor) */
    look: z.enum(PIP_LOOKS),
    body: z.string().regex(/^#[0-9a-f]{6}$/i),
    visor: z.string().regex(/^#[0-9a-f]{6}$/i),
    /** no mouse or keyboard for this long: Pip falls asleep */
    sleepAfterMinutes: z.number().min(1).max(240)
  }),
  motion: z.object({
    /** system follows Windows' "animation effects" setting */
    mode: z.enum(['system', 'full', 'reduced']),
    speed: z.number().min(0.5).max(2)
  }),
  agents: z.object({
    claude: z.object({ enabled: z.boolean(), answerPermissions: z.boolean() }),
    /** connected automatically when found on this PC */
    codex: z.object({ enabled: z.boolean() }),
    gemini: z.object({ enabled: z.boolean() }),
    cursor: z.object({ enabled: z.boolean() }),
    opencode: z.object({ enabled: z.boolean() }),
    aider: z.object({ enabled: z.boolean() }),
    /** DeepSeek Harness: Pebble reads its session logs (no hooks to install) */
    dsh: z.object({ enabled: z.boolean() })
  }),
  terminals: z.object({
    /** a command that ran at least this long tells you when it finishes (Settings → Agents → Terminals adds it to your shells) */
    minSeconds: z.number().int().min(1).max(3600)
  }),
  features: z.object({
    sound: z.boolean(),
    /** Windows notifications when an agent finishes or needs you */
    toasts: z.boolean(),
    /** short notices on the island when something on the PC changes (charger, network, Caps Lock, sound device…) */
    peeks: z.boolean(),
    /** a notification (and a worried Pip) when a CLI passes 80% and 95% of its session or week */
    usageAlerts: z.boolean(),
    /** which Windows notifications, by where they come from (problems with Pebble itself always show) */
    notify: z.object({ asks: z.boolean(), done: z.boolean(), connectors: z.boolean(), extras: z.boolean() }),
    /** pause what nobody needs while you are away, a game runs full screen, or the PC is on battery */
    rest: z.object({ away: z.boolean(), games: z.boolean(), battery: z.boolean() }),
    doneSeconds: z.number().min(1).max(600)
  }),
  /** Pip's chat: who answers (API keys are kept encrypted, outside this file); model '' = the provider's default */
  chat: z.object({ provider: z.enum(PROVIDER_IDS), model: z.string().max(100), readAloud: z.boolean() }),
  /** chat apps followed as sessions: desktop apps by process name (UI Automation, beta); the browser goes through the extension */
  chatApps: z.object({ desktop: z.array(z.enum(['claude', 'chatgpt'])) }),
  server: z.object({ port: z.number().int().min(1024).max(65535) })
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULTS: Settings = {
  version: 1,
  theme: 'default',
  general: { language: 'en', welcomed: false, tipsSeen: [], startWithWindows: false, icon: 'lavender', updates: true, toggleShortcut: 'Control+Alt+P', tuckShortcut: 'Control+Alt+H', buddyShortcut: 'Control+Alt+B', voiceShortcut: 'Control+Alt+Space', micShortcut: 'Control+Alt+M' },
  island: {
    style: 'notch', openOn: 'hover', display: 'main',
    restingWidth: 180, restingHeight: 32, width: 340, height: 36, askWidth: 460, openWidth: 680,
    offsetTop: 8, seeThrough: 0, gameMode: true, gameStrip: false, skins: true, compact: 'detailed', chips: { left: 'none', right: 'none' }, hiddenPages: []
  },
  music: { enabled: true, lyrics: true, focusSound: 'off' },
  clipboard: { enabled: true },
  screenTime: { enabled: true },
  wellness: { water: false, waterMinutes: 60, stand: false, standMinutes: 45, from: 9, to: 21 },
  prayer: { enabled: false, city: '', lat: null, lng: null, method: 'MuslimWorldLeague', madhab: 'shafi', notify: true, pauseMusic: true },
  focusGuard: { enabled: false, sites: ['youtube', 'tiktok', 'instagram', 'reddit', 'netflix', 'twitch', 'facebook'], snoozeMinutes: 5 },
  pip: { name: 'Pip', outfit: 'auto', followMouse: true, look: 'theme', body: '#ece9f6', visor: '#15151c', sleepAfterMinutes: 10 },
  motion: { mode: 'system', speed: 1 },
  agents: {
    claude: { enabled: true, answerPermissions: true }, codex: { enabled: true }, gemini: { enabled: true },
    cursor: { enabled: true }, opencode: { enabled: true }, aider: { enabled: true }, dsh: { enabled: true }
  },
  terminals: { minSeconds: 10 },
  features: { sound: true, toasts: true, peeks: true, usageAlerts: true, notify: { asks: true, done: true, connectors: true, extras: true }, rest: { away: true, games: true, battery: true }, doneSeconds: 8 },
  chat: { provider: 'claude-cli', model: '', readAloud: false },
  chatApps: { desktop: [] },
  server: { port: 47901 }
}

// Theme files: every token becomes a CSS variable (--background, --font-size, …); numbers are px.
export const themeSchema = z.object({
  name: z.string(),
  tokens: z.object({
    background: z.string(),
    text: z.string(),
    muted: z.string(),
    accent: z.string(),
    onAccent: z.string().default('#ffffff'), // text on accent buttons
    pipBody: z.string().default('#ece9f6'), // Pip's pebble
    pipVisor: z.string().default('#15151c'), // the band his eyes sit in
    ready: z.string(),
    running: z.string(),
    done: z.string(),
    error: z.string(),
    question: z.string(),
    // optional: the shared layers (app/renderer/tokens.css works them out from `text` and `accent` otherwise)
    surface1: z.string().optional(),
    surface2: z.string().optional(),
    surface3: z.string().optional(),
    stroke: z.string().optional(),
    accentText: z.string().optional(),
    radius: z.number(),
    font: z.string(),
    fontSize: z.number()
  })
})

export type Theme = z.infer<typeof themeSchema>

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Deep-merges b over a (objects only; arrays and values from b replace). */
export function merge<T>(a: T, b: unknown): T {
  if (!isObject(a) || !isObject(b)) return (b === undefined ? a : b) as T
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = merge(out[k], v)
  return out as T
}

/** User JSON → valid settings, or the list of problems ("island.width: Too big…"). */
export function parseSettings(user: unknown): { ok: true; value: Settings } | { ok: false; problems: string[] } {
  const r = settingsSchema.safeParse(merge(DEFAULTS, user))
  return r.success ? { ok: true, value: r.data } : { ok: false, problems: r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }
}
