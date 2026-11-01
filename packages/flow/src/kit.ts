import type { ContextMenuItem } from 'dou-ui'
import {
  ClipboardPasteIcon,
  CopyIcon,
  CopyPlusIcon,
  EditIcon,
  GroupIcon,
  FocusIcon,
  HierarchyHorizontalIcon,
  MoreHorizontalIcon,
  ScissorsIcon,
  SquareDashedIcon,
  TrashIcon,
  UngroupIcon,
} from '@dou-ui/icons'
import { defaultNode } from './components/default-node'
import { groupNode } from './components/group-node'
import { bezierEdge, stepEdge, straightEdge } from './core/edge-types'
import { defineFlowExtension, type FlowExtension } from './core/extension'
import { layers, stacking } from './layers'

export interface FlowKitOptions {
  /** The built-in context menu items: copy, paste, delete and so on. */
  menu?: boolean
  /** The toolbar over the selected nodes: duplicate, delete and more. */
  toolbar?: boolean
  /** The `group` node type, with its menu items and `mod+g` / `mod+shift+g`. */
  group?: boolean
  /**
   * Moving nodes up and down the stack: menu items and `mod+]` / `mod+[`,
   * with Shift for the very top or bottom.
   */
  layers?: boolean
}

/** Copy, paste, delete and the rest, on right click. */
const editMenu = defineFlowExtension({
  name: 'edit-menu',
  // Last, so extensions' own items come first.
  priority: 0,
  contextMenu(ctx, target) {
    const t = ctx.messages.value
    const editable = !ctx.readonly.value
    const items: ContextMenuItem[] = []
    if (target.kind === 'canvas') {
      if (editable)
        items.push({
          key: 'paste',
          label: t.paste,
          icon: ClipboardPasteIcon,
          shortcut: 'mod+v',
          run: () => void ctx.paste(target.point),
        })
      items.push({
        key: 'select-all',
        label: t.selectAll,
        icon: SquareDashedIcon,
        shortcut: 'mod+a',
        disabled: !ctx.doc.value.nodes.length,
        run: ctx.selectAll,
      })
      if (editable)
        items.push({
          key: 'tidy',
          label: t.tidy,
          icon: HierarchyHorizontalIcon,
          divided: true,
          disabled: !ctx.doc.value.nodes.length,
          run: () => ctx.tidy(),
        })
      items.push({
        key: 'fit',
        label: t.fit,
        icon: FocusIcon,
        divided: !editable,
        disabled: !ctx.doc.value.nodes.length,
        run: () => ctx.fit(),
      })
      return items
    }
    if (target.kind === 'node') {
      items.push({ key: 'copy', label: t.copy, icon: CopyIcon, shortcut: 'mod+c', run: ctx.copy })
      if (!editable) return items
      // The menu acts on the selection, which the node just joined if it wasn't in it.
      const selected = ctx.selection.value.nodes
      const ids = selected.includes(target.node.id) ? selected : [target.node.id]
      const locked = ids.every((id) => ctx.doc.value.nodes.find((n) => n.id === id)?.locked)
      items.push(
        {
          key: 'cut',
          label: t.cut,
          icon: ScissorsIcon,
          shortcut: 'mod+x',
          disabled: locked,
          run: ctx.cut,
        },
        {
          key: 'duplicate',
          label: t.duplicate,
          icon: CopyPlusIcon,
          shortcut: 'mod+d',
          run: ctx.duplicate,
        },
        {
          key: 'delete',
          label: t.delete,
          icon: TrashIcon,
          shortcut: 'delete',
          tone: 'danger',
          divided: true,
          disabled: locked,
          run: ctx.deleteSelection,
        },
      )
      return items
    }
    if (!editable) return items
    const edge = target.edge
    items.push(
      {
        key: 'edit-label',
        label: t.editLabel,
        icon: EditIcon,
        shortcut: 'enter',
        run: () => ctx.editLabel(edge.id),
      },
      {
        key: 'delete',
        label: t.delete,
        icon: TrashIcon,
        shortcut: 'delete',
        tone: 'danger',
        divided: true,
        run: ctx.deleteSelection,
      },
    )
    return items
  },
})

