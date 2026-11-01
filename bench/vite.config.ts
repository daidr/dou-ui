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
      { find: /^@dou-ui\/chart$/, replacement: r('../packages/chart/src/index.ts') },
      {
        find: /^@dou-ui\/chart\/style\.css$/,
        replacement: r('../packages/chart/src/style.css'),
      },
      { find: /^@dou-ui\/gantt$/, replacement: r('../packages/gantt/src/index.ts') },
      {
        find: /^@dou-ui\/gantt\/style\.css$/,
        replacement: r('../packages/gantt/src/style.css'),
      },
      { find: /^@dou-ui\/code\/worker$/, replacement: r('../packages/code/src/worker/index.ts') },
      { find: /^@dou-ui\/code$/, replacement: r('../packages/code/src/index.ts') },
      {
        find: /^@dou-ui\/code\/style\.css$/,
        replacement: r('../packages/code/src/style.css'),
      },
      { find: /^@dou-ui\/sheet-xlsx$/, replacement: r('../packages/sheet-xlsx/src/index.ts') },
      { find: /^@dou-ui\/sheet$/, replacement: r('../packages/sheet/src/index.ts') },
      { find: /^@dou-ui\/sheet\/core$/, replacement: r('../packages/sheet/src/core/index.ts') },
      {
        find: /^@dou-ui\/sheet\/formula$/,
        replacement: r('../packages/sheet/src/formula/index.ts'),
      },
      { find: /^@dou-ui\/dashboard$/, replacement: r('../packages/dashboard/src/index.ts') },
      {
        find: /^@dou-ui\/dashboard\/style\.css$/,
        replacement: r('../packages/dashboard/src/style.css'),
      },
      { find: /^@dou-ui\/pivot$/, replacement: r('../packages/pivot/src/index.ts') },
      {
        find: /^@dou-ui\/pivot\/style\.css$/,
        replacement: r('../packages/pivot/src/style.css'),
      },
      {
        find: /^@dou-ui\/sheet\/style\.css$/,
        replacement: r('../packages/sheet/src/style.css'),
      },
      {
        find: /^@dou-ui\/form-builder$/,
        replacement: r('../packages/form-builder/src/index.ts'),
      },
      {
        find: /^@dou-ui\/form-builder\/style\.css$/,
        replacement: r('../packages/form-builder/src/style.css'),
      },
      { find: /^@dou-ui\/flow$/, replacement: r('../packages/flow/src/index.ts') },
      {
        find: /^@dou-ui\/flow\/style\.css$/,
        replacement: r('../packages/flow/src/style.css'),
      },
    ],
  },
  worker: { format: 'es' },
  build: { outDir: r('dist'), emptyOutDir: true },
})
