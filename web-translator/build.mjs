import * as esbuild from 'esbuild'
import { copyFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, 'src')
const dist = join(__dirname, 'extension')

// Recreate dist so removed entries do not linger in the unpacked extension.
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// Bundle JS entries (content script, background worker, popup)
const entries = [
  join(src, 'content', 'content.js'),
  join(src, 'background', 'background.js'),
  join(src, 'popup', 'popup.js'),
].filter(f => existsSync(f))

const esbuildOptions = {
  entryPoints: entries,
  bundle: true,
  outdir: dist,
  outbase: src,
  format: 'esm',
  target: 'es2022',
  sourcemap: false,
  minify: false,
}

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(esbuildOptions)
  await ctx.watch()
  console.log('👀 Watching for changes...')
} else {
  await esbuild.build(esbuildOptions)
}

// Copy non-JS files
for (const file of ['manifest.json']) {
  const srcFile = join(src, file)
  if (existsSync(srcFile)) copyFileSync(srcFile, join(dist, file))
}
// Copy popup html
const popupHtml = join(src, 'popup', 'popup.html')
if (existsSync(popupHtml)) copyFileSync(popupHtml, join(dist, 'popup', 'popup.html'))
// Copy icons
const iconDir = join(src, 'icons')
if (existsSync(iconDir)) {
  mkdirSync(join(dist, 'icons'), { recursive: true })
  for (const f of readdirSync(iconDir)) {
    copyFileSync(join(iconDir, f), join(dist, 'icons', f))
  }
}

console.log('✅ Build complete: extension/')
