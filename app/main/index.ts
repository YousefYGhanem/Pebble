import fs from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, nativeImage, Notification, powerMonitor, safeStorage, screen, shell, utilityProcess } from 'electron'
import { CH, type Answer, type IslandState, type Usage } from '../shared/ipc'
import { SCENES, type Scene } from '../shared/island'
import { AGENT_NAMES, type Agent, type Session } from '../shared/state'
import { initLog, logger } from './log'
import { Store } from './store'
import { Hub, loadToken } from './agents/hub'
import * as claude from './agents/claude'
import { adapters, type Adapter } from './agents/registry'
import * as terminals from './agents/terminals'
import { createIsland, islandDisplay, placeIsland } from './island'
import { FullscreenWatch } from './fullscreen'
import { Native, nativeExe } from './native'
import { History } from './history'
import { Today } from './today'
import { restLevel, type RestLevel } from './rest'
import { emptyDay, usageAlerts } from '../shared/today'
import { PipStore } from './pip'
import { ACHIEVEMENTS, wearable } from '../shared/pip'
import { buildTray } from './tray'
import { SettingsWindow } from './settings-window'
import { Extras, validAction } from './extras'
import { DropServer } from './extras/drop'
import { allowInFirewall, checkReach } from './extras/reach'
import { FocusGuard, guardPage, guardPreload } from './extras/guard'
import type { ExtrasState } from '../shared/extras'
import { sharedSpawner, type Child } from './connectors/shared'
import { ConnectorHost } from './connectors/host'
import { describePermissions } from '../shared/connectors'
import { translate, translateOr } from '../shared/i18n'
import { Chat } from './ai/chat'
import { diagnose } from './diagnostics'
import { Updater } from './updater'
import { DshWatch, use as useDsh } from './agents/dsh'
import { readCodexUsage } from './agents/codex-usage'
import { applyWord, FIX_PROMPT, parseFixes, readWord } from './ai/word'
import { ChatApps, loadExtensionKey } from './chatapps'
import { PROVIDERS, type ProviderId } from '../shared/chat'

app.setName('Pebble')
app.setAppUserModelId('dev.pebble.app') // Windows shows "Pebble" on its notifications
const userData = app.getPath('userData')
const logFile = initLog(path.join(userData, 'logs'))
const log = logger('app')

// `Pebble.exe --quit`: ends the running Pebble (through its single-instance lock) and never starts one itself.
if (process.argv.includes('--quit')) { app.requestSingleInstanceLock(); app.exit(0) }

// `electron . --remove-hooks` (or Pebble.exe --remove-hooks; the uninstaller runs it): take Pebble out of every agent and
// shell, stop starting with Windows, and quit. Your settings in userData stay.
if (process.argv.includes('--remove-hooks')) {
  for (const a of adapters({ port: 0, token: '', nativeExe: '' })) try { a.remove() } catch (err) { log.error(a.name, err) }
  const docs = app.getPath('documents')
  for (const sh of terminals.shells(docs)) try { terminals.remove(sh, docs) } catch (err) { log.error(sh, err) }
  app.setLoginItemSettings({ openAtLogin: false })
  log.info('Pebble removed from every agent and shell')
  app.exit(0)
}

// `electron . --capture=<folder>`: renders every test scene off-screen into <folder>/<scene>.png and quits.
// Nothing shows on screen, no hooks are installed and no server starts (screenshot checks, docs).
const captureDir = process.argv.find(a => a.startsWith('--capture='))?.slice(10)
if (captureDir) {
  app.whenReady().then(async () => {
    const win = createIsland(store.settings, true)
    ipcMain.on(CH.ready, () => win.webContents.send(CH.state, { sessions: [], settings: store.settings, theme: store.theme, usage: { claude: { fiveHour: { used: 64, resetsAt: 0 }, sevenDay: { used: 22, resetsAt: 0 } } }, widgets: [], connectors: [], history: [], pip: { done: 12, achievements: [], custom: [], sleepy: false, playing: false }, extras: NO_EXTRAS, chat: { provider: 'Claude Code', ready: true, messages: [], busy: false }, day: { today: { ...emptyDay(Date.now()), tasks: 6, seconds: 5400, files: 14, agents: { claude: { tasks: 6, seconds: 5400 } }, spent: { claude: { unit: '%', base: 20, prev: 31, acc: 0 } } }, yesterday: null } } satisfies IslandState))
    await new Promise<void>(r => win.webContents.once('did-finish-load', () => r()))
    await new Promise(r => setTimeout(r, 1500)) // hello
    fs.mkdirSync(captureDir, { recursive: true })
    for (const s of Object.keys(SCENES)) {
      if (s === 'bye' || s === 'hello' || s === 'jelly') continue
      win.webContents.send(CH.scene, s)
      await new Promise(r => setTimeout(r, 1400))
      fs.writeFileSync(path.join(captureDir, `${s}.png`), (await win.webContents.capturePage()).toPNG())
    }
    const gallery = new BrowserWindow({ width: 720, height: 360, show: false, webPreferences: { offscreen: true } })
    await gallery.loadFile(path.join(__dirname, '../renderer/pip-gallery/index.html'))
    await new Promise(r => setTimeout(r, 500))
    fs.writeFileSync(path.join(captureDir, 'pip-gallery.png'), (await gallery.webContents.capturePage()).toPNG())
    const settings = settingsWin.open(true)
    await new Promise(r => setTimeout(r, 1500))
    fs.writeFileSync(path.join(captureDir, 'settings.png'), (await settings.webContents.capturePage()).toPNG())
    const welcome = settingsWin.openWelcome(true)
    await new Promise(r => setTimeout(r, 1500))
    fs.writeFileSync(path.join(captureDir, 'welcome.png'), (await welcome.webContents.capturePage()).toPNG())
    app.exit(0)
  })
} else if (!app.requestSingleInstanceLock()) app.exit(0)

