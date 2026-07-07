/**
 * Copies the VAD + ONNX runtime browser assets from node_modules into
 * public/vad/ so they are served from our own origin instead of a CDN.
 *
 * Runs on postinstall, so the served files always match the versions
 * pinned in package.json (previously the CDN was pinned to different
 * versions than the installed packages, and a CDN outage silently
 * disabled barge-in detection).
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'vad')

const files = [
  // @ricky0123/vad-web browser bundle + worklet + Silero models
  ['node_modules/@ricky0123/vad-web/dist/bundle.min.js', 'bundle.min.js'],
  [
    'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
    'vad.worklet.bundle.min.js',
  ],
  [
    'node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx',
    'silero_vad_legacy.onnx',
  ],
  [
    'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx',
    'silero_vad_v5.onnx',
  ],
  // onnxruntime-web wasm runtime (loader + wasm binary + module proxy)
  ['node_modules/onnxruntime-web/dist/ort.wasm.min.js', 'ort.wasm.min.js'],
  [
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.wasm',
  ],
  [
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.mjs',
  ],
]

mkdirSync(outDir, { recursive: true })

let copied = 0
for (const [src, dest] of files) {
  const srcPath = join(root, src)
  if (!existsSync(srcPath)) {
    console.warn(`[vad-assets] Missing (skipped): ${src}`)
    continue
  }
  copyFileSync(srcPath, join(outDir, dest))
  copied++
}

console.log(`[vad-assets] Copied ${copied}/${files.length} files to public/vad/`)
