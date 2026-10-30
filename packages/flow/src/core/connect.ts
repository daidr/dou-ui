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
export type PortTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

export interface PortTypeSpec {
  /** Shown to screen readers and in tooltips. */
  label?: string
  shape?: PortShape
  /** A theme tone, or any CSS color. Also colors the edges leaving the port. */
  color?: PortTone | (string & {})
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
  canConnect?: (connection: FlowConnection, doc: FlowDocument) => boolean
}

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
 * Checks a connection between two ports. `ignore` is an edge being moved,
 * left out of the counts. An input that takes one edge and already has
 * one is still accepted: the new edge replaces it.
 */
export function canJoin(
  doc: FlowDocument,
  connection: FlowConnection,
  ports: { source: FlowPortSpec; target: FlowPortSpec },
  options: ConnectOptions = {},
  ignore?: string,
) {
  const { source, target } = connection
  if (ports.source.kind !== 'output' || ports.target.kind !== 'input') return false
  if (source.node === target.node) return false
  if (!typesMatch(ports.source, ports.target, options.portTypes)) return false
  const others = { ...doc, edges: doc.edges.filter((edge) => edge.id !== ignore) }
  const into = edgesAt(others, 'target', target)
  if (into.some((edge) => edge.source.node === source.node && edge.source.port === source.port))
    return false
  const max = ports.target.max ?? 1
  if (into.length >= max && max !== 1) return false
  const out = edgesAt(others, 'source', source)
  if (ports.source.max != null && out.length >= ports.source.max) return false
  if (options.acyclic && reaches(others, target.node, source.node)) return false
  return options.canConnect ? options.canConnect(connection, doc) : true
}
