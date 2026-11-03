import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import QRCode from 'qrcode'
import type { Drop, ShelfFile } from '../../shared/extras'
import { logger } from '../log'

const log = logger('drop')
const MAX_UPLOAD = 500 * 1024 * 1024
const LIFETIME = 60 * 60 * 1000

/** This PC's address on the local network (Wi-Fi or cable), or null. */
export function lanAddress(nets = os.networkInterfaces()): string | null {
  const all = Object.entries(nets).flatMap(([name, list]) => (list ?? []).filter(n => n.family === 'IPv4' && !n.internal).map(n => ({ name, ip: n.address })))
  const privateIp = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
  const virtual = (name: string) => /vethernet|virtualbox|vmware|wsl|hyper-v|docker|loopback|bluetooth/i.test(name)
  return (all.find(n => privateIp(n.ip) && !virtual(n.name)) ?? all.find(n => privateIp(n.ip)))?.ip ?? null
}

/** A file name that is safe to save: no folders, no characters Windows refuses. */
export function safeName(name: string): string {
  // the last part after any slash (not path.basename: on Windows it reads "a:" as a drive and drops it)
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim()
  return base.slice(0, 180) || 'file'
}

function uniquePath(dir: string, name: string): string {
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length)
  let p = path.join(dir, name)
  for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, `${stem} (${i})${ext}`)
  return p
}

/**
 * Files between the shelf and your phone on the same Wi-Fi, like AirDrop. While it is on (at most an hour), a small web
 * page at http://<this PC>:<port>/<key> lists the shelf for download and takes uploads into Downloads (and the shelf).
 * The key (128 random bits) only travels in the QR code. Plain HTTP on your own network: Windows asks once whether
 * Pebble may accept connections there. Emits 'change' and 'received' (paths).
 */
export class DropServer extends EventEmitter {
  state: Drop | null = null
  private server?: http.Server
  private key = ''
  private timer?: NodeJS.Timeout

  constructor(private shelf: () => ShelfFile[], private downloads: string) { super() }

  async start(): Promise<void> {
    if (this.server) return
    const ip = lanAddress()
    if (!ip) throw new Error('This PC is not on a network (Wi-Fi or cable).')
    this.key = randomBytes(16).toString('hex')
    const server = http.createServer((req, res) => this.handle(req, res))
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '0.0.0.0', resolve) })
    this.server = server
    const url = `http://${ip}:${(server.address() as { port: number }).port}/${this.key}`
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
    this.state = { url, qr: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), connected: false, received: 0, expiresAt: Date.now() + LIFETIME }
    this.timer = setTimeout(() => this.stop(), LIFETIME)
    log.info(`phone drop on ${ip} (for an hour)`)
    this.emit('change')
  }

  stop() {
    clearTimeout(this.timer)
    this.server?.close()
    this.server?.closeAllConnections()
    this.server = undefined
    if (this.state) { this.state = null; this.emit('change') }
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://x')
    const [key, what, arg] = url.pathname.split('/').filter(Boolean)
    if (!this.state || key !== this.key) { res.writeHead(404).end(); return }
    if (!this.state.connected) { this.state.connected = true; this.emit('change') }

    if (req.method === 'GET' && !what) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(this.page()); return }
    if (req.method === 'GET' && what === 'file') {
      const f = this.shelf()[Number(arg)]
      if (!f || !fs.existsSync(f.path)) { res.writeHead(404).end(); return }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(f.path).size, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}` })
      fs.createReadStream(f.path).pipe(res)
      return
    }
    if (req.method === 'PUT' && what === 'upload') {
      const size = Number(req.headers['content-length'] ?? 0)
      if (!size || size > MAX_UPLOAD) { res.writeHead(413).end(); return }
      fs.mkdirSync(this.downloads, { recursive: true })
      const target = uniquePath(this.downloads, safeName(url.searchParams.get('name') ?? 'file'))
      const out = fs.createWriteStream(target)
      let got = 0
      req.on('data', c => { got += c.length; if (got > MAX_UPLOAD) req.destroy() })
      req.pipe(out)
      out.on('finish', () => {
        if (got !== size) { fs.rm(target, () => {}); res.writeHead(400).end(); return }
        this.state!.received++
        this.emit('received', [target])
        this.emit('change')
        res.writeHead(200).end('ok')
      })
      req.on('error', () => { out.destroy(); fs.rm(target, () => {}) })
      return
    }
    res.writeHead(404).end()
  }

  /** The phone's page: plain HTML, no outside scripts or fonts. */
  private page(): string {
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    const files = this.shelf().map((f, i) => `<a class="f" href="${this.key}/file/${i}" download="${esc(f.name)}">${esc(f.name)}<small>${(f.size / 1048576).toFixed(1)} MB</small></a>`).join('')
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pebble</title>
<style>body{margin:0;font:16px system-ui,sans-serif;background:#0d0d12;color:#f3f3f6;padding:20px}h1{font-size:20px}a.f{display:flex;justify-content:space-between;gap:12px;padding:14px;margin:8px 0;border-radius:14px;background:#1d1d26;color:inherit;text-decoration:none;word-break:break-all}small{color:#8b8b98;white-space:nowrap}label{display:block;margin-top:24px;padding:18px;border-radius:14px;background:#7c5cff;text-align:center;font-weight:600}input{display:none}#s{color:#8b8b98;margin-top:12px}</style></head>
<body><h1>Pebble</h1>${files || '<p style="color:#8b8b98">Nothing on the shelf yet.</p>'}
<label>Send to PC<input id="i" type="file" multiple></label><div id="s"></div>
<script>
const s=document.getElementById('s')
document.getElementById('i').onchange=async e=>{for(const f of e.target.files){s.textContent='Sending '+f.name+'…'
const r=await fetch(location.pathname.replace(/\\/$/,'')+'/upload?name='+encodeURIComponent(f.name),{method:'PUT',body:f})
s.textContent=r.ok?'Sent '+f.name:'Could not send '+f.name}}
</script></body></html>`
  }
}
