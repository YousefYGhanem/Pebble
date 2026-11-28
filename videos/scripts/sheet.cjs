// A contact sheet of review stills: every PNG in a folder, in frame order, 4 per row at a quarter size.
//   npx electron videos/scripts/sheet.cjs videos/out/review/v1   → <folder>/sheet.png
const { app, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.whenReady().then(() => {
  const dir = path.resolve(process.argv[process.argv.findIndex(a => a.endsWith('sheet.cjs')) + 1])
  const files = fs.readdirSync(dir).filter(f => /^f\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
  const cw = 270, ch = 337, cols = 4, rows = Math.ceil(files.length / cols)
  const out = Buffer.alloc(cw * cols * ch * rows * 4)
  files.forEach((f, n) => {
    const img = nativeImage.createFromPath(path.join(dir, f)).resize({ width: cw, height: ch, quality: 'good' })
    const px = img.toBitmap(), ox = (n % cols) * cw, oy = Math.floor(n / cols) * ch
    for (let y = 0; y < ch; y++) px.copy(out, ((oy + y) * cw * cols + ox) * 4, y * cw * 4, (y + 1) * cw * 4)
  })
  fs.writeFileSync(path.join(dir, 'sheet.png'), nativeImage.createFromBitmap(out, { width: cw * cols, height: ch * rows }).toPNG())
  console.log(files.join(' '))
  app.quit()
})
