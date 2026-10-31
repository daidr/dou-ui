import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ConnectorCurveIcon,
  ConnectorElbowIcon,
  ConnectorStraightIcon,
  LineDashDotIcon,
  LineDashedIcon,
  LineDottedIcon,
  LineSolidIcon,
  MinusIcon,
  RouteIcon,
} from '@dou-ui/icons'
import type { Component } from 'vue'
import type { FlowEditorContext } from '../context'
import { bezierEdge, defineEdgeType, stepEdge, type EdgeAnchor } from '../core/edge-types'
import type { FlowToolbarItem } from '../core/menu'
import type { FlowEdge, Point, PortSide } from '../core/model'
import { format } from '../locale'
import type {
  WhiteboardArrow,
  WhiteboardConnectorData,
  WhiteboardDash,
  WhiteboardRoute,
} from './model'

const ARROW = { length: 10, spread: 0.45 }
const r2 = (v: number) => Math.round(v * 100) / 100
const p = (pt: Point) => `${r2(pt.x)} ${r2(pt.y)}`

/** Out of a side, away from the node. */
const outward: Record<PortSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
}

/** An open arrowhead with its tip at `tip`, pointing along `angle`. */
function arrowhead(tip: Point, angle: number) {
  const wing = (spread: number) => ({
    x: tip.x - ARROW.length * Math.cos(angle + spread),
    y: tip.y - ARROW.length * Math.sin(angle + spread),
  })
  return `M${p(wing(ARROW.spread))}L${p(tip)}L${p(wing(-ARROW.spread))}`
}

/** The way a run arrives at `end`: straight from `from`, or into the side it faces. */
function arrival(end: EdgeAnchor, from: Point, straight: boolean) {
  if (straight) return Math.atan2(end.y - from.y, end.x - from.x)
  const out = outward[end.side]
  return Math.atan2(-out.y, -out.x)
}

/** Dash patterns, in px of a 1.5px stroke with round ends: a 0 dash is a dot. */
const DASHES: Record<WhiteboardDash, string | undefined> = {
  solid: undefined,
  dashed: '6 5',
  dotted: '0 4',
  'dash-dot': '8 4 0 4',
}

/**
 * The whiteboard's line: straight, with right-angled turns or curved
 * (`data.route`), solid or dashed (`data.dash`), with arrowheads at the end,
 * both ends or neither (`data.arrow`).
 */
export const connectorEdge = defineEdgeType<WhiteboardConnectorData>({
  type: 'connector',
  route(source, target, edge) {
    const data = edge?.data ?? {}
    const route = data.route ?? 'straight'
    const straight = route === 'straight'
    const base = straight
      ? {
          path: `M${p(source)}L${p(target)}`,
          label: { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 },
        }
      : (route === 'elbow' ? stepEdge : bezierEdge).route(source, target, edge as FlowEdge)
    const arrow = data.arrow ?? 'end'
    let marks = ''
    if (arrow !== 'none') marks += arrowhead(target, arrival(target, source, straight))
    if (arrow === 'both') marks += arrowhead(source, arrival(source, target, straight))
    return { ...base, marks: marks || undefined }
  },
  style(edge) {
    const dash = DASHES[edge.data?.dash ?? 'solid']
    return dash ? { strokeDasharray: dash } : undefined
  },
})

const ROUTES: { value: WhiteboardRoute; icon: Component }[] = [
  { value: 'straight', icon: ConnectorStraightIcon },
  { value: 'elbow', icon: ConnectorElbowIcon },
  { value: 'curve', icon: ConnectorCurveIcon },
]
const DASH_CHOICES: { value: WhiteboardDash; icon: Component }[] = [
  { value: 'solid', icon: LineSolidIcon },
  { value: 'dashed', icon: LineDashedIcon },
  { value: 'dotted', icon: LineDottedIcon },
  { value: 'dash-dot', icon: LineDashDotIcon },
]
const ARROWS: { value: WhiteboardArrow; icon: Component }[] = [
  { value: 'none', icon: MinusIcon },
  { value: 'end', icon: ArrowRightIcon },
  { value: 'both', icon: ArrowLeftRightIcon },
]

const data = (edge: FlowEdge) => (edge.data ?? {}) as WhiteboardConnectorData
const isConnector = (edge: FlowEdge) => (edge.type ?? 'connector') === 'connector'

/** Route, dash and arrow choices over the selected connectors. */
export function connectorToolbar(ctx: FlowEditorContext, edges: FlowEdge[]): FlowToolbarItem[] {
  if (!edges.every(isConnector)) return []
  const t = ctx.messages.value.board

  /**
   * One button: its label and icon say the value in use, or that the
   * selected connectors differ; its menu sets one value on all of them.
   */
  function choice<V extends string>(
    key: 'route' | 'dash' | 'arrow',
    fallback: V,
    options: { value: V; icon: Component }[],
    names: Record<V, string>,
    text: { of: string; set: string },
    mixedIcon: Component,
  ): FlowToolbarItem {
    const values = new Set(edges.map((edge) => (data(edge)[key] as V | undefined) ?? fallback))
    const only = values.size === 1 ? [...values][0]! : null
    return {
      key,
      label: format(text.of, { value: only ? names[only] : t.mixed }),
      icon: only ? options.find((item) => item.value === only)!.icon : mixedIcon,
      menu: () =>
        options.map((item) => ({
          key: `${key}-${item.value}`,
          label: names[item.value],
          icon: item.icon,
          checked: item.value === only,
          run() {
            ctx.transact((tr) => {
              for (const edge of edges)
                tr.updateEdge(edge.id, { data: { ...edge.data, [key]: item.value } })
            })
            ctx.announce(format(text.set, { value: names[item.value] }))
          },
        })),
    }
  }

  return [
    choice('route', 'straight', ROUTES, t.routes, { of: t.routeOf, set: t.routeSet }, RouteIcon),
    choice(
      'dash',
      'solid',
      DASH_CHOICES,
      t.dashes,
      { of: t.dashOf, set: t.dashSet },
      LineDashDotIcon,
    ),
    choice(
      'arrow',
      'end',
      ARROWS,
      t.arrows,
      { of: t.arrowOf, set: t.arrowSet },
      ArrowLeftRightIcon,
    ),
  ]
}
