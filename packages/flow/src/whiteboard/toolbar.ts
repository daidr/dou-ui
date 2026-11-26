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
  normalizeOpaqueColor,
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

/** Shallow-compares two optional data objects so no-op color picks skip empty history steps. */
export function sameData(a: FlowData | undefined, b: FlowData | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) return false
  }
  return true
}

/** Shared value across a selection, or `null` when items disagree (mixed). */
export function sharedValue(values: (string | undefined)[]): string | null | undefined {
  const set = new Set(values)
  return set.size === 1 ? [...set][0] : null
}

let dragSeq = 0
const activeGroups = new WeakMap<FlowEditorContext, { scope: string; id: number }>()

/** Allocates or closes a transaction group so live drags in `DouColorPanel` undo as one step. */
export function colorTransactionMeta(
  ctx: FlowEditorContext,
  scope: string,
  live: boolean,
): { group?: string } | undefined {
  const current = activeGroups.get(ctx)
  if (live) {
    const entry = current?.scope === scope ? current : { scope, id: ++dragSeq }
    activeGroups.set(ctx, entry)
    return { group: `board-color:${entry.id}` }
  }
  if (current) {
    activeGroups.delete(ctx)
    if (current.scope === scope) return { group: `board-color:${current.id}` }
  }
  return undefined
}

/** Drops any unclosed live-drag group when the popover closes or selection changes. */
export function resetColorGroup(ctx: FlowEditorContext, scope?: string) {
  const current = activeGroups.get(ctx)
  if (current && (!scope || current.scope === scope)) activeGroups.delete(ctx)
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
  /** Scope including the selected targets so live drags on different items never merge. */
  scope?: string
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
  const {
    ctx,
    key,
    scope = key,
    kind,
    icon,
    value,
    swatch,
    disabled,
    labelOf,
    announceSet,
    noneOption,
    apply,
  } = options
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
        apply(next, colorTransactionMeta(ctx, scope, live))
        if (!live) {
          const nextName = colorDisplayName(next, ctx.messages.value.board, noneOption?.label)
          ctx.announce(format(announceSet, { value: nextName }))
        }
      },
      close() {
        resetColorGroup(ctx, scope)
      },
    },
  }
}

function effectiveFill(node: FlowNode): string | undefined {
  if (isShape(node)) {
    const data = (node.data ?? {}) as WhiteboardShapeData
    const fill = normalizeColorValue(data.fill)
    const valid = fill && resolveFillColor(fill, 'shape') ? fill : undefined
    return valid ?? (data.tone && data.tone !== 'neutral' ? data.tone : undefined)
  }
  if (isSticky(node)) {
    const data = (node.data ?? {}) as WhiteboardStickyData
    const fill = normalizeColorValue(data.fill)
    const valid = fill && resolveFillColor(fill, 'sticky') ? fill : undefined
    return valid ?? (data.tone && data.tone !== 'warning' ? data.tone : undefined)
  }
  return undefined
}

function effectiveStroke(node: FlowNode): string | undefined {
  const data = (node.data ?? {}) as WhiteboardShapeData
  const stroke = normalizeColorValue(data.stroke)
  const valid = stroke && resolveStrokeColor(stroke) ? stroke : undefined
  return valid ?? (data.tone && data.tone !== 'neutral' ? data.tone : undefined)
}

function effectiveTextColor(node: FlowNode): string | undefined {
  const raw = isText(node)
    ? normalizeOpaqueColor((node.data as WhiteboardTextData | undefined)?.color)
    : normalizeOpaqueColor(
        (node.data as WhiteboardShapeData | WhiteboardStickyData | undefined)?.textColor,
      )
  return raw && resolveTextColor(raw) ? raw : undefined
}

function effectiveInkColor(node: FlowNode): string | undefined {
  const data = (node.data ?? {}) as WhiteboardInkData
  const raw = normalizeOpaqueColor(data.color)
  const valid = raw && resolveStrokeColor(raw) ? raw : undefined
  return valid ?? (data.tone && data.tone !== 'neutral' ? data.tone : undefined)
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
  const targetKey = nodes
    .map((node) => node.id)
    .toSorted()
    .join(',')
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
        scope: `board-fill:n:${targetKey}`,
        kind: 'fill',
        icon: PaintBucketIcon,
        value,
        swatch: swatch === 'none' ? undefined : swatch,
        disabled: allLocked,
        labelOf: t.fillOf,
        announceSet: t.fillSet,
        noneOption: { value: 'none', label: t.fillNone },
        apply(next, meta) {
          const targets = editable()
          if (!targets.length) return
          ctx.transact((tr) => {
            for (const node of targets) {
              const current = tr.getNode(node.id)
              if (!current || effectiveFill(current) === next) continue
              if (isShape(current)) {
                const data = (current.data ?? {}) as WhiteboardShapeData
                const patch: Record<string, unknown> = { fill: next }
                // Preserve untouched stroke from legacy `tone` before dropping `tone`
                // so clearing fill later returns to neutral default instead of snapping back.
                if (data.tone !== undefined) {
                  patch.tone = undefined
                  if (data.tone !== 'neutral' && data.stroke === undefined) patch.stroke = data.tone
                }
                const nextData = cleanData(current.data, patch)
                if (!sameData(current.data, nextData)) tr.updateNode(current.id, { data: nextData })
              } else if (isSticky(current)) {
                const nextData = cleanData(current.data, { fill: next, tone: undefined })
                if (!sameData(current.data, nextData)) tr.updateNode(current.id, { data: nextData })
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
        scope: `board-stroke:n:${targetKey}`,
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
              if (!current || effectiveStroke(current) === next) continue
              const data = (current.data ?? {}) as WhiteboardShapeData
              const patch: Record<string, unknown> = { stroke: next }
              if (data.tone !== undefined) {
                patch.tone = undefined
                if (data.tone !== 'neutral' && data.fill === undefined) patch.fill = data.tone
              }
              const nextData = cleanData(current.data, patch)
              if (!sameData(current.data, nextData)) tr.updateNode(current.id, { data: nextData })
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
        scope: `board-text-color:n:${targetKey}`,
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
              if (!current || effectiveTextColor(current) === color) continue
              const field = isText(current) ? 'color' : 'textColor'
              const nextData = cleanData(current.data, { [field]: color })
              if (!sameData(current.data, nextData)) tr.updateNode(current.id, { data: nextData })
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
        scope: `board-ink-color:n:${targetKey}`,
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
              if (!current || effectiveInkColor(current) === color) continue
              const nextData = cleanData(current.data, { color, tone: undefined })
              if (!sameData(current.data, nextData)) tr.updateNode(current.id, { data: nextData })
            }
          }, meta)
        },
      }),
    )
  }

  return items
}
