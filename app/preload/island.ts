import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { CH, type IslandApi, type IslandState } from '../shared/ipc'
import type { Scene } from '../shared/island'

const api: IslandApi = {
  ready: () => ipcRenderer.send(CH.ready),
  onState: fn => { ipcRenderer.on(CH.state, (_e, s: IslandState) => fn(s)) },
  onExpand: fn => { ipcRenderer.on(CH.expand, (_e, id?: string) => fn(id)) },
  onToggle: fn => { ipcRenderer.on(CH.toggle, () => fn()) },
  onTuck: fn => { ipcRenderer.on(CH.tuck, () => fn()) },
  onScene: fn => { ipcRenderer.on(CH.scene, (_e, s: Scene | null) => fn(s)) },
  onBye: fn => { ipcRenderer.on(CH.bye, () => fn()) },
  byeDone: () => ipcRenderer.send(CH.byeDone),
  catchMouse: on => ipcRenderer.send(CH.catchMouse, on),
  tucked: on => ipcRenderer.send(CH.tucked, on),
  answer: (id, answer) => ipcRenderer.send(CH.answer, id, answer),
  reply: (id, text) => ipcRenderer.send(CH.reply, id, text),
  jump: id => ipcRenderer.send(CH.jump, id),
  seen: ids => ipcRenderer.send(CH.seen, ids),
  dismiss: id => ipcRenderer.send(CH.dismiss, id),
  act: a => ipcRenderer.send(CH.act, a),
  onPage: fn => { ipcRenderer.on(CH.page, (_e, p: string, listen: boolean) => fn(p, listen)) },
  onPlay: fn => { ipcRenderer.on(CH.play, (_e, url: string | null) => fn(url)) },
  onWorry: fn => { ipcRenderer.on(CH.worry, () => fn()) },
  onPeak: fn => { ipcRenderer.on(CH.peak, (_e, p: number) => fn(p)) },
  pathsOf: files => files.map(f => webUtils.getPathForFile(f)).filter(Boolean)
}

contextBridge.exposeInMainWorld('pebble', api)
