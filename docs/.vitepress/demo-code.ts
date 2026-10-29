import { readFileSync } from 'node:fs'
import { createMarkdownRenderer } from 'vitepress'
import type { MarkdownOptions } from 'vitepress'
import type { Plugin } from 'vite'

const PREFIX = '\0doc-demo-code:'

/**
 * `import('…/examples/button/size.vue?highlight')` gives the example's
 * source as highlighted HTML. DocDemo loads it the first time the code is
 * shown, so the page itself stays as light as before.
 */
export function demoCode(srcDir: string, markdown: MarkdownOptions): Plugin {
  let renderer: ReturnType<typeof createMarkdownRenderer> | undefined
  return {
    name: 'dou-docs:demo-code',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (!id.endsWith('.vue?highlight')) return
      const file = await this.resolve(id.slice(0, -'?highlight'.length), importer, {
        skipSelf: true,
      })
      // No `.vue` ending, so the Vue plugin leaves the module alone.
      if (file) return PREFIX + file.id.slice(0, -'.vue'.length)
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return
      const file = `${id.slice(PREFIX.length)}.vue`
      this.addWatchFile(file)
      const md = await (renderer ??= createMarkdownRenderer(srcDir, markdown))
      const html = md.options.highlight!(readFileSync(file, 'utf8').trimEnd(), 'vue', '')
      return `export default ${JSON.stringify(html)}`
    },
  }
}
