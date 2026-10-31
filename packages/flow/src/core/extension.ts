import type { Component } from 'vue'
import type { FlowEditorContext } from '../context'
import type { FlowConnection, PortTypes } from './connect'
import type { FlowMenuItem, FlowMenuTarget, FlowToolbarItem } from './menu'
import type { FlowDocument, FlowNode } from './model'
import type { NodeTypeSpec } from './node-types'

/** What an extension's hooks receive; the same as `useFlowEditor()`. */
export type FlowExtensionContext = FlowEditorContext

/**
 * A key handler: return `false` to let the key through to the next handler
 * and the editor's own keys; anything else means it was handled.
 */
export type FlowKeyHandler = (event: KeyboardEvent) => boolean | void

/**
 * A piece of the editor: node types, port types, connection rules, keys and
 * extra layers. The default node type comes as an extension too (see
 * `flowKit`), so a third-party extension stands on equal footing with it.
 */
export interface FlowExtension {
  name: string
  /** Higher runs first: its keys and rules are asked before others. Defaults to 100. */
  priority?: number
  nodeTypes?: NodeTypeSpec<any>[]
  /** Looks and connection rules of port types; see the `port-types` prop. */
  portTypes?: PortTypes
  /**
   * A connection rule, asked after the built-in ones. Return `false` to
   * refuse, or a sentence saying why. Called for every port while dragging.
   */
  canConnect?: (connection: FlowConnection, doc: FlowDocument) => boolean | string
  /** Keys, written as in `useHotkey` (e.g. `mod+g`, `shift+t`), while the canvas has focus. */
  keymap?: (context: FlowExtensionContext) => Record<string, FlowKeyHandler>
  /** Rewrites nodes and edges before they are pasted, e.g. to reset run state. */
  transformPaste?: (data: FlowDocument, context: FlowExtensionContext) => FlowDocument
  /**
   * Components drawn in canvas coordinates: `below` under the edges, `above`
   * over the nodes. They move and zoom with the canvas.
   */
  layers?: { below?: Component[]; above?: Component[] }
  /**
   * Components drawn over the editor in screen space, e.g. a panel or a
   * popup. They can call `useFlowEditor()`.
   */
  overlays?: Component[]
  /**
   * Items for the menu opened by a right click, a long press on the empty
   * canvas, or the context menu key. Extensions' items follow each other
   * in priority order; an empty list leaves them out.
   */
  contextMenu?: (context: FlowExtensionContext, target: FlowMenuTarget) => FlowMenuItem[]
  /** Buttons for the toolbar that floats above the selected nodes. */
  toolbarItems?: (context: FlowExtensionContext, nodes: FlowNode[]) => FlowToolbarItem[]
}

/** Declares an extension; only gives it a type. */
export function defineFlowExtension(extension: FlowExtension): FlowExtension {
  return extension
}

/** Everything the extensions contribute, gathered once per list. */
export interface ResolvedFlowExtensions {
  extensions: FlowExtension[]
  nodeTypes: Map<string, NodeTypeSpec>
  portTypes: PortTypes
  rules: NonNullable<FlowExtension['canConnect']>[]
  keymaps: NonNullable<FlowExtension['keymap']>[]
  pasteTransforms: NonNullable<FlowExtension['transformPaste']>[]
  below: Component[]
  above: Component[]
  overlays: Component[]
  menus: NonNullable<FlowExtension['contextMenu']>[]
  toolbars: NonNullable<FlowExtension['toolbarItems']>[]
}

type ExtensionList = readonly (FlowExtension | readonly FlowExtension[])[]

function flatten(list: ExtensionList): FlowExtension[] {
  const out: FlowExtension[] = []
  for (const item of list) {
    if (Array.isArray(item)) out.push(...flatten(item))
    else out.push(item as FlowExtension)
  }
  return out
}

/** Sorts the extensions by priority and collects what they add. */
export function resolveFlowExtensions(list: ExtensionList): ResolvedFlowExtensions {
  const extensions = flatten(list)
    .map((extension, index) => ({ extension, index }))
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    .sort(
      (a, b) => (b.extension.priority ?? 100) - (a.extension.priority ?? 100) || a.index - b.index,
    )
    .map((entry) => entry.extension)

  const names = new Set<string>()
  const nodeTypes = new Map<string, NodeTypeSpec>()
  const portTypes: PortTypes = {}
  for (const extension of extensions) {
    if (names.has(extension.name))
      throw new Error(`[@dou-ui/flow] the extension "${extension.name}" is added twice`)
    names.add(extension.name)
    for (const spec of extension.nodeTypes ?? []) {
      if (nodeTypes.has(spec.type))
        throw new Error(
          `[@dou-ui/flow] node type "${spec.type}" from "${extension.name}" is already defined`,
        )
      nodeTypes.set(spec.type, spec)
    }
    for (const [name, spec] of Object.entries(extension.portTypes ?? {})) {
      if (name in portTypes)
        throw new Error(
          `[@dou-ui/flow] port type "${name}" from "${extension.name}" is already defined`,
        )
      portTypes[name] = spec
    }
  }

  const pick = <K extends keyof FlowExtension>(key: K) =>
    extensions.flatMap((e) => (e[key] ? [e[key]] : [])) as NonNullable<FlowExtension[K]>[]

  return {
    extensions,
    nodeTypes,
    portTypes,
    rules: pick('canConnect'),
    keymaps: pick('keymap'),
    pasteTransforms: pick('transformPaste'),
    below: extensions.flatMap((e) => e.layers?.below ?? []),
    above: extensions.flatMap((e) => e.layers?.above ?? []),
    overlays: extensions.flatMap((e) => e.overlays ?? []),
    menus: pick('contextMenu'),
    toolbars: pick('toolbarItems'),
  }
}
