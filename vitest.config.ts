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
      {
        find: /^@dou-ui\/editor\/code$/,
        replacement: r('./packages/editor/src/code/index.ts'),
      },
      { find: /^@dou-ui\/editor$/, replacement: r('./packages/editor/src/index.ts') },
      { find: /^@dou-ui\/chart$/, replacement: r('./packages/chart/src/index.ts') },
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
        find: /^@dou-ui\/code\/worker$/,
        replacement: r('./packages/code/src/worker/index.ts'),
      },
      { find: /^@dou-ui\/code$/, replacement: r('./packages/code/src/index.ts') },
      {
        find: /^@dou-ui\/dashboard\/layout$/,
        replacement: r('./packages/dashboard/src/layout/index.ts'),
      },
      {
        find: /^@dou-ui\/dashboard\/widgets$/,
        replacement: r('./packages/dashboard/src/widgets/index.ts'),
      },
      {
        find: /^@dou-ui\/dashboard\/chart$/,
        replacement: r('./packages/dashboard/src/chart/index.ts'),
      },
      {
        find: /^@dou-ui\/dashboard\/pivot$/,
        replacement: r('./packages/dashboard/src/pivot/index.ts'),
      },
      {
        find: /^@dou-ui\/dashboard\/collaboration$/,
        replacement: r('./packages/dashboard/src/collaboration/index.ts'),
      },
      { find: /^@dou-ui\/dashboard$/, replacement: r('./packages/dashboard/src/index.ts') },
      { find: /^@dou-ui\/sheet\/code$/, replacement: r('./packages/sheet/src/code/index.ts') },
      { find: /^@dou-ui\/sheet$/, replacement: r('./packages/sheet/src/index.ts') },
      {
        find: /^@dou-ui\/sheet\/formula$/,
        replacement: r('./packages/sheet/src/formula/index.ts'),
      },
      {
        find: /^@dou-ui\/pivot\/engine$/,
        replacement: r('./packages/pivot/src/engine/index.ts'),
      },
      {
        find: /^@dou-ui\/pivot\/worker$/,
        replacement: r('./packages/pivot/src/worker/index.ts'),
      },
      { find: /^@dou-ui\/pivot$/, replacement: r('./packages/pivot/src/index.ts') },
      {
        find: /^@dou-ui\/form-builder\/code$/,
        replacement: r('./packages/form-builder/src/code/index.ts'),
      },
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
