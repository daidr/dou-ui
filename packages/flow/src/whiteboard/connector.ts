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
} from '@dou-ui/icons'
import type { Component } from 'vue'
import type { FlowEditorContext } from '../context'
import { bezierEdge, defineEdgeType, stepEdge, type EdgeAnchor } from '../core/edge-types'
import type { FlowMenuItem, FlowToolbarItem } from '../core/menu'
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
  const first = data(edges[0]!)

  function set(patch: WhiteboardConnectorData, said: string) {
    ctx.transact((tr) => {
      for (const edge of edges) tr.updateEdge(edge.id, { data: { ...edge.data, ...patch } })
    })
    ctx.announce(said)
  }

  /** A button that opens its choices under it. */
  function choice(
    key: string,
    label: string,
    icon: Component,
    items: FlowMenuItem[],
  ): FlowToolbarItem {
    return {
      key,
      label,
      icon,
      run(event) {
        const button = event.currentTarget as HTMLElement
        const box = button.getBoundingClientRect()
        ctx.showMenu(items, { x: box.left, y: box.bottom + 4 }, button)
      },
    }
  }

  const route = first.route ?? 'straight'
  const dash = first.dash ?? 'solid'
  const arrow = first.arrow ?? 'end'
  const all = <K extends keyof WhiteboardConnectorData>(
    key: K,
    value: unknown,
    fallback: unknown,
  ) => edges.every((edge) => (data(edge)[key] ?? fallback) === value)

  return [
    choice(
      'route',
      format(t.routeOf, { value: t.routes[route] }),
      ROUTES.find((item) => item.value === route)!.icon,
      ROUTES.map((item) => ({
        key: `route-${item.value}`,
        label: t.routes[item.value],
        icon: item.icon,
        checked: all('route', item.value, 'straight'),
        run: () => set({ route: item.value }, format(t.routeSet, { value: t.routes[item.value] })),
      })),
    ),
    choice(
      'dash',
      format(t.dashOf, { value: t.dashes[dash] }),
      DASH_CHOICES.find((item) => item.value === dash)!.icon,
      DASH_CHOICES.map(({ value, icon }) => ({
        key: `dash-${value}`,
        label: t.dashes[value],
        icon,
        checked: all('dash', value, 'solid'),
        run: () => set({ dash: value }, format(t.dashSet, { value: t.dashes[value] })),
      })),
    ),
    choice(
      'arrow',
      format(t.arrowOf, { value: t.arrows[arrow] }),
      ARROWS.find((item) => item.value === arrow)!.icon,
      ARROWS.map((item) => ({
        key: `arrow-${item.value}`,
        label: t.arrows[item.value],
        icon: item.icon,
        checked: all('arrow', item.value, 'end'),
        run: () => set({ arrow: item.value }, format(t.arrowSet, { value: t.arrows[item.value] })),
      })),
    ),
  ]
}
