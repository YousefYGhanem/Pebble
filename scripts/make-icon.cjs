// `npm run icon`: draws Pebble's icons from build/icons/<name>.svg (large sizes) and <name>-tray.svg (16-32 px), each
// size drawn at that size, and writes for every icon you can choose in Settings (lavender, cream, graphite):
//   build/icons/<name>.ico, <name>-tray.ico   the windows' and the tray's icon
// and from lavender, the one the exe and installer carry:
//   build/icon.png, build/icon.ico, extensions/chat/icon-*.png
// and the Microsoft Store package's logos: build/appx/*.png (Pip in the middle of each, on a transparent tile)
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.disableHardwareAcceleration() // offscreen capture without the GPU: steadier in scripts and CI
app.on('window-all-closed', () => {}) // one window per icon: closing one must not end the script

const root = path.join(__dirname, '..'), dir = path.join(root, 'build', 'icons')
const ICONS = ['lavender', 'cream', 'graphite']
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const svg = file => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(dir, file)).toString('base64')

/** PNG images → one .ico (PNG entries: Windows Vista and later). */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(1, 2) // type: icon
  head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, e) // 0 means 256
    head.writeUInt8(size >= 256 ? 0 : size, e + 1)
    head.writeUInt16LE(1, e + 4) // planes
    head.writeUInt16LE(32, e + 6) // bits per pixel
    head.writeUInt32LE(data.length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...pngs.map(p => p.data)])
}

/** Every size of one icon, drawn side by side on a transparent page, captured once and cut apart. */
async function draw(name) {
  let x = 0
  const placed = SIZES.map(size => { const at = x; x += size + 8; return { size, at } })
  const html = '<style>html,body{margin:0;background:transparent;overflow:hidden}img{position:absolute;top:0}</style>' +
    placed.map(p => `<img src="${svg(p.size <= 32 ? `${name}-tray.svg` : `${name}.svg`)}" width="${p.size}" height="${p.size}" style="left:${p.at}px">`).join('')
  const win = new BrowserWindow({ width: x, height: 256, show: false, transparent: true, frame: false, webPreferences: { offscreen: true, zoomFactor: 1 } })
  await win.loadURL('data:text/html,' + encodeURIComponent(html))
  await new Promise(r => setTimeout(r, 500))
  const page = await win.webContents.capturePage()
  win.destroy()
  return Object.fromEntries(placed.map(p => [p.size, page.crop({ x: p.at, y: 0, width: p.size, height: p.size }).toPNG()]))
}

/** The Store's tile and taskbar logos: [file, width, height, Pip's size]. */
const STORE = [['StoreLogo.png', 50, 50, 50], ['Square44x44Logo.png', 44, 44, 44], ['Square150x150Logo.png', 150, 150, 96],
  ['Wide310x150Logo.png', 310, 150, 96], ['LargeTile.png', 310, 310, 190], ['SmallTile.png', 71, 71, 48], ['SplashScreen.png', 620, 300, 160]]
async function storeLogos() {
  const out = path.join(root, 'build', 'appx')
  fs.mkdirSync(out, { recursive: true })
  for (const [file, w, h, size] of STORE) {
    const html = '<style>html,body{margin:0;background:transparent;overflow:hidden}img{position:absolute}</style>' +
      `<img src="${svg(size <= 32 ? 'lavender-tray.svg' : 'lavender.svg')}" width="${size}" height="${size}" style="left:${(w - size) / 2}px;top:${(h - size) / 2}px">`
    const win = new BrowserWindow({ width: w, height: h, show: false, transparent: true, frame: false, webPreferences: { offscreen: true, zoomFactor: 1 } })
    await win.loadURL('data:text/html,' + encodeURIComponent(html))
    await new Promise(r => setTimeout(r, 300))
    const page = await win.webContents.capturePage()
    win.destroy()
    fs.writeFileSync(path.join(out, file), page.crop({ x: 0, y: 0, width: w, height: h }).toPNG())
  }
}

app.whenReady().then(async () => {
  for (const name of ICONS) {
    const png = await draw(name)
    fs.writeFileSync(path.join(dir, `${name}.ico`), ico(SIZES.map(size => ({ size, data: png[size] }))))
    fs.writeFileSync(path.join(dir, `${name}-tray.ico`), ico([16, 20, 24, 32, 40, 48].map(size => ({ size, data: png[size] }))))
    if (name !== 'lavender') continue
    fs.writeFileSync(path.join(root, 'build', 'icon.png'), png[256])
    fs.copyFileSync(path.join(dir, 'lavender.ico'), path.join(root, 'build', 'icon.ico'))
    for (const [file, size] of [['icon-16.png', 16], ['icon-48.png', 48], ['icon-128.png', 128]]) fs.writeFileSync(path.join(root, 'extensions', 'chat', file), png[size])
  }
  await storeLogos()
  app.quit()
})
