import * as esbuild from 'esbuild'
import { copyFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, 'src')
const dist = join(__dirname, 'extension')

// Recreate dist so removed entries do not linger in the unpacked extension.
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
mkdirSync(join(dist, 'icons'), { recursive: true })

// Bundle JS entries
const entries = ['app.js', 'background.js']
  .map(f => join(src, f))
  .filter(f => existsSync(f))

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context({
    entryPoints: entries,
    bundle: true,
    outdir: dist,
    outbase: src,
    format: 'esm',
    target: 'es2022',
    sourcemap: false,
    minify: false,
  })
  await ctx.watch()
  console.log('👀 Watching for changes...')
} else {
  await esbuild.build({
    entryPoints: entries,
    bundle: true,
    outdir: dist,
    outbase: src,
    format: 'esm',
    target: 'es2022',
    sourcemap: false,
    minify: false,
  })
}

// Copy non-JS files
for (const file of ['app.html', 'app.css', 'tree-view.css', 'manifest.json']) {
  const srcFile = join(src, file)
  if (existsSync(srcFile)) {
    copyFileSync(srcFile, join(dist, file))
  }
}
// Copy icons
const iconDir = join(src, 'icons')
if (existsSync(iconDir)) {
  for (const f of readdirSync(iconDir)) {
    copyFileSync(join(iconDir, f), join(dist, 'icons', f))
  }
}

console.log('✅ Build complete: dist/')