/** secrets on this PC, encrypted for your Windows account (DPAPI) */
const vault = {
  encrypt: (v: string) => safeStorage.encryptString(v).toString('base64'),
  decrypt: (v: string) => safeStorage.decryptString(Buffer.from(v, 'base64'))
}

/** Pebble's icons (build/icons, made by npm run icon): next to the app once installed. */
const iconFile = (name: string) => app.isPackaged ? path.join(process.resourcesPath, 'icons', name) : path.join(app.getAppPath(), 'build', 'icons', name)

const NO_EXTRAS: ExtrasState = { media: null, art: null, lyrics: null, shelf: [], clipboard: [], notes: [], focus: null, system: { cpu: 0, ram: 0 }, radios: null, drop: null, volume: null }

let island: BrowserWindow | undefined
let scene: Scene | null = null
const store = new Store(userData)
const token = loadToken(userData)
const chat = new Chat(userData, vault, () => ({ ...store.settings.chat, name: store.settings.pip.name }))
const hub = new Hub(token, {
  answerPermissions: () => store.settings.agents.claude.answerPermissions,
  webhook: (plugin, key, body) => connectors.deliver(plugin, key, body),
  extension: (key, body): unknown => chatApps.fromExtension(key, body)
})
// Connectors (docs/PLUGINS.md): built-in ones next to the app (sharing one process), yours in userData/plugins (one each)
const connectors = new ConnectorHost({
  dataDir: userData,
  builtInDir: app.isPackaged ? path.join(process.resourcesPath, 'plugins') : path.join(app.getAppPath(), 'plugins'),
  spawn: sharedSpawner(() => utilityProcess.fork(path.join(__dirname, 'connector-runner.js'), [], { serviceName: 'Pebble connector', stdio: 'ignore' }) as unknown as Child),
  vault,
  approve: async m => {
    const r = await dialog.showMessageBox({
      type: 'question', title: 'Pebble', buttons: ['Allow', 'Do not allow'], defaultId: 1, cancelId: 1, noLink: true,
      message: `Allow the connector "${m.name}"?`,
      detail: `${m.description}\n\nIt may:\n• ${describePermissions(m).join('\n• ')}\n\nOnly allow connectors you trust: a connector runs code on this PC.`
    })
    return r.response === 0
  },
  windows: () => native.request('windows.list')
})
const history = new History(userData)
const today = new Today(userData)
const pip = new PipStore(userData)
let sleepy = false
const native = new Native(nativeExe(app.getAppPath(), app.isPackaged))
const extras = new Extras(userData, native, () => store.settings)
const extensionKey = loadExtensionKey(userData)
/** words for the tray and notifications, in your language */
const tr = (key: string, vars?: Record<string, string | number>) => translate(store.settings.general.language, key, vars)
const extensionDir = app.isPackaged ? path.join(process.resourcesPath, 'extensions', 'chat') : path.join(app.getAppPath(), 'extensions', 'chat')
// DeepSeek Harness: followed through its session logs (switched on and off like the other agents)
useDsh(new DshWatch({ event: e => hub.ingest(e, 'dsh'), usage: u => hub.setUsage('dsh', u) }))
const chatApps = new ChatApps(hub, extensionKey, { native, followed: () => store.settings.chatApps.desktop, problem: (title, body) => toast(title, body) })
const drop = new DropServer(() => extras.state.shelf, app.getPath('downloads'))
const guard = new FocusGuard(native, () => store.settings, () => !!extras.state.focus && extras.state.focus.left === undefined, guardPreload(), guardPage)
const fullscreen = new FullscreenWatch(native)
const agents = () => adapters({ port: store.settings.server.port, token, nativeExe: nativeExe(app.getAppPath(), app.isPackaged) })
const documents = () => app.getPath('documents')
let shownAnyway = false // you opened the island yourself while a game runs: it stays until the game ends

const fromIsland = (e: Electron.IpcMainEvent) => !!island && !island.isDestroyed() && e.sender === island.webContents
const send = (channel: string, ...args: unknown[]) => { if (island && !island.isDestroyed()) island.webContents.send(channel, ...args) }

