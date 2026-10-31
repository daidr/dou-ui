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
        'collaboration/index': 'src/collaboration/index.ts',
        'whiteboard/index': 'src/whiteboard/index.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'dou-ui', /^@dou-ui\//, 'yjs', /^y-protocols/],
      output: {
        // keep the source module structure so bundlers can tree-shake per component
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
})
