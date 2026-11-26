import {
  BaselineIcon,
  PaintBucketIcon,
  PaletteIcon,
  SquareDashedIcon,
  SquareIcon,
} from '@dou-ui/icons'
import type { Component } from 'vue'
import type { FlowEditorContext } from '../context'
import type { FlowToolbarColorPreset, FlowToolbarItem } from '../core/menu'
import type { FlowData, FlowNode } from '../core/model'
import { format, type FlowMessages } from '../locale'
import {
  colorDisplayName,
  normalizeColorValue,
  resolveFillColor,
  resolveStrokeColor,
  resolveTextColor,
  whiteboardColors,
} from './colors'
import type {
  WhiteboardInkData,
  WhiteboardShapeData,
  WhiteboardStickyData,
  WhiteboardTextData,
} from './model'

type BoardKind = 'shape' | 'sticky' | 'text' | 'ink'

const isShape = (node: FlowNode) => (node.type ?? 'shape') === 'shape'
const isSticky = (node: FlowNode) => node.type === 'sticky'
const isText = (node: FlowNode) => node.type === 'text'
const isInk = (node: FlowNode) => node.type === 'ink'

function kindOf(node: FlowNode): BoardKind | null {
  if (isShape(node)) return 'shape'
  if (isSticky(node)) return 'sticky'
  if (isText(node)) return 'text'
  if (isInk(node)) return 'ink'
  return null
}

/** Merges `patch` into `base`, omitting keys set to `undefined` for clean JSON data. */
export function cleanData(
  base: FlowData | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return next
}

/** Shared value across a selection, or `null` when items disagree (mixed). */
export function sharedValue(values: (string | undefined)[]): string | null | undefined {
  const set = new Set(values)
  return set.size === 1 ? [...set][0] : null
}

let dragSeq = 0
const activeGroups = new WeakMap<FlowEditorContext, { key: string; id: number }>()

/** Allocates or closes a transaction group so live drags in `DouColorPanel` undo as one step. */
export function colorTransactionMeta(
  ctx: FlowEditorContext,
  key: string,
  live: boolean,
): { group?: string } | undefined {
  const current = activeGroups.get(ctx)
  if (live) {
    const entry = current?.key === key ? current : { key, id: ++dragSeq }
    activeGroups.set(ctx, entry)
    return { group: `board-color:${key}:${entry.id}` }
  }
  if (current?.key === key) {
    activeGroups.delete(ctx)
    return { group: `board-color:${key}:${current.id}` }
  }
  return undefined
}

export function palettePresets(
  kind: 'fill' | 'stroke' | 'text',
  t: FlowMessages['board'],
): FlowToolbarColorPreset[] {
  return whiteboardColors.map((name) => ({
    value: name,
    label: t.colors[name],
    swatch:
      kind === 'fill'
        ? `var(--dou-whiteboard-fill-${name})`
        : `var(--dou-whiteboard-color-${name})`,
  }))
}

export interface ColorToolbarOptions {
  ctx: FlowEditorContext
  key: string
  kind: 'fill' | 'stroke' | 'text'
  icon: Component
  value: string | null | undefined
  swatch: string | undefined
  disabled?: boolean
  labelOf: string
  announceSet: string
  noneOption?: { value: string; label: string; icon?: Component }
  apply: (value: string | undefined, meta?: { group?: string }) => void
}

/** Builds one color-picker toolbar item shared by board nodes and connectors. */
export function colorToolbarItem(options: ColorToolbarOptions): FlowToolbarItem {
  const { ctx, key, kind, icon, value, swatch, disabled, labelOf, announceSet, noneOption, apply } =
    options
  const t = ctx.messages.value.board
  const isNone = !!noneOption && value === noneOption.value
  const display = colorDisplayName(value, t, noneOption?.label)
  return {
    key,
    label: format(labelOf, { value: display }),
    icon,
    disabled,
    color: {
      value,
      kind,
      swatch: isNone ? undefined : swatch,
      none: isNone,
      defaultLabel: t.colorDefault,
      noneOption,
      presets: palettePresets(kind, t),
      customLabel: t.colorCustom,
      select(next, opts) {
        const live = !!opts?.live
        apply(next, colorTransactionMeta(ctx, key, live))
        if (!live) {
          const nextName = colorDisplayName(next, ctx.messages.value.board, noneOption?.label)
          ctx.announce(format(announceSet, { value: nextName }))
        }
      },
    },
  }
}

function effectiveFill(node: FlowNode): string | undefined {
  if (isShape(node)) {
    const data = (node.data ?? {}) as WhiteboardShapeData
    return (
      normalizeColorValue(data.fill) ??
      (data.tone && data.tone !== 'neutral' ? data.tone : undefined)
    )
  }
  if (isSticky(node)) {
    const data = (node.data ?? {}) as WhiteboardStickyData
    return (
      normalizeColorValue(data.fill) ??
      (data.tone && data.tone !== 'warning' ? data.tone : undefined)
    )
  }
  return undefined
}

function effectiveStroke(node: FlowNode): string | undefined {
  const data = (node.data ?? {}) as WhiteboardShapeData
  return (
    normalizeColorValue(data.stroke) ??
    (data.tone && data.tone !== 'neutral' ? data.tone : undefined)
  )
}

function effectiveTextColor(node: FlowNode): string | undefined {
  if (isText(node)) return normalizeColorValue((node.data as WhiteboardTextData | undefined)?.color)
  return normalizeColorValue(
    (node.data as WhiteboardShapeData | WhiteboardStickyData | undefined)?.textColor,
  )
}

