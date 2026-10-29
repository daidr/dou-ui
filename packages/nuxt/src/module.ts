import {
  addComponent,
  addImports,
  addPluginTemplate,
  addTemplate,
  defineNuxtModule,
  resolvePath,
  useLogger,
} from '@nuxt/kit'
import { componentDirs, directives, functionDirs, iconNames } from '@dou-ui/resolver'
import type { GlobalConfig, UseColorModeOptions } from 'dou-ui'

export interface ModuleOptions {
  /**
   * How styles are loaded.
   *
   * - `'full'`: the whole stylesheet, once, in every page.
   * - `'on-demand'`: each component brings the style entry it needs.
   * - `false`: nothing; load the styles yourself.
   *
   * @default 'full'
   */
  css?: 'full' | 'on-demand' | false
  /**
   * Register every component of `dou-ui` (`<DouButton>`, …) for templates.
   * Only the ones a page uses end up in its bundle.
   *
   * @default true
   */
  components?: boolean
  /**
   * Register `v-loading` and `v-infinite-scroll`.
   *
   * @default true
   */
  directives?: boolean
  /**
   * Import `toast`, `dialog`, `useDialog`, `useColorMode`, `useCountdown`,
   * `useSortable`, `vLoading` and `vInfiniteScroll` automatically.
   *
   * @default true
   */
  imports?: boolean
  /**
   * Register the icons of `@dou-ui/icons` (`<SearchIcon />`, …) for
   * templates. Install `@dou-ui/icons` first.
   *
   * @default false
   */
  icons?: boolean
  /**
   * Paint the server-rendered page in the color mode the visitor picked,
   * with a small script in `<head>`. Pass the options of `useColorMode()`
   * to change where the choice is kept, or `false` to leave color mode
   * to the app.
   *
   * @default true
   */
  colorMode?: boolean | Omit<UseColorModeOptions, 'target' | 'disableTransition'>
  /** Names to leave alone, e.g. ones the app defines itself. */
  exclude?: string[]
}

declare module '@nuxt/schema' {
  interface NuxtConfig {
    douUI?: ModuleOptions
  }
  interface NuxtOptions {
    douUI?: ModuleOptions
  }
  interface AppConfigInput {
    /** App-wide defaults for DouUI components: size, locale and `z-index`. */
    douUI?: GlobalConfig
  }
  interface AppConfig {
    douUI?: GlobalConfig
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@dou-ui/nuxt',
    configKey: 'douUI',
    compatibility: { nuxt: '>=4.0.0' },
  },
  defaults: {
    css: 'full',
    components: true,
    directives: true,
    imports: true,
    icons: false,
    colorMode: true,
    exclude: [],
  },
  async setup(options, nuxt) {
    const logger = useLogger('@dou-ui/nuxt')
    const excluded = new Set(options.exclude)
    const onDemand = options.css === 'on-demand'

    // Style entries import `.css`, which only the bundler understands.
    nuxt.options.build.transpile.push('dou-ui', '@dou-ui/theme', '@dou-ui/icons')
    if (options.css === 'full') nuxt.options.css.unshift('dou-ui/style.css')

    // Where each name comes from. With on-demand styles, a small module per
    // style entry imports the entry and re-exports what it styles.
    const entries = new Map<string, Set<string>>()
    const from = (name: string, dir: string | null) => {
      if (!onDemand || dir === null) return 'dou-ui'
      const names = entries.get(dir) ?? new Set()
      entries.set(dir, names.add(name))
      return `#build/dou-ui/${dir}.mjs`
    }

    if (options.components) {
      for (const [name, dir] of Object.entries(componentDirs)) {
        if (!excluded.has(name)) addComponent({ name, export: name, filePath: from(name, dir) })
      }
    }

    if (options.icons) {
      const installed = await resolvePath('@dou-ui/icons', { fallbackToOriginal: false }).catch(
        () => undefined,
      )
      if (!installed) logger.warn('`icons` is on, but `@dou-ui/icons` is not installed.')
      for (const name of iconNames) {
        // Below the app's own components, so a local `SearchIcon.vue` wins.
        if (!excluded.has(name)) {
          addComponent({ name, export: name, filePath: '@dou-ui/icons', priority: -1 })
        }
      }
    }

    if (options.imports) {
      addImports(
        Object.entries(functionDirs)
          .filter(([name]) => !excluded.has(name))
          .map(([name, dir]) => ({ name, from: from(name, dir) })),
      )
    }

    const used = options.directives
      ? Object.entries(directives)
          .filter(([, { name }]) => !excluded.has(name))
          .map(([written, { name, dir }]) => ({
            name,
            written: written.replace(
              /[A-Z]/g,
              (char, index: number) => `${index ? '-' : ''}${char.toLowerCase()}`,
            ),
            from: from(name, dir),
          }))
      : []

    for (const [dir, names] of entries) {
      addTemplate({
        filename: `dou-ui/${dir}.mjs`,
        getContents: () =>
          `import 'dou-ui/components/${dir}/style'\nexport { ${[...names].join(', ')} } from 'dou-ui'\n`,
      })
    }

    const colorMode = options.colorMode === true ? {} : options.colorMode
    addPluginTemplate({
      filename: 'dou-ui/plugin.mjs',
      getContents: () => {
        const imports = used.map(({ name, from: source }) => `import { ${name} } from '${source}'`)
        return `import { defineNuxtPlugin, useAppConfig, useHead } from '#imports'
import { colorModeScript, provideGlobalConfig, useColorMode } from 'dou-ui'
${imports.join('\n')}

const colorMode = ${JSON.stringify(colorMode)}

export default defineNuxtPlugin({
  name: 'dou-ui',
  setup(nuxtApp) {
    const appConfig = useAppConfig()
    provideGlobalConfig(() => appConfig.douUI ?? {}, nuxtApp.vueApp)
${used.map(({ name, written }) => `    nuxtApp.vueApp.directive('${written}', ${name})`).join('\n')}
    if (colorMode) {
      if (import.meta.server) {
        useHead({
          script: [{ key: 'dou-color-mode', innerHTML: colorModeScript(colorMode), tagPriority: 'critical' }],
        })
      } else {
        // The first call decides the options every later call shares.
        useColorMode(colorMode)
      }
    }
  },
})
`
      },
    })
  },
})
