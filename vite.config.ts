import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

// Vite configuration for TanStack Start with Nitro
const config = defineConfig({
  plugins: [
    devtools(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    // NOTE: VAD library is loaded from CDN via script tags in useVAD.ts
    // This avoids Vite/ESM compatibility issues with the CommonJS library
    tanstackStart(),
    nitro({
      rollupConfig: {
        external: [
          'three',
          '@react-three/fiber',
          '@react-three/drei',
          'its-fine',
          'three-custom-shader-material',
        ],
      },
      externals: {
        inline: ['zod'],
      },
    }),
    viteReact(),
  ],
  build: {
    rollupOptions: {
      external: [
        '@prisma/client/runtime/library',
        '@prisma/adapter-better-sqlite3',
        'better-sqlite3',
      ],
    },
  },
  ssr: {
    external: [
      '@prisma/client',
      '@prisma/adapter-better-sqlite3',
      'better-sqlite3',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'its-fine',
      'three-custom-shader-material',
    ],
  },
  optimizeDeps: {
    exclude: ['@tanstack/start-server-core', '@tanstack/react-start'],
  },
  server: {
    // Allow ngrok and other tunnel services for webhook testing in development
    allowedHosts: ['localhost', '.ngrok-free.app', '.ngrok.io'],
  },
})

export default config
