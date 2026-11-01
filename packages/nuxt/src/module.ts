import {
  addComponent,
  addImports,
  addPluginTemplate,
  addTemplate,
  defineNuxtModule,
  resolvePath,
  useLogger,
} from '@nuxt/kit'
import {
  componentDirs,
  directives,
  functionDirs,
  iconNames,
  packageComponents,
} from '@dou-ui/resolver'
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
   * Register every component of `dou-ui` (`<DouButton>`, …) for templates,
   * and those of the installed packages built on it (`<DouChart>`,
   * `<DouEditor>`, …). Only the ones a page uses end up in its bundle.
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
   * templates.
   *
   * @default true when `@dou-ui/icons` is installed
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

const installed = (name: string) =>
  resolvePath(name, { fallbackToOriginal: false }).then(
    () => true,
    () => false,
  )

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
    colorMode: true,
    exclude: [],
  },
  async setup(options, nuxt) {
    const logger = useLogger('@dou-ui/nuxt')
    const excluded = new Set(options.exclude)
    const onDemand = options.css === 'on-demand'

    // The packages built on `dou-ui` that the app has installed, with the
    // components each one brings.
    const packages = new Map<string, [name: string, from: string][]>()
    if (options.components) {
      for (const [name, { from, style }] of Object.entries(packageComponents)) {
        const pkg = style.slice(0, -'/style'.length)
        packages.set(pkg, [...(packages.get(pkg) ?? []), [name, from]])
      }
      for (const pkg of packages.keys()) {
        if (!(await installed(pkg))) packages.delete(pkg)
      }
    }

    // Style entries import `.css`, which only the bundler understands.
    nuxt.options.build.transpile.push(
      'dou-ui',
      '@dou-ui/theme',
      '@dou-ui/icons',
      ...packages.keys(),
    )
    if (options.css === 'full') {
      nuxt.options.css.unshift(
        'dou-ui/style.css',
        ...[...packages.keys()].map((pkg) => `${pkg}/style.css`),
      )
    }

    // Where each name comes from. With on-demand styles, a small module per
    // style entry imports the entry and re-exports what it styles.
    const entries = new Map<string, { style: string; from: string; names: Set<string> }>()
    const through = (name: string, from: string, style: string, file: string) => {
      const entry = entries.get(file) ?? { style, from, names: new Set() }
      entries.set(file, entry)
      entry.names.add(name)
      return `#build/dou-ui/${file}.mjs`
    }
    const from = (name: string, dir: string | null) =>
      !onDemand || dir === null
        ? 'dou-ui'
        : through(name, 'dou-ui', `dou-ui/components/${dir}/style`, dir)

    if (options.components) {
      for (const [name, dir] of Object.entries(componentDirs)) {
        if (!excluded.has(name)) addComponent({ name, export: name, filePath: from(name, dir) })
      }
      for (const [pkg, components] of packages) {
        for (const [name, source] of components) {
          if (excluded.has(name)) continue
          // `@dou-ui/gantt/scheduler` → `packages/gantt-scheduler`
          const file = `packages/${source.slice('@dou-ui/'.length).replaceAll('/', '-')}`
          const filePath = onDemand ? through(name, source, `${pkg}/style`, file) : source
          addComponent({ name, export: name, filePath })
        }
      }
    }

    const icons = options.icons ?? (await installed('@dou-ui/icons'))
    if (icons) {
      if (options.icons && !(await installed('@dou-ui/icons'))) {
        logger.warn('`icons` is on, but `@dou-ui/icons` is not installed.')
      }
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

    for (const [file, { style, from: source, names }] of entries) {
      addTemplate({
        filename: `dou-ui/${file}.mjs`,
        getContents: () =>
          `import '${style}'\nexport { ${[...names].join(', ')} } from '${source}'\n`,
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