/** Duplicate, delete and the node menu, over the selected nodes; delete over selected edges. */
const editToolbar = defineFlowExtension({
  name: 'edit-toolbar',
  priority: 0,
  edgeToolbarItems(ctx) {
    const t = ctx.messages.value
    return [
      {
        key: 'delete',
        label: t.delete,
        icon: TrashIcon,
        shortcut: 'delete',
        run: ctx.deleteSelection,
      },
    ]
  },
  toolbarItems(ctx, nodes) {
    const t = ctx.messages.value
    // the node menu, as a right click on the first selected node opens it
    const first = nodes[0]!
    const more = ctx.menuItems({ kind: 'node', node: first, point: { x: first.x, y: first.y } })
    return [
      {
        key: 'duplicate',
        label: t.duplicate,
        icon: CopyPlusIcon,
        shortcut: 'mod+d',
        run: ctx.duplicate,
      },
      {
        key: 'delete',
        label: t.delete,
        icon: TrashIcon,
        shortcut: 'delete',
        disabled: nodes.every((node) => node.locked),
        run: ctx.deleteSelection,
      },
      ...(more.length
        ? [{ key: 'more', label: t.more, icon: MoreHorizontalIcon, children: more }]
        : []),
    ]
  },
})

/** Group nodes: the type, Ctrl / ⌘ + G to group the selection, with Shift to ungroup. */
const groups = defineFlowExtension({
  name: 'groups',
  priority: 0,
  nodeTypes: [groupNode],
  keymap: (ctx) => ({
    'mod+g': () => ctx.groupNodes() !== null,
    // A group goes away; a node inside one comes out of it.
    'mod+shift+g': () => {
      const ids = ctx.selection.value.nodes
      const containers = ids.filter((id) => {
        const node = ctx.doc.value.nodes.find((n) => n.id === id)
        return node && ctx.isContainer(node)
      })
      if (containers.length) return containers.filter((id) => ctx.ungroupNode(id)).length > 0
      return ctx.leaveGroup(ids) > 0
    },
  }),
  contextMenu(ctx, target) {
    if (target.kind !== 'node' || ctx.readonly.value) return []
    const t = ctx.messages.value
    const tree = ctx.tree.value
    const parents = new Set(tree.topmost(ctx.selection.value.nodes).map((id) => tree.parentOf(id)))
    const items: ContextMenuItem[] = [
      {
        key: 'group',
        label: t.makeGroup,
        icon: GroupIcon,
        shortcut: 'mod+g',
        // Nodes from different groups can't share a new frame.
        disabled: parents.size > 1,
        run: () => void ctx.groupNodes(),
      },
    ]
    if (ctx.isContainer(target.node))
      items.push({
        key: 'ungroup',
        label: t.ungroup,
        icon: UngroupIcon,
        shortcut: 'mod+shift+g',
        run: () => void ctx.ungroupNode(target.node.id),
      })
    // A group inside another can be ungrouped or taken out; the shortcut ungroups.
    if (tree.parentOf(target.node.id))
      items.push({
        key: 'leave-group',
        label: t.leaveGroup,
        icon: UngroupIcon,
        shortcut: ctx.isContainer(target.node) ? undefined : 'mod+shift+g',
        run: () => void ctx.leaveGroup(),
      })
    return items
  },
})

/**
 * The editor's built-in parts as extensions: the default node type, the
 * `bezier`, `step` and `straight` edge types, group nodes, stacking order,
 * the context menu and the toolbar over selected nodes. Pass it along with
 * your own extensions, e.g. `[flowKit(), aiNodes]`; without `extensions`
 * the editor uses it alone.
 */
export function flowKit(options: FlowKitOptions = {}): FlowExtension[] {
  const { menu = true, toolbar = true, group = true, layers: layered = true } = options
  const kit = [
    defineFlowExtension({ name: 'default-node', nodeTypes: [defaultNode] }),
    defineFlowExtension({ name: 'default-edges', edgeTypes: [bezierEdge, stepEdge, straightEdge] }),
    stacking,
  ]
  if (menu) kit.push(editMenu)
  if (toolbar) kit.push(editToolbar)
  if (group) kit.push(groups)
  if (layered) kit.push(layers)
  return kit
}