// coalesced (a burst of changes is one message) and skipped when nothing changed: each state the island gets is a
// clone, a re-render and a frame
let pushTimer: NodeJS.Timeout | undefined, lastState = ''
function push(force = false) {
  if (force) lastState = ''
  pushTimer ??= setTimeout(sendState, 40) // also paces a streaming chat reply
}
function sendState() {
  pushTimer = undefined
  const state: IslandState = { sessions: hub.list(), settings: store.settings, theme: store.theme, usage: hub.usage, history: history.items,
    pip: { done: pip.stats.done, achievements: pip.stats.achievements, custom: pip.custom, sleepy, playing: !!extras.state.media?.playing },
    extras: { ...extras.state, drop: drop.state },
    widgets: [...connectors.widgets.values()], connectors: connectors.list(), chat: chat.state(), day: today.view() }
  const json = JSON.stringify(state)
  if (json === lastState) return
  lastState = json
  send(CH.state, state)
}

// Windows notifications; a click opens the island on that session. Kept referenced until closed (a collected
// notification loses its click handler).
const toasts = new Set<Notification>()
function toast(title: string, body: string, sessionId?: string, link?: string) {
  if (!store.settings.features.toasts || !Notification.isSupported()) return
  const n = new Notification({ title, body: body.slice(0, 200), silent: true }) // the island makes its own sound
  toasts.add(n)
  n.on('click', () => { if (link && /^https?:\/\//.test(link)) void shell.openExternal(link); else { bringBack(); send(CH.expand, sessionId) } })
  n.on('close', () => toasts.delete(n))
  n.show()
}

const agentName = (s: Session) => (s.agent === 'cli' ? s.project : AGENT_NAMES[s.agent]) + (s.provider ? ` (${s.provider})` : '')

/** Game mode: hidden while something covers the island's screen, unless you brought it back yourself. */
function updateVisibility() {
  if (!island) return
  const hide = store.settings.island.gameMode && fullscreen.current === islandDisplay(store.settings).id && !shownAnyway
  if (hide && island.isVisible()) island.hide()
  if (!hide && !island.isVisible()) island.showInactive()
}

/** The island is on screen, neither tucked away nor hidden by game mode: what it shows needs no Windows notification. */
const islandSeen = () => !!island && island.isVisible() && !tucked

// "done" notifications only when the island is out of sight; several within 3 s become one
let doneBatch: Session[] = [], doneTimer: NodeJS.Timeout | undefined
function toastDone(s: Session) {
  if (islandSeen()) return
  doneBatch.push(s)
  doneTimer ??= setTimeout(() => {
    const b = doneBatch
    doneBatch = []; doneTimer = undefined
    if (b.length === 1) toast(tr('m.isDone', { agent: agentName(b[0]!), project: b[0]!.project }), b[0]!.message?.split('\n')[0] || b[0]!.detail, b[0]!.id)
    else toast(tr('m.manyDone', { n: b.length }), b.map(x => `${agentName(x)} · ${x.project}`).join('\n'), b[0]!.id)
  }, 3000)
}

function bringBack() {
  if (island && !island.isVisible()) { shownAnyway = true; updateVisibility() }
}

/** Phone drop: is this network Private, and does the firewall let Pebble in? (Windows blocks the phone otherwise.) */
async function checkDrop() {
  const r = await checkReach(process.execPath).catch(() => null)
  if (!r) return
  drop.setBlocked(r.profile === 'Public' ? 'public' : r.allowed ? undefined : 'firewall')
  log.info(`phone drop: network ${r.profile}, firewall ${r.allowed ? 'allows' : 'has no rule for'} ${path.basename(process.execPath)}`)
}

function toggleIsland() { bringBack(); island?.focus(); send(CH.toggle) } // the keyboard comes along (Esc gives it back)
/** Opens the island on a page, with the keyboard (listen: start voice typing in its message box). */
function showPage(page: string, listen = false) { bringBack(); island?.focus(); send(CH.page, page, listen) }

/** Screen buddy: shows Pip a window. Its picture (and the text OCR reads on it) goes with your next chat message. */
async function look(w: { hwnd: number; pid?: number; title?: string; process?: string } | null) {
  if (!w?.hwnd) { chat.attach(undefined); return }
  const image = `look-${Date.now()}.png`, file = path.join(chat.folder, image)
  const hide = !!island?.isVisible()
  try {
    if (w.pid) { await native.request('window.focus', { hwnd: w.hwnd, pid: w.pid }); await new Promise(r => setTimeout(r, 250)) }
    if (hide) { island!.hide(); await new Promise(r => setTimeout(r, 120)) } // the island is not part of the picture
    await native.request('window.capture', { hwnd: w.hwnd, file })
  } catch (err) { toast(tr('m.couldNotLook', { name: store.settings.pip.name }), (err as Error).message); return }
  finally { if (hide) island!.showInactive() }
  // big screens: at most 1568 px on the long side (what vision models take in without shrinking it themselves)
  const img = nativeImage.createFromPath(file), { width, height } = img.getSize()
  if (Math.max(width, height) > 1568) fs.writeFileSync(file, (width >= height ? img.resize({ width: 1568 }) : img.resize({ height: 1568 })).toPNG())
  const text = await native.request<string>('ocr.file', { file }).catch(() => '')
  chat.attach({ title: w.title ?? '', process: w.process ?? '', image, text })
}

async function buddy() {
  const p = screen.dipToScreenPoint(screen.getCursorScreenPoint())
  const w = await native.request<{ hwnd: number; title: string; process: string } | null>('window.fromPoint', { x: Math.round(p.x), y: Math.round(p.y) }).catch(() => null)
  if (!w) { toast(tr('m.buddy'), tr('m.buddyHint')); return }
  await look(w)
  showPage('chat')
}

/** Reads text aloud with Windows' voices (the island plays it). */
async function say(text: string) {
  const file = path.join(chat.folder, 'say.wav')
  const plain = text.replace(/```[\s\S]*?```/g, ' (code) ').replace(/[`*_#>|]/g, '').slice(0, 5000)
  try {
    await native.request('speech.say', { text: plain, file })
    send(CH.play, `data:audio/wav;base64,${fs.readFileSync(file).toString('base64')}`)
  } catch (err) {
    log.warn('say:', (err as Error).message)
    send(CH.play, null)
    toast(tr('m.speechFailed'), tr('m.speechFailedBody'))
  }
}
function toggleTuck() { bringBack(); send(CH.tuck) }

function connected(a: Adapter) {
  try { return a.installed() } catch (err) { log.error(a.name, err); return false }
}

function setConnected(a: Adapter, on: boolean) {
  try {
    if (!on) a.remove()
    else if (a.install() === false) log.info(`${a.name}: you set this up yourself, Pebble leaves it alone`)
    log.info(`${a.name} ${on ? 'connected' : 'disconnected'}`)
  } catch (err) { log.error(`${a.name}:`, err) }
  store.update({ agents: { [a.id]: { enabled: on } } }) // remembered: an agent you switched off stays off
  refreshTray()
}

function setTerminal(sh: terminals.Shell, on: boolean) {
  try {
    on ? terminals.install(sh, { nativeExe: nativeExe(app.getAppPath(), app.isPackaged), minSeconds: store.settings.terminals.minSeconds }, documents()) : terminals.remove(sh, documents())
    log.info(`terminal ${sh}: ${on ? 'added' : 'removed'} (open a new terminal)`)
  } catch (err) { log.error(`terminal ${sh}:`, err) }
  refreshTray()
}

const shortcuts: Record<string, string> = {}
function bindShortcut(name: string, keys: string, fn: () => void) {
  if (shortcuts[name] === keys) return
  if (shortcuts[name]) globalShortcut.unregister(shortcuts[name]!)
  shortcuts[name] = keys
  if (keys && !globalShortcut.register(keys, fn)) log.warn(`shortcut ${keys} is taken by another app`)
}

function applySettings() {
  const s = store.settings
  app.setLoginItemSettings({
    openAtLogin: s.general.startWithWindows,
    // during development Pebble runs as "electron.exe <folder>": pass the folder along
    args: app.isPackaged ? [] : [app.getAppPath()]
  })
  bindShortcut('toggle', s.general.toggleShortcut, toggleIsland)
  bindShortcut('tuck', s.general.tuckShortcut, toggleTuck)
  bindShortcut('buddy', s.general.buddyShortcut, () => void buddy())
  bindShortcut('voice', s.general.voiceShortcut, () => showPage('chat', true))
  chatApps.apply()
  updater.apply()
  if (island) placeIsland(island, s)
  s.island.gameMode ? fullscreen.start() : fullscreen.stop()
  extras.applySettings()
  guard.apply()
  updateVisibility()
  applyRest()
}

// ---------- resting: away, a full-screen game, on battery (settings: features.rest) ----------
let onBattery = false, tucked = false, rest: RestLevel = 'awake'
function applyRest() {
  const level = restLevel({ away: sleepy, game: fullscreen.current !== null, battery: onBattery, tucked }, store.settings.features.rest)
  if (level === rest) return
  rest = level
  log.info(`tools ${level === 'awake' ? 'awake' : `resting (${level})`}`)
  extras.setRest(level)
  connectors.pause(level !== 'awake')
}

// ---------- usage alerts: 80% and 95% of a CLI's session or week ----------
function usageAlert(agent: Agent, prev: Usage | undefined, next: Usage) {
  if (!store.settings.features.usageAlerts) return
  for (const a of usageAlerts(prev, next)) {
    const lang = store.settings.general.language
    const at = new Date(a.resetsAt)
    const when = a.window === 'fiveHour' ? at.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
      : at.toLocaleString(lang, { weekday: 'long', hour: '2-digit', minute: '2-digit' })
    toast(tr(a.window === 'fiveHour' ? 'm.usageSession' : 'm.usageWeek', { agent: AGENT_NAMES[agent], n: a.level }), a.resetsAt ? tr('m.usageResets', { when }) : '')
    send(CH.worry)
  }
}

function playScene(s: Scene | null) {
  scene = s
  bringBack()
  send(CH.scene, s)
  refreshTray()
}

const updater = new Updater(() => store.settings.general.updates)

const settingsWin = new SettingsWindow({
  view: () => ({
    version: app.getVersion(),
    settings: store.settings,
    theme: store.theme,
    themes: Object.entries(store.themes()).map(([id, t]) => ({ id, name: t.name })),
    displays: screen.getAllDisplays().map((d, i) => ({ id: d.id, label: d.label || `Screen ${i + 1} (${d.size.width}×${d.size.height})` })),
    agents: agents().map(a => ({ id: a.id, name: a.name, available: a.available(), connected: connected(a) })),
    terminals: terminals.shells(documents()).map(sh => ({ id: sh, on: terminals.installed(sh, documents()) })),
    connectors: connectors.list().map(c => ({ ...c, webhook: connectors.webhookUrl(c.id, store.settings.server.port), fields: connectors.fields(c.id) })),
    chipWidgets: [...connectors.widgets.values()].filter(w => w.kind === 'chip').map(w => ({ id: `widget:${w.plugin}/${w.id}`, label: `${w.plugin}: ${w.text}` })),
    pip: { done: pip.stats.done, wearable: wearable(pip.stats.done, new Date()), custom: pip.custom.map(c => c.id) },
    chatKeys: Object.fromEntries(PROVIDERS.filter(p => p.key).map(p => [p.id, chat.hasKey(p.id)])),
    extension: { key: extensionKey, folder: extensionDir, port: store.settings.server.port },
    update: updater.status,
    scene
  }),
  update: patch => { try { store.update(patch) } catch (err) { return (err as Error).message } },
  editTheme: tokens => { try { store.editTheme(tokens) } catch (err) { return (err as Error).message } },
  toggleAgent: id => { const a = agents().find(x => x.id === id); if (a) setConnected(a, !connected(a)) },
  toggleTerminal: id => { const sh = terminals.shells(documents()).find(x => x === id); if (sh) setTerminal(sh, !terminals.installed(sh, documents())) },
  toggleConnector: id => connectors.setEnabled(id, !connectors.list().find(c => c.id === id)?.enabled),
  setConnector: (id, key, value) => connectors.setSetting(id, key, value),
  webhook: id => connectors.webhookUrl(id, store.settings.server.port),
  paths: { settings: store.file, themes: store.themesDir, log: logFile, connectors: connectors.configFile, plugins: connectors.userDir, outfits: pip.outfitsDir, extension: extensionDir },
  clearHistory: () => { history.clear(); push() },
  playScene,
  setChatKey: (p, key) => chat.setKey(p as ProviderId, key),
  icon: () => iconFile(`${store.settings.general.icon}.ico`),
  updates: updater,
  chatModels: () => ({ provider: store.settings.chat.provider, list: chat.models() }),
  diagnose: () => diagnose({
    version: app.getVersion(), port: store.settings.server.port, nativeExe: nativeExe(app.getAppPath(), app.isPackaged),
    agents: agents().map(a => ({ name: a.name, available: a.available(), connected: connected(a) })),
    connectors: connectors.list(), chat: chat.state(), extensionSeen: chatApps.seen,
    cli: store.settings.chat.provider === 'claude-cli' ? ['claude'] : store.settings.chat.provider === 'codex-cli' ? ['codex'] : []
  })
})

/** Call after anything the tray or the Settings window shows has changed. */
function refreshTray() {
  const u = updater.status
  buildTray({ toggleIsland, toggleTuck, openSettings: () => settingsWin.open(), t: tr, update: u.state === 'ready' ? { version: u.version, install: () => updater.install() } : undefined }, iconFile(`${store.settings.general.icon}-tray.ico`))
  settingsWin.push()
}

ipcMain.on(CH.ready, e => { if (fromIsland(e)) { push(true); if (scene) send(CH.scene, scene) } })
ipcMain.on(CH.release, e => { if (fromIsland(e) && island?.isFocused()) island.blur() })
ipcMain.on(CH.tucked, (e, on: unknown) => { if (fromIsland(e)) { tucked = on === true; applyRest() } })
ipcMain.on(CH.catchMouse, (e, on: unknown) => {
  if (fromIsland(e)) island!.setIgnoreMouseEvents(on !== true, { forward: true })
})
/** Only well-formed answers from the island reach an agent. */
function validAnswer(a: unknown): a is Answer {
  const o = a as Record<string, unknown>
  if (!o || typeof o !== 'object') return false
  if (o.kind === 'permission') return o.choice === 'allow' || o.choice === 'always' || o.choice === 'deny'
  if (o.kind === 'question') return !!o.answers && typeof o.answers === 'object' && Object.values(o.answers).every(v => typeof v === 'string')
  if (o.kind === 'plan') return typeof o.approve === 'boolean' && (o.feedback === undefined || typeof o.feedback === 'string')
  return false
}

ipcMain.on(CH.answer, (e, id: unknown, a: unknown) => {
  if (fromIsland(e) && typeof id === 'string' && validAnswer(a) && !hub.answer(id, a)) log.info('that question was already answered elsewhere')
})
ipcMain.on(CH.reply, (e, id: unknown, text: unknown) => {
  if (fromIsland(e) && typeof id === 'string' && typeof text === 'string') hub.reply(id, text.slice(0, 20000))
})
ipcMain.on(CH.jump, (e, id: unknown) => {
  if (!fromIsland(e) || typeof id !== 'string') return
  const s = hub.sessions.get(id)
  if (!s?.windowPid) return
  native.request('window.focus', { pid: s.windowPid, hwnd: s.windowHandle ?? 0 }).catch(err => log.warn('jump:', err.message))
  // in VS Code or Cursor, Pebble's extension also shows the exact terminal tab (the one whose shell runs the agent)
  const scheme = editorScheme(s.windowProcess)
  if (scheme && s.pidChain?.length && editorExtension(scheme)) shell.openExternal(`${scheme}://pebble.pebble/focus?pids=${s.pidChain.join(',')}`)
})

/** The URL scheme of the editor that runs a session (VS Code, Insiders, Cursor), or null. */
function editorScheme(process?: string): string | null {
  if (!process) return null
  if (/^code$/i.test(process)) return 'vscode'
  if (/^code - insiders$/i.test(process)) return 'vscode-insiders'
  if (/^cursor$/i.test(process)) return 'cursor'
  return null
}

/** Pebble's extension is installed in that editor (else opening its URL would only show an error there). */
function editorExtension(scheme: string): boolean {
  const dir = path.join(app.getPath('home'), scheme === 'cursor' ? '.cursor' : scheme === 'vscode-insiders' ? '.vscode-insiders' : '.vscode', 'extensions')
  try { return fs.readdirSync(dir).some(n => n.toLowerCase().startsWith('pebble.pebble-')) } catch { return false }
}
ipcMain.on(CH.seen, (e, ids: unknown) => {
  if (fromIsland(e) && Array.isArray(ids)) hub.seen(ids.filter((x): x is string => typeof x === 'string'))
})
ipcMain.on(CH.dismiss, (e, id: unknown) => {
  if (fromIsland(e) && typeof id === 'string') hub.dismiss(id)
})
ipcMain.on(CH.act, (e, a: unknown) => {
  if (!fromIsland(e) || !validAction(a)) return
  if (a.do === 'drop.start') {
    drop.start().then(checkDrop).catch(err => { log.warn('phone drop:', err.message); toast(tr('m.drop'), err.message) })
    return
  }
  if (a.do === 'drop.allow') {
    allowInFirewall(process.execPath)
    // look again for a minute: the rule is there once you said yes to Windows' prompt
    let tries = 0
    const again = setInterval(() => { void checkDrop(); if (++tries >= 20 || !drop.state?.blocked) clearInterval(again) }, 3000)
    return
  }
  if (a.do === 'drop.network') { void shell.openExternal('ms-settings:network-status'); return }
  if (a.do === 'drop.stop') { drop.stop(); return }
  if (a.do === 'settings.open') { settingsWin.open(); return }
  if (a.do === 'chat.send') { void chat.send(a.text); return }
  if (a.do === 'chat.stop') { chat.stop(); return }
  if (a.do === 'chat.clear') { chat.clear(); return }
  if (a.do === 'chat.signIn') {
    // its own sign-in, in a console window you can see (it opens the browser to log in)
    const cmd = store.settings.chat.provider === 'codex-cli' ? 'codex login' : 'claude auth login'
    spawn('cmd.exe', ['/c', `start "Sign in" cmd.exe /k ${cmd}`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref()
    return
  }
  if (a.do === 'chat.windows') {
    native.request<{ hwnd: number; pid: number; title: string; process: string }[]>('windows.list')
      .then(ws => chat.pick(ws.filter(w => w.pid !== process.pid).slice(0, 20).map(({ hwnd, title, process }) => ({ hwnd, title, process }))))
      .catch(err => log.warn('windows:', err.message))
    return
  }
  if (a.do === 'chat.look') {
    if (!a.hwnd) { chat.attach(undefined); return }
    native.request<{ hwnd: number; pid: number; title: string; process: string }[]>('windows.list')
      .then(ws => look(ws.find(w => w.hwnd === a.hwnd) ?? null)).then(() => showPage('chat')).catch(() => {})
    return
  }
  if (a.do === 'word.close') { chat.setWord(undefined); return }
  if (a.do === 'word.check') {
    chat.setWord({ doc: '', fixes: [], busy: true })
    void (async () => {
      try {
        const d = await readWord()
        chat.setWord({ doc: d.name, fixes: [], busy: true })
        chat.setWord({ doc: d.name, fixes: parseFixes(await chat.complete(FIX_PROMPT, d.text), d.text), busy: false })
      } catch (err) { chat.setWord({ doc: chat.word?.doc ?? '', fixes: [], busy: false, error: (err as Error).message }) }
    })()
    return
  }
  if (a.do === 'word.apply') {
    const w = chat.word
    if (!w || w.busy) return
    const picked = a.picks.map(i => w.fixes[i]).filter(f => !!f)
    chat.setWord({ ...w, busy: true })
    applyWord(picked)
      .then(r => chat.setWord({ ...w, busy: false, fixes: [], done: `${r.applied} put in as tracked changes${r.missed ? `, ${r.missed} not found (the text changed)` : ''}` }))
      .catch(err => chat.setWord({ ...w, busy: false, error: (err as Error).message }))
    return
  }
  if (a.do === 'chat.dictate') { native.request('input.dictate').catch(err => log.warn('dictate:', err.message)); return }
  if (a.do === 'chat.say') { const m = chat.messages.find(x => x.at === a.at && x.role === 'assistant'); if (m) void say(m.text); else send(CH.play, null); return }
  if (a.do === 'widget.open') {
    const link = connectors.widgets.get(`${a.plugin}/${a.id}`)?.link
    if (link && /^https?:\/\//.test(link)) void shell.openExternal(link)
    return
  }
  if (a.do === 'shelf.drag') {
    // dragging a file out of the island into another app
    const f = extras.state.shelf.find(x => x.path === a.path)
    if (f && fs.existsSync(f.path)) e.sender.startDrag({ file: f.path, icon: f.icon ? nativeImage.createFromDataURL(f.icon).resize({ width: 48 }) : nativeImage.createEmpty() })
    return
  }
  extras.act(a).catch(err => log.warn(`${a.do}:`, (err as Error).message))
})

// Dropping files on the island: the window lets clicks through, so Windows would give the drop to the app below. While
// you drag (left button down) over the island's area, the window catches the mouse so it receives the drop.
let catchingDrag = false
native.on('drag', (c: { x: number; y: number } | null) => {
  if (!island || island.isDestroyed()) return
  const b = island.getBounds()
  const p = c ? screen.screenToDipPoint({ x: c.x, y: c.y }) : null
  const over = !!p && p.y >= b.y && p.y <= b.y + 90 && Math.abs(p.x - (b.x + b.width / 2)) <= 260
  if (over !== catchingDrag) { catchingDrag = over; island.setIgnoreMouseEvents(!over, { forward: true }) }
})

// Goodbye: the island plays its closing animation before Pebble really quits (at most 1.5 s).
let leaving = false
app.on('before-quit', e => {
  if (leaving || !island || island.isDestroyed() || !island.isVisible()) return
  e.preventDefault()
  leaving = true
  const done = () => { clearTimeout(timer); ipcMain.removeListener(CH.byeDone, done); app.quit() }
  const timer = setTimeout(done, 1500)
  ipcMain.once(CH.byeDone, done)
  send(CH.bye)
})

// Starting Pebble again opens the island. `--scene=<name>` (or --scene=off) plays a test scene instead;
// `--settings` opens Settings; `--quit` ends the running Pebble (the uninstaller and tests use it).
app.on('second-instance', (_e, argv) => {
  if (argv.includes('--quit')) { app.quit(); return }
  if (argv.includes('--settings')) { settingsWin.open(); return }
  if (argv.includes('--welcome')) { settingsWin.openWelcome(); return }
  const arg = argv.find(a => a.startsWith('--scene='))?.slice(8)
  if (arg === undefined) toggleIsland()
  else playScene(arg in SCENES ? (arg as Scene) : null)
})
app.on('window-all-closed', () => {}) // the island lives in the tray; only Quit ends Pebble
app.on('will-quit', () => { hub.close(); drop.stop(); connectors.stopAll(); fullscreen.stop(); native.stop(); globalShortcut.unregisterAll() })

app.whenReady().then(async () => {
  if (captureDir) return
  native.start()
  // Pip dances while music plays, and falls asleep when you are away
  extras.start()
  native.watch('drag', true, 'drop-target')
  extras.on('change', () => { push(); guard.apply() }) // the focus timer started, paused or ended
  extras.on('peak', (p: number) => send(CH.peak, p))
  extras.on('focus-done', (seconds: number) => toast(tr('m.focusOver'), tr('m.focusOverBody', { n: Math.round(seconds / 60) })))
  drop.on('change', push)
  // an answer streams in many small pieces: show them at most ~20 times a second
  chat.on('answered', (text: string) => { if (store.settings.chat.readAloud) void say(text) })
  chat.on('change', () => { settingsWin.push(); push() })
  connectors.discover()
  connectors.loadConfig()
  void connectors.startAll()
  connectors.on('change', () => { push(); refreshTray() })
  connectors.on('notify', (n: { title: string; body: string; link?: string }) => toast(n.title, n.body, undefined, n.link))
  // your edits to connectors.json apply right away (a secret you typed in moves to encrypted storage)
  let connectorsTimer: NodeJS.Timeout | undefined
  fs.watch(userData, (_e, name) => { if (name === 'connectors.json') { clearTimeout(connectorsTimer); connectorsTimer = setTimeout(() => void connectors.reload(), 300) } })
  fs.watch(connectors.userDir, () => { clearTimeout(connectorsTimer); connectorsTimer = setTimeout(() => { connectors.discover(); void connectors.reload(); refreshTray() }, 500) })
  drop.on('received', (paths: string[]) => { void extras.shelve(paths); toast(tr('m.fromPhone'), paths.map(p => path.basename(p)).join(', ')) })
  setInterval(() => {
    const now = powerMonitor.getSystemIdleTime() >= store.settings.pip.sleepAfterMinutes * 60
    if (now !== sleepy) { sleepy = now; push(); applyRest() }
  }, 20_000).unref()
  // your own outfits: dropping an SVG in the folder shows it right away
  try { fs.watch(pip.outfitsDir, () => { pip.loadOutfits(); refreshTray(); push() }) } catch {}
  log.info(`Pebble ${app.getVersion()} starting, data in ${userData}`)
  try { await hub.listen(store.settings.server.port) }
  catch (err) { log.error(`port ${store.settings.server.port} is in use; agents cannot reach Pebble`, err) }
  // connect every agent found on this PC that you have not switched off (and bring older installs up to date)
  for (const a of agents()) if (store.settings.agents[a.id].enabled && a.available() && !connected(a)) setConnected(a, true)

  island = createIsland(store.settings)
  island.once('ready-to-show', () => { placeIsland(island!, store.settings); island!.showInactive() })
  // the screen was plugged in or out, or its size or scale changed
  for (const ev of ['display-added', 'display-removed', 'display-metrics-changed'] as const) {
    screen.on(ev as 'display-added', () => { if (island) placeIsland(island, store.settings); refreshTray() })
  }
  hub.on('change', push)
  // Codex's plan usage, from its newest session file
  let codexUsage = ''
  setInterval(() => {
    if (!store.settings.agents.codex.enabled) return
    const u = readCodexUsage(), key = JSON.stringify(u)
    if (u && key !== codexUsage) { codexUsage = key; hub.setUsage('codex', u) }
  }, 30_000).unref()
  // an agent's process (relay hook, OpenCode plugin): find its window once, for "jump to terminal"
  hub.on('pid', (id: string, pid: number) => {
    const s = hub.sessions.get(id)
    if (s?.windowPid || !native.available) return
    native.request<Record<string, unknown>>('window.ofProcess', { pid }).then(w => hub.attachWindow(id, w)).catch(() => {})
  })
  hub.on('question', (id: string) => {
    const seen = islandSeen()
    bringBack() // the island itself switches to its "ask" size
    // the island already shows it: a Windows notification only if it is still unanswered after 20 s
    const notify = () => {
      const s = hub.sessions.get(id)
      if (s?.ask) toast(tr('m.needsYou', { agent: agentName(s), project: s.project }), s.ask.kind === 'plan' ? tr('m.planReady') : s.detail, id)
    }
    if (seen) setTimeout(notify, 20_000).unref()
    else notify()
  })
  hub.on('usage', (agent: Agent, prev: Usage | undefined, next: Usage) => { today.usage(agent, next); usageAlert(agent, prev, next) })
  onBattery = powerMonitor.isOnBatteryPower()
  powerMonitor.on('on-battery', () => { onBattery = true; applyRest() })
  powerMonitor.on('on-ac', () => { onBattery = false; applyRest() })
  hub.on('finished', (s: Session) => {
    history.add(s)
    if (s.agent !== 'cli' && s.prompt) today.task({ agent: s.agent, seconds: s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0, files: s.files.length })
    if (s.agent !== 'cli' && s.prompt) {
      for (const id of pip.finish(s.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : 0)) {
        toast(tr('m.earned', { name: store.settings.pip.name }), translateOr(store.settings.general.language, `o.${id}`, ACHIEVEMENTS.find(a => a.id === id)?.name ?? id))
      }
      refreshTray()
    }
    toastDone(s)
  })
  hub.on('notify', (n: { id: string; title: string; body: string }) => toast(n.title, n.body, n.id))
  fullscreen.on('change', (id: number | null) => {
    if (id === null) shownAnyway = false
    log.info(id === null ? 'nothing full screen' : `full screen on display ${id}`)
    updateVisibility()
    applyRest()
  })
  store.on('change', () => { applySettings(); refreshTray(); push() })
  updater.on('change', (s: { state: string; version?: string }) => {
    refreshTray()
    if (s.state === 'ready') toast(tr('m.updateReady', { version: s.version ?? '' }), tr('m.updateReadyBody'))
  })
  store.watch()
  applySettings()
  refreshTray()
  if (!store.settings.general.welcomed) settingsWin.openWelcome()
})
