import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^dou-ui$/, replacement: r('./packages/dou-ui/src/index.ts') },
      { find: /^@dou-ui\/theme$/, replacement: r('./packages/theme/src/index.ts') },
      { find: /^@dou-ui\/icons$/, replacement: r('./packages/icons/src/index.ts') },
      {
        find: /^@dou-ui\/editor\/collaboration$/,
        replacement: r('./packages/editor/src/collaboration/index.ts'),
      },
      { find: /^@dou-ui\/editor$/, replacement: r('./packages/editor/src/index.ts') },
      { find: /^@dou-ui\/flow$/, replacement: r('./packages/flow/src/index.ts') },
      {
        find: /^@dou-ui\/gantt\/scheduler$/,
        replacement: r('./packages/gantt/src/scheduler/index.ts'),
      },
      {
        find: /^@dou-ui\/gantt\/collaboration$/,
        replacement: r('./packages/gantt/src/collaboration/index.ts'),
      },
      { find: /^@dou-ui\/gantt$/, replacement: r('./packages/gantt/src/index.ts') },
      {
        find: /^@dou-ui\/form-builder\/renderer$/,
        replacement: r('./packages/form-builder/src/renderer/index.ts'),
      },
      { find: /^@dou-ui\/form-builder$/, replacement: r('./packages/form-builder/src/index.ts') },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['packages/*/src/**/*.test.ts'],
  },
})
