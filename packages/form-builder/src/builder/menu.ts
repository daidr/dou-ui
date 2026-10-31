import { h } from 'vue'
import type { Component, VNode } from 'vue'
import { DouDropdownItem } from 'dou-ui'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  CornerLeftUpIcon,
  SquareDashedIcon,
  TrashIcon,
} from '@dou-ui/icons'
import type { FormNode } from '../core/types'
import type { BuilderState } from './context'
import { formNodePlaces } from './core/transaction'

/** An item of a node's menu, built in or from an extension. */
export interface NodeMenuEntry {
  key: string
  label: string
  icon?: Component
  run: () => void
  disabled?: boolean
  tone?: 'neutral' | 'danger'
  /** A line above it, between the built-in items and an extension's. */
  divided?: boolean
}

/** The menu of some nodes: move, copy, group and delete them, then the extensions' items. */
export function nodeMenu(state: BuilderState, ids: readonly string[]): NodeMenuEntry[] {
  const messages = state.messages
  const map = formNodePlaces(state.document)
  const places = ids.flatMap((id) => {
    const place = map.get(id)
    return place ? [place] : []
  })
  if (!places.length) return []
  const parents = new Set(places.map((place) => place.parent?.id ?? null))
  const one = places.length === 1 ? places[0]! : undefined
  const siblings = one?.parent ? one.parent.children.length : state.document.nodes.length
  const pages = places.some((place) => place.node.type === 'page')
  const entries: NodeMenuEntry[] = []
  if (one?.parent)
    entries.push({
      key: 'parent',
      label: messages.actions.parent,
      icon: CornerLeftUpIcon,
      run: () => state.selectParent(),
    })
  entries.push(
    {
      key: 'up',
      label: messages.actions.up,
      icon: ArrowUpIcon,
      run: () => state.moveBy(-1, ids),
      disabled: !!one && !one.index,
    },
    {
      key: 'down',
      label: messages.actions.down,
      icon: ArrowDownIcon,
      run: () => state.moveBy(1, ids),
      disabled: !!one && one.index >= siblings - 1,
    },
    {
      key: 'duplicate',
      label: messages.actions.duplicate,
      icon: CopyIcon,
      run: () => state.duplicate(ids),
    },
  )
  if (parents.size === 1 && !pages)
    entries.push({
      key: 'wrap',
      label: messages.actions.wrap,
      icon: SquareDashedIcon,
      run: () => state.wrap(ids),
    })
  entries.push({
    key: 'remove',
    label: messages.actions.remove,
    icon: TrashIcon,
    run: () => state.remove(ids),
    tone: 'danger',
  })
  const nodes: FormNode[] = places.map((place) => place.node)
  const extra = state.extensions().menus.flatMap((menu) => menu(state, nodes))
  extra.forEach((item, index) => entries.push({ ...item, divided: index === 0 }))
  return entries
}

/** The entries as items of a dropdown or a context menu. */
export function menuItems(entries: readonly NodeMenuEntry[]): VNode[] {
  return entries.map((entry) =>
    h(
      DouDropdownItem,
      {
        key: entry.key,
        disabled: entry.disabled,
        tone: entry.tone ?? 'neutral',
        divided: entry.divided,
        onClick: entry.run,
      },
      { prefix: entry.icon ? () => h(entry.icon!) : undefined, default: () => entry.label },
    ),
  )
}
