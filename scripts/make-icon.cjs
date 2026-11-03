// `npx electron scripts/make-icon.cjs`: turns build/icon.svg into build/icon.png (256×256, the installer's and app's icon) and the extension's icons.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.disableHardwareAcceleration() // offscreen capture without the GPU: steadier in scripts and CI

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../build/icon.svg'), 'utf8')
  const win = new BrowserWindow({ width: 256, height: 256, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } })
  win.webContents.setZoomFactor(1)
  await win.loadURL('data:text/html,' + encodeURIComponent(`<style>html,body{margin:0;background:transparent;overflow:hidden}</style>${svg}`))
  await new Promise(r => setTimeout(r, 300))
  const img = (await win.webContents.capturePage()).resize({ width: 256, height: 256 })
  fs.writeFileSync(path.join(__dirname, '../build/icon.png'), img.toPNG())
  // the browser extension's icons (Chrome Web Store and Edge Add-ons need 128; the toolbar uses 16 and 48)
  for (const size of [16, 48, 128]) fs.writeFileSync(path.join(__dirname, `../extensions/chat/icon-${size}.png`), img.resize({ width: size, height: size, quality: 'best' }).toPNG())
  app.quit()
})
