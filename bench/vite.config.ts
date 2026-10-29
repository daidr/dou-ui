import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Benchmarks run against source, built in production mode.
export default defineConfig({
  root: r('.'),
  base: './',
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^dou-ui$/, replacement: r('../packages/dou-ui/src/index.ts') },
      { find: /^@dou-ui\/icons$/, replacement: r('../packages/icons/src/index.ts') },
      { find: /^dou-ui\/style\.css$/, replacement: r('../packages/theme/src/index.css') },
    ],
  },
  build: { outDir: r('dist'), emptyOutDir: true },
})
