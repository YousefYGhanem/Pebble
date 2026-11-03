// Pip gallery: every mood and every outfit, large, in the default theme. Open it while `npm run dev` runs
// (http://localhost:5173/pip-gallery/index.html): edits to pip.ts or the theme show up right away.
// `npm run capture` also saves it as docs/screens/pip-gallery.png.
import { drawPip } from '../island/pip'
import { MOODS, OUTFITS } from '../../shared/pip'
import theme from '../../../themes/default.json'

const tok = theme.tokens as unknown as Record<string, string>
const COLOR: Record<string, string> = { idle: tok.text!, curious: tok.text!, focused: tok.running!, alert: tok.question!, happy: tok.done!, love: tok.text!, sleepy: tok.text!, dizzy: tok.text!, grumpy: tok.text!, dancing: tok.text!, sad: tok.error! }
const CELL = 120, SIZE = 56, COLS = 6
const items = [...MOODS.map(m => ({ label: m, mood: m, outfit: null as string | null })), ...OUTFITS.map(o => ({ label: o.name, mood: 'idle' as const, outfit: o.id }))]

const canvas = document.getElementById('c') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const W = COLS * CELL, H = Math.ceil(items.length / COLS) * CELL
canvas.width = W * devicePixelRatio
canvas.height = H * devicePixelRatio
canvas.style.width = `${W}px`
canvas.style.height = `${H}px`

function frame(ms: number) {
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  ctx.clearRect(0, 0, W, H)
  items.forEach((it, i) => {
    const x = (i % COLS) * CELL + CELL / 2, y = Math.floor(i / COLS) * CELL + CELL / 2 + 6
    drawPip(ctx, { x, y, size: SIZE, mood: it.mood, outfit: it.outfit, color: COLOR[it.mood]!, body: tok.pipBody ?? '#ece9f6', visor: tok.pipVisor ?? '#15151c', open: 1, t: ms / 1000 })
    ctx.fillStyle = '#8b8b98'
    ctx.textAlign = 'center'
    ctx.fillText(it.label, x, y + SIZE * 0.5 + 22)
  })
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
