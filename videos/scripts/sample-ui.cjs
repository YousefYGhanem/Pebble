// Prints pixel colours of a capture at given points (x,y in the 2x image): the island's fill, top to bottom, and its edge.
//   npx electron scripts/sample-ui.cjs question 824,4 824,40 824,120 824,220 351,10 360,10 366,10 370,40
const { app, nativeImage } = require('electron')
const path = require('node:path')
app.whenReady().then(() => {
  const [name, ...points] = process.argv.slice(process.argv.findIndex(a => a.endsWith('sample-ui.cjs')) + 1)
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'public', 'ui', `${name}.png`))
  const { width } = img.getSize(), px = img.toBitmap()
  for (const p of points) {
    const [x, y] = p.split(',').map(Number), i = (y * width + x) * 4
    const hex = '#' + [px[i + 2], px[i + 1], px[i]].map(v => v.toString(16).padStart(2, '0')).join('')
    console.log(`${name} ${x},${y} ${hex} a=${px[i + 3]}`)
  }
  app.quit()
})