function effectiveInkColor(node: FlowNode): string | undefined {
  const data = (node.data ?? {}) as WhiteboardInkData
  return (
    normalizeColorValue(data.color) ??
    (data.tone && data.tone !== 'neutral' ? data.tone : undefined)
  )
}

/**
 * Fill, border (with borderless toggle), text color and ink color controls
 * over the selected whiteboard nodes.
 */
export function boardNodeToolbar(ctx: FlowEditorContext, nodes: FlowNode[]): FlowToolbarItem[] {
  const kinds = nodes.map(kindOf)
  if (kinds.some((k) => k === null)) return []
  const t = ctx.messages.value.board
  const allLocked = nodes.every((node) => node.locked)
  const editable = () => nodes.filter((node) => !node.locked)
  const items: FlowToolbarItem[] = []

  const allShapes = kinds.every((k) => k === 'shape')
  const allFillable = kinds.every((k) => k === 'shape' || k === 'sticky')
  const allWritable = kinds.every((k) => k === 'shape' || k === 'sticky' || k === 'text')
  const allInk = kinds.every((k) => k === 'ink')

  if (allFillable) {
    const value = sharedValue(nodes.map(effectiveFill))
    const fillKind = allShapes ? 'shape' : 'sticky'
    const swatch = value && value !== 'none' ? resolveFillColor(value, fillKind) : undefined
    items.push(
      colorToolbarItem({
        ctx,
        key: 'board-fill',
        kind: 'fill',
        icon: PaintBucketIcon,
        value,
        swatch: swatch === 'none' ? undefined : swatch,
        disabled: allLocked,
        labelOf: t.fillOf,
        announceSet: t.fillSet,
        noneOption: allShapes ? { value: 'none', label: t.fillNone } : undefined,
        apply(next, meta) {
          const targets = editable()
          if (!targets.length) return
          ctx.transact((tr) => {
            for (const node of targets) {
              const current = tr.getNode(node.id)
              if (!current) continue
              if (isShape(current)) {
                const data = (current.data ?? {}) as WhiteboardShapeData
                const patch: Record<string, unknown> = { fill: next }
                // Preserve untouched stroke from legacy `tone` before dropping `tone`
                // so clearing fill later returns to neutral default instead of snapping back.
                if (data.tone !== undefined) {
                  patch.tone = undefined
                  if (data.tone !== 'neutral' && data.stroke === undefined) patch.stroke = data.tone
                }
                tr.updateNode(current.id, { data: cleanData(current.data, patch) })
              } else if (isSticky(current)) {
                tr.updateNode(current.id, {
                  data: cleanData(current.data, { fill: next, tone: undefined }),
                })
              }
            }
          }, meta)
        },
      }),
    )
  }

  if (allShapes) {
    const value = sharedValue(nodes.map(effectiveStroke))
    const borderless = value === 'none'
    const swatch = value && !borderless ? resolveStrokeColor(value) : undefined
    items.push(
      colorToolbarItem({
        ctx,
        key: 'board-stroke',
        kind: 'stroke',
        icon: borderless ? SquareDashedIcon : SquareIcon,
        value,
        swatch: swatch === 'none' ? undefined : swatch,
        disabled: allLocked,
        labelOf: t.strokeOf,
        announceSet: t.strokeSet,
        noneOption: { value: 'none', label: t.borderNone, icon: SquareDashedIcon },
        apply(next, meta) {
          const targets = editable()
          if (!targets.length) return
          ctx.transact((tr) => {
            for (const node of targets) {
              const current = tr.getNode(node.id)
              if (!current) continue
              const data = (current.data ?? {}) as WhiteboardShapeData
              const patch: Record<string, unknown> = { stroke: next }
              if (data.tone !== undefined) {
                patch.tone = undefined
                if (data.tone !== 'neutral' && data.fill === undefined) patch.fill = data.tone
              }
              tr.updateNode(current.id, { data: cleanData(current.data, patch) })
            }
          }, meta)
        },
      }),
    )
  }

  if (allWritable) {
    const value = sharedValue(nodes.map(effectiveTextColor))
    const swatch = value ? resolveTextColor(value) : undefined
    items.push(
      colorToolbarItem({
        ctx,
        key: 'board-text-color',
        kind: 'text',
        icon: BaselineIcon,
        value,
        swatch,
        disabled: allLocked,
        labelOf: t.textColorOf,
        announceSet: t.textColorSet,
        apply(next, meta) {
          const targets = editable()
          if (!targets.length) return
          const color = next === 'none' ? undefined : next
          ctx.transact((tr) => {
            for (const node of targets) {
              const current = tr.getNode(node.id)
              if (!current) continue
              const field = isText(current) ? 'color' : 'textColor'
              tr.updateNode(current.id, { data: cleanData(current.data, { [field]: color }) })
            }
          }, meta)
        },
      }),
    )
  }

  if (allInk) {
    const value = sharedValue(nodes.map(effectiveInkColor))
    const swatch = value ? resolveStrokeColor(value) : undefined
    items.push(
      colorToolbarItem({
        ctx,
        key: 'board-ink-color',
        kind: 'stroke',
        icon: PaletteIcon,
        value,
        swatch: swatch === 'none' ? undefined : swatch,
        disabled: allLocked,
        labelOf: t.lineColorOf,
        announceSet: t.lineColorSet,
        apply(next, meta) {
          const targets = editable()
          if (!targets.length) return
          const color = next === 'none' ? undefined : next
          ctx.transact((tr) => {
            for (const node of targets) {
              const current = tr.getNode(node.id)
              if (!current) continue
              tr.updateNode(current.id, {
                data: cleanData(current.data, { color, tone: undefined }),
              })
            }
          }, meta)
        },
      }),
    )
  }

  return items
}
