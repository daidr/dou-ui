import type { Tone } from 'dou-ui'
import type { FlowDocument, FlowEndpoint, FlowPortSpec } from './model'

/*
 * Whether two ports may be joined. The rules come in layers, each one
 * optional, so a flow without types works without any of them:
 *
 * 1. Ports without a `dataType` take anything.
 * 2. Ports with types join when they share one, or either is `'any'`.
 * 3. A registered port type can accept other types too, and has its own look.
 * 4. `canConnect` has the last word.
 */

export type PortShape = 'circle' | 'square' | 'diamond' | 'triangle'

export interface PortTypeSpec {
  /** Shown to screen readers and in tooltips. */
  label?: string
  shape?: PortShape
  /** A theme tone, or any CSS color. Also colors the edges leaving the port. */
  color?: Tone | (string & {})
  /** Edge width in px; 1 by default. */
  edgeWidth?: number
  /** Draw edges of this type dashed. */
  dashed?: boolean
  /** Other types a port of this type takes. */
  accepts?: string[]
}

export type PortTypes = Record<string, PortTypeSpec>

export interface FlowConnection {
  source: Required<FlowEndpoint>
  target: Required<FlowEndpoint>
}

export interface ConnectOptions {
  portTypes?: PortTypes
  /** Refuse edges that would close a cycle. */
  acyclic?: boolean
  /**
   * The last check. Return `false` to refuse, or a sentence saying why, which
   * is announced to screen readers. Called for every port while dragging.
   */
  canConnect?: (connection: FlowConnection, doc: FlowDocument) => boolean | string
}

/** Why two ports can't be joined. */
export type JoinRefusal =
  | { reason: 'direction' | 'self' | 'type' | 'duplicate' | 'cycle' }
  | { reason: 'custom'; message?: string }

const typesOf = (port: FlowPortSpec) =>
  port.dataType == null ? [] : Array.isArray(port.dataType) ? port.dataType : [port.dataType]

/** The first type of a port, which decides its look. */
export const primaryType = (port: FlowPortSpec) => typesOf(port)[0]

/** Whether data of the output's types may flow into the input. */
export function typesMatch(output: FlowPortSpec, input: FlowPortSpec, portTypes: PortTypes = {}) {
  const from = typesOf(output)
  const to = typesOf(input)
  if (!from.length || !to.length || from.includes('any') || to.includes('any')) return true
  return to.some(
    (type) =>
      from.includes(type) || from.some((other) => portTypes[type]?.accepts?.includes(other)),
  )
}

/** Whether `to` can be reached from `from` along edges. */
export function reaches(doc: FlowDocument, from: string, to: string) {
  const next = new Map<string, string[]>()
  for (const edge of doc.edges) {
    const list = next.get(edge.source.node)
    if (list) list.push(edge.target.node)
    else next.set(edge.source.node, [edge.target.node])
  }
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length) {
    const id = stack.pop()!
    if (id === to) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(next.get(id) ?? []))
  }
  return false
}

const edgesAt = (doc: FlowDocument, end: 'source' | 'target', at: Required<FlowEndpoint>) =>
  doc.edges.filter((edge) => edge[end].node === at.node && edge[end].port === at.port)

/**
 * Checks a connection between two ports and says why it is refused, or
 * `null` when it is fine. `ignore` is an edge being moved, left out. A port
 * that is full still takes the edge: the oldest of its edges makes way.
 */
export function joinRefusal(
  doc: FlowDocument,
  connection: FlowConnection,
  ports: { source: FlowPortSpec; target: FlowPortSpec },
  options: ConnectOptions = {},
  ignore?: string,
): JoinRefusal | null {
  const { source, target } = connection
  if (ports.source.kind !== 'output' || ports.target.kind !== 'input')
    return { reason: 'direction' }
  if (source.node === target.node) return { reason: 'self' }
  if (!typesMatch(ports.source, ports.target, options.portTypes)) return { reason: 'type' }
  const others = { ...doc, edges: doc.edges.filter((edge) => edge.id !== ignore) }
  const into = edgesAt(others, 'target', target)
  if (into.some((edge) => edge.source.node === source.node && edge.source.port === source.port))
    return { reason: 'duplicate' }
  if (options.acyclic && reaches(others, target.node, source.node)) return { reason: 'cycle' }
  const verdict = options.canConnect ? options.canConnect(connection, doc) : true
  if (verdict === true) return null
  return { reason: 'custom', message: typeof verdict === 'string' ? verdict : undefined }
}

/** Whether two ports may be joined; see `joinRefusal`. */
export const canJoin = (...args: Parameters<typeof joinRefusal>) => !joinRefusal(...args)

/**
 * The edges that make way when an edge joins two full ports: the oldest at
 * each end, beyond `max` (1 for inputs, unlimited for outputs by default).
 */
export function displacedEdges(
  doc: FlowDocument,
  connection: FlowConnection,
  ports: { source: FlowPortSpec; target: FlowPortSpec },
  ignore?: string,
) {
  const out = new Set<string>()
  const trim = (end: 'source' | 'target', max: number | undefined) => {
    if (max == null) return
    const edges = edgesAt(doc, end, connection[end]).filter((edge) => edge.id !== ignore)
    for (const edge of edges.slice(0, Math.max(0, edges.length - max + 1))) out.add(edge.id)
  }
  trim('target', ports.target.max ?? 1)
  trim('source', ports.source.max)
  return [...out]
}
