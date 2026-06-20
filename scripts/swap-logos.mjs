import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { copyFileSync, writeFileSync } from 'node:fs'

const SRC = 'Logo vanty.png'

// 1) Logo principal (lo usa admin, especialista, secretaria, landing, recibos PDF)
copyFileSync(SRC, 'public/images/logo.png')

// 2) Íconos PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
for (const s of sizes) {
  await sharp(SRC).resize(s, s, { fit: 'cover' }).png().toFile(`public/icons/icon-${s}x${s}.png`)
}
// apple-touch-icon (180x180)
await sharp(SRC).resize(180, 180, { fit: 'cover' }).png().toFile('public/icons/apple-touch-icon.png')

// 3) favicon.ico (multi-tamaño) — app router + root
const icoBufs = await Promise.all([16, 32, 48, 64].map(s =>
  sharp(SRC).resize(s, s, { fit: 'cover' }).png().toBuffer()))
const ico = await pngToIco(icoBufs)
writeFileSync('app/favicon.ico', ico)
writeFileSync('favicon.ico', ico)

console.log('Logos reemplazados: logo.png + ' + sizes.length + ' íconos PWA + apple-touch + favicon.ico (x2)')
