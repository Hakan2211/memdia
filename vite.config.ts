import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Vite configuration for TanStack Start with Nitro
const config = defineConfig({
  plugins: [
    devtools(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    // Copy ONNX and WASM files for @ricky0123/vad-react (Voice Activity Detection)
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
          dest: '',
        },
        {
          src: 'node_modules/@ricky0123/vad-web/dist/*.onnx',
          dest: '',
        },
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: '',
        },
      ],
    }),
    tanstackStart(),
    nitroV2Plugin(),
    viteReact(),
  ],
  build: {
    rollupOptions: {
      external: ['@prisma/client/runtime/library', 'better-sqlite3'],
    },
  },
  ssr: {
    external: [
      '@prisma/client',
      '@prisma/adapter-better-sqlite3',
      'better-sqlite3',
    ],
  },
  optimizeDeps: {
    exclude: ['@tanstack/start-server-core', '@tanstack/react-start'],
  },
})

export default config
