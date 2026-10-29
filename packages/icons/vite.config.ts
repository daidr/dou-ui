import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: { index: 'src/index.ts', meta: 'src/meta.ts' },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        // one module per icon, so bundlers keep only the icons that are imported
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
})
