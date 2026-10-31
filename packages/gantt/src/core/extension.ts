import type { Component } from 'vue'
import type { GanttContext } from '../context'
import type { GanttColumn, GanttMarker, GanttMove } from '../types'
import type { GanttLink } from './model'
import type { GanttDocument } from './transaction'

/** What an extension's hooks receive; the same as `useGantt()`. */
export type GanttExtensionContext = GanttContext

/**
 * A key handler: return `false` to let the key through to the next handler
 * and the chart's own keys; anything else means it was handled.
 */
export type GanttKeyHandler = (event: KeyboardEvent) => boolean | void

/**
 * A piece of the Gantt chart: table columns, rules for links and moves,
 * keys, marker lines and extra layers. A third-party extension can do
 * anything the chart's own props can.
 */
export interface GanttExtension {
  name: string
  /** Higher runs first: its keys and rules are asked before others. Defaults to 100. */
  priority?: number
  /** Columns added after the table's own. */
  columns?: GanttColumn[]
  /** A link rule, asked with `can-link`. Return `true` to allow, or a sentence saying why not. */
  canLink?: (link: Pick<GanttLink, 'from' | 'to' | 'type'>, doc: GanttDocument) => boolean | string
  /** A rule for new dates, asked with `can-move`. */
  canMove?: (move: GanttMove, doc: GanttDocument) => boolean | string
  /** Keys, written as in `useHotkey` (e.g. `mod+d`, `shift+t`), while the chart has focus. */
  keymap?: (context: GanttExtensionContext) => Record<string, GanttKeyHandler>
  /** Vertical marker lines, such as a release day; worked out again when what they read changes. */
  markers?: (context: GanttExtensionContext) => GanttMarker[]
  /**
   * Components drawn on the timeline, in its own coordinates: `below` under
   * the dependency lines, `above` over the bars. They scroll with it.
   */
  layers?: { below?: Component[]; above?: Component[] }
  /** Components drawn over the chart, not scrolled, e.g. a panel. They can call `useGantt()`. */
  overlays?: Component[]
}

/** Declares an extension; only gives it a type. */
export function defineGanttExtension(extension: GanttExtension): GanttExtension {
  return extension
}

/** Everything the extensions contribute, gathered once per list. */
export interface ResolvedGanttExtensions {
  extensions: GanttExtension[]
  columns: GanttColumn[]
  linkRules: NonNullable<GanttExtension['canLink']>[]
  moveRules: NonNullable<GanttExtension['canMove']>[]
  keymaps: NonNullable<GanttExtension['keymap']>[]
  markers: NonNullable<GanttExtension['markers']>[]
  below: Component[]
  above: Component[]
  overlays: Component[]
}

type ExtensionList = readonly (GanttExtension | readonly GanttExtension[])[]

function flatten(list: ExtensionList): GanttExtension[] {
  const out: GanttExtension[] = []
  for (const item of list) {
    if (Array.isArray(item)) out.push(...flatten(item))
    else out.push(item as GanttExtension)
  }
  return out
}

/** Sorts the extensions by priority and collects what they add. */
export function resolveGanttExtensions(list: ExtensionList = []): ResolvedGanttExtensions {
  const extensions = flatten(list)
    .map((extension, index) => ({ extension, index }))
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    .sort(
      (a, b) => (b.extension.priority ?? 100) - (a.extension.priority ?? 100) || a.index - b.index,
    )
    .map((entry) => entry.extension)

  const names = new Set<string>()
  for (const extension of extensions) {
    if (names.has(extension.name))
      throw new Error(`[@dou-ui/gantt] the extension "${extension.name}" is added twice`)
    names.add(extension.name)
  }

  const pick = <K extends keyof GanttExtension>(key: K) =>
    extensions.flatMap((e) => (e[key] ? [e[key]] : [])) as NonNullable<GanttExtension[K]>[]

  return {
    extensions,
    columns: extensions.flatMap((e) => e.columns ?? []),
    linkRules: pick('canLink'),
    moveRules: pick('canMove'),
    keymaps: pick('keymap'),
    markers: pick('markers'),
    below: extensions.flatMap((e) => e.layers?.below ?? []),
    above: extensions.flatMap((e) => e.layers?.above ?? []),
    overlays: extensions.flatMap((e) => e.overlays ?? []),
  }
}
