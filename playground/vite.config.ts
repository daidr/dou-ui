import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// The playground always runs against source, never the built output.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^dou-ui$/, replacement: r('../packages/dou-ui/src/index.ts') },
      { find: /^@dou-ui\/icons$/, replacement: r('../packages/icons/src/index.ts') },
      { find: /^dou-ui\/style\.css$/, replacement: r('../packages/theme/src/index.css') },
    ],
  },
})
