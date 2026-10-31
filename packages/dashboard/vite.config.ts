import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        'layout/index': 'src/layout/index.ts',
        'widgets/index': 'src/widgets/index.ts',
        'chart/index': 'src/chart/index.ts',
        'pivot/index': 'src/pivot/index.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'dou-ui', /^@dou-ui\//],
      output: {
        // keep the source module structure so bundlers can tree-shake
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
})
