// The island's box in each capture (public/ui/*.png, 2x): the opaque area's bounds, measured from the pixels.
//   npx electron scripts/measure-ui.cjs   → src/pebble/ui-boxes.json
const { app, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const SCENES = ['page-home', 'resting', 'working', 'question', 'done', 'music', 'page-music', 'page-pip', 'open', 'split']
app.whenReady().then(() => {
  const folder = process.argv.find(a => a.startsWith('--dir='))?.slice(6) ?? 'ui'
  const dir = path.join(__dirname, '..', 'public', folder), out = {}
  for (const name of SCENES) {
    const img = nativeImage.createFromPath(path.join(dir, `${name}.png`))
    const { width, height } = img.getSize(), px = img.toBitmap() // BGRA
    let x0 = width, y0 = height, x1 = -1, y1 = -1
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] < 200) continue // the soft shadow is not the island
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
    out[name] = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, image: { w: width, h: height } }
  }
  fs.mkdirSync(path.join(__dirname, '..', 'src', 'pebble'), { recursive: true })
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'pebble', folder === 'ui' ? 'ui-boxes.json' : `${folder}-boxes.json`), JSON.stringify(out, null, 2) + '\n')
  console.log(JSON.stringify(out))
  app.quit()
})
