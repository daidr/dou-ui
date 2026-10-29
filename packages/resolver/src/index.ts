import { componentDirs, iconNames } from './generated/names'

/** What a resolver hands back: the export to import, where from, and what to import with it. */
export interface ImportInfo {
  name: string
  from: string
  sideEffects?: string | string[]
}

export type ResolverFunction = (name: string) => ImportInfo | undefined

/** The resolver shape of on-demand component plugins. */
export interface ComponentResolver {
  type: 'component' | 'directive'
  resolve: ResolverFunction
}

export interface DouUIResolverOptions {
  /**
   * Import each component's stylesheet along with it. Turn off when the
   * full stylesheet (`dou-ui/style.css`) is loaded once instead.
   *
   * @default true
   */
  importStyle?: boolean
  /**
   * Resolve `v-loading` and `v-infinite-scroll` too.
   *
   * @default true
   */
  directives?: boolean
  /**
   * Resolve `<SearchIcon />` and the other icons of `@dou-ui/icons` (when
   * it is installed).
   *
   * @default false
   */
  icons?: boolean
  /** Names to leave alone, e.g. ones the app defines itself. */
  exclude?: RegExp | string[]
}

const styleOf = (dir: string | null, options: DouUIResolverOptions) =>
  options.importStyle === false || dir === null ? undefined : `dou-ui/components/${dir}/style`

const excluded = (name: string, exclude: DouUIResolverOptions['exclude']) =>
  exclude instanceof RegExp ? exclude.test(name) : !!exclude?.includes(name)

const icons = new Set(iconNames)

/**
 * The functions of `dou-ui` worth importing automatically, with the
 * directory of the style entry for what they render (`null` when they
 * render nothing).
 */
export const functionDirs: Readonly<Record<string, string | null>> = {
  toast: 'toast',
  dialog: 'dialog',
  useDialog: 'dialog',
  vLoading: 'loading',
  vInfiniteScroll: 'infinite-scroll',
  useSortable: 'sortable',
  useColorMode: null,
  useCountdown: null,
}

/** The directives of `dou-ui`, by the name they are written with (`v-loading` → `Loading`). */
export const directives: Readonly<Record<string, { name: string; dir: string }>> = {
  Loading: { name: 'vLoading', dir: 'loading' },
  InfiniteScroll: { name: 'vInfiniteScroll', dir: 'infinite-scroll' },
}

/**
 * Resolve DouUI components (and the directives) as they are used in templates,
 * for an on-demand components plugin.
 *
 * ```ts
 * Components({ resolvers: [DouUIResolver()] })
 * ```
 *
 * `<DouButton>` becomes `import { DouButton } from 'dou-ui'` plus
 * `import 'dou-ui/components/button/style'`.
 */
export function DouUIResolver(options: DouUIResolverOptions = {}): ComponentResolver[] {
  const resolvers: ComponentResolver[] = [
    {
      type: 'component',
      resolve(name) {
        if (excluded(name, options.exclude)) return
        const dir = componentDirs[name]
        if (dir) return { name, from: 'dou-ui', sideEffects: styleOf(dir, options) }
        if (options.icons && icons.has(name)) return { name, from: '@dou-ui/icons' }
      },
    },
  ]
  if (options.directives !== false) {
    resolvers.push({
      type: 'directive',
      resolve(name) {
        const directive = Object.hasOwn(directives, name) ? directives[name] : undefined
        if (!directive || excluded(name, options.exclude)) return
        return {
          name: directive.name,
          from: 'dou-ui',
          sideEffects: styleOf(directive.dir, options),
        }
      },
    })
  }
  return resolvers
}

/**
 * Resolve the functions of DouUI (`toast`, `dialog`, `useDialog`,
 * `vLoading`, `vInfiniteScroll`, `useSortable`, `useColorMode`,
 * `useCountdown`) for an auto-import plugin, with the styles of what they show.
 *
 * ```ts
 * AutoImport({ resolvers: [DouUIApiResolver()] })
 * ```
 */
export function DouUIApiResolver(
  options: Pick<DouUIResolverOptions, 'importStyle' | 'exclude'> = {},
): ResolverFunction {
  return (name) => {
    if (!Object.hasOwn(functionDirs, name) || excluded(name, options.exclude)) return
    return { name, from: 'dou-ui', sideEffects: styleOf(functionDirs[name]!, options) }
  }
}

export { componentDirs, iconNames }
