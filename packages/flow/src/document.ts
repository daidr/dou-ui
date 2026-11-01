import { resolveFlowExtensions, type FlowExtension } from './core/extension'
import type { EdgeTypeSpec } from './core/edge-types'
import type { FlowDocument, FlowEdge, FlowNode } from './core/model'
import { portsOf, type NodeTypeSpec } from './core/node-types'
import { defaultNode } from './components/default-node'
import { flowKit } from './kit'

export interface DocumentProblem {
  code:
    | 'version'
    | 'shape'
    | 'missing-id'
    | 'duplicate-id'
    | 'bad-position'
    | 'unknown-type'
    | 'missing-node'
    | 'missing-port'
    | 'missing-parent'
    | 'parent-cycle'
  /** The node at fault, or the node an edge's end points at. */
  nodeId?: string
  /** The edge at fault. */
  edgeId?: string
  /**
   * Where the problem is, as a path into the document, e.g. `nodes[2]` or
   * `edges[0].target`; `version` for the version.
   */
  path: string
  /** The id, type or port at fault, for the editor's message. */
  text: string
  /** An English description, for logs. */
  message: string
}

export interface CheckDocumentOptions {
  /**
   * The editor's `extensions`, for the node and edge types they add. With
   * none of `extensions`, `nodeTypes` and `edgeTypes`, types and ports are
   * not checked; with `nodeTypes` or `edgeTypes` alone, the default
   * `flowKit()` is assumed, as in the editor.
   */
  extensions?: readonly (FlowExtension | readonly FlowExtension[])[]
  /** The editor's `nodeTypes`. */
  nodeTypes?: readonly NodeTypeSpec<any>[]
  /** The editor's `edgeTypes`. */
  edgeTypes?: readonly EdgeTypeSpec<any>[]
}

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)

/**
 * What is wrong with the shape itself: the document is not an object, or a
 * list in it is not an array. Nothing else can be checked until it is fixed.
 */
function shapeProblems(value: unknown, lists: string[]): DocumentProblem[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return [{ code: 'shape', path: '', text: '', message: 'The document is not an object' }]
  return lists
    .filter((key) => !Array.isArray((value as Record<string, unknown>)[key]))
    .map((key) => ({ code: 'shape', path: key, text: '', message: `"${key}" is not a list` }))
}

/**
 * The problems of a flow document, before it is saved or shown: an unknown
 * version, nodes and edges without an id or sharing one, positions that are
 * not numbers, edges whose ends are missing, `parent` pointing nowhere or
 * in a circle, and, given the editor's types, types nobody registered and
 * ports a node does not have.
 */
export function checkDocument(
  document: FlowDocument,
  options: CheckDocumentOptions = {},
): DocumentProblem[] {
  const shape = shapeProblems(document, ['nodes', 'edges'])
  if (shape.length) return shape
  const problems: DocumentProblem[] = []
  if (document.version !== 1)
    problems.push({
      code: 'version',
      path: 'version',
      text: String(document.version),
      message: `Version ${String(document.version)} is not known`,
    })

  const typed = options.extensions || options.nodeTypes || options.edgeTypes
  const resolved = typed ? resolveFlowExtensions(options.extensions ?? flowKit()) : undefined
  const nodeTypes = resolved && new Map<string, NodeTypeSpec>(resolved.nodeTypes)
  for (const spec of options.nodeTypes ?? []) nodeTypes?.set(spec.type, spec as NodeTypeSpec)
  const edgeTypes = resolved && new Set(resolved.edgeTypes.keys())
  for (const spec of options.edgeTypes ?? []) edgeTypes?.add(spec.type)

  const nodes = new Map<string, FlowNode>()
  document.nodes.forEach((node, i) => {
    const path = `nodes[${i}]`
    if (!node.id) {
      problems.push({ code: 'missing-id', path, text: '', message: `${path} has no id` })
      return
    }
    if (nodes.has(node.id))
      problems.push({
        code: 'duplicate-id',
        nodeId: node.id,
        path,
        text: node.id,
        message: `The node id "${node.id}" is used more than once`,
      })
    else nodes.set(node.id, node)
    if (!isNumber(node.x) || !isNumber(node.y))
      problems.push({
        code: 'bad-position',
        nodeId: node.id,
        path,
        text: node.id,
        message: `The node "${node.id}" has no numeric x and y`,
      })
    // A node without a type is drawn as the default node, registered or not.
    if (nodeTypes && node.type && node.type !== 'default' && !nodeTypes.has(node.type))
      problems.push({
        code: 'unknown-type',
        nodeId: node.id,
        path,
        text: node.type,
        message: `No node type "${node.type}" is registered`,
      })
  })

  document.nodes.forEach((node, i) => {
    if (!node.id || !node.parent || nodes.get(node.id) !== node) return
    const path = `nodes[${i}].parent`
    if (!nodes.has(node.parent)) {
      problems.push({
        code: 'missing-parent',
        nodeId: node.id,
        path,
        text: node.parent,
        message: `The parent "${node.parent}" of "${node.id}" is not in the document`,
      })
      return
    }
    // only the members of a circle are reported; one hanging below it is fine itself
    const seen = new Set<string>()
    for (let at = nodes.get(node.parent); at; at = at.parent ? nodes.get(at.parent) : undefined) {
      if (at.id !== node.id) {
        if (seen.has(at.id)) break
        seen.add(at.id)
        continue
      }
      problems.push({
        code: 'parent-cycle',
        nodeId: node.id,
        path,
        text: node.parent,
        message: `The node "${node.id}" is inside itself through its parents`,
      })
      break
    }
  })

  const edgeIds = new Set<string>()
  document.edges.forEach((edge, i) => {
    const path = `edges[${i}]`
    if (!edge.id)
      problems.push({ code: 'missing-id', path, text: '', message: `${path} has no id` })
    else if (edgeIds.has(edge.id))
      problems.push({
        code: 'duplicate-id',
        edgeId: edge.id,
        path,
        text: edge.id,
        message: `The edge id "${edge.id}" is used more than once`,
      })
    edgeIds.add(edge.id)
    if (edgeTypes && edge.type && !edgeTypes.has(edge.type))
      problems.push({
        code: 'unknown-type',
        edgeId: edge.id,
        path,
        text: edge.type,
        message: `No edge type "${edge.type}" is registered`,
      })
    for (const end of ['source', 'target'] as const)
      checkEnd(edge, end, `${path}.${end}`, nodes, nodeTypes, problems)
  })
  return problems
}

function checkEnd(
  edge: FlowEdge,
  end: 'source' | 'target',
  path: string,
  nodes: Map<string, FlowNode>,
  nodeTypes: Map<string, NodeTypeSpec> | undefined,
  problems: DocumentProblem[],
) {
  const endpoint = edge[end]
  const node = endpoint && nodes.get(endpoint.node)
  if (!node) {
    const id = String(endpoint?.node ?? '')
    problems.push({
      code: 'missing-node',
      edgeId: edge.id,
      nodeId: id || undefined,
      path,
      text: id,
      message: `The ${end} "${id}" of the edge "${edge.id}" is not in the document`,
    })
    return
  }
  if (!nodeTypes || endpoint.port === undefined) return
  // as the editor draws it: an unknown type as the default node
  const spec =
    nodeTypes.get(node.type ?? 'default') ??
    nodeTypes.get('default') ??
    (defaultNode as NodeTypeSpec)
  if (portsOf(spec, node).some((port) => port.id === endpoint.port)) return
  problems.push({
    code: 'missing-port',
    edgeId: edge.id,
    nodeId: node.id,
    path,
    text: endpoint.port,
    message: `The node "${node.id}" has no port "${endpoint.port}"`,
  })
}

const objects = <T>(value: unknown) =>
  (Array.isArray(value) ? value : []).filter(
    (item): item is T => !!item && typeof item === 'object',
  )

/** The saved data as an object of version 1, or an error saying why it can't be. */
function sourceOf(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error(
      `[@dou-ui/flow] a flow document must be an object, not ${Array.isArray(input) ? 'an array' : (JSON.stringify(input) ?? String(input))}`,
    )
  const source = input as Record<string, unknown>
  const version = source.version ?? 1
  if (version !== 1)
    throw new Error(
      `[@dou-ui/flow] unknown document version ${JSON.stringify(version) ?? String(version)} (expected 1); data saved by a newer @dou-ui/flow needs that version to open`,
    )
  return source
}

/**
 * Brings a saved document up to the current version, and fills what an
 * older or hand-written one may lack (`version`, `nodes`, `edges`). Nodes
 * and edges that are not objects are dropped; anything else is kept as it
 * is. Throws for data that is not an object
 * (an array, `null`, a string) and for a version it does not know.
 */
export function migrateDocument(input: unknown): FlowDocument {
  const source = sourceOf(input)
  return {
    ...source,
    version: 1,
    nodes: objects<FlowNode>(source.nodes),
    edges: objects<FlowEdge>(source.edges),
  }
}

const warned = new Set<string>()

/**
 * The `v-model` as the editor reads it. A document of the wrong shape (not
 * an object, without `nodes` or `edges`, without a known `version`) gets a
 * warning in development and is read with what is missing left empty and
 * the version as 1, so the editor still opens and what it writes back
 * carries `version: 1`.
 */
export function readDocument(value: unknown): FlowDocument {
  const plain = !!value && typeof value === 'object' && !Array.isArray(value)
  const source = (plain ? value : {}) as Partial<FlowDocument>
  const nodes = Array.isArray(source.nodes)
  const edges = Array.isArray(source.edges)
  const problem = !plain
    ? `is ${Array.isArray(value) ? 'an array' : (JSON.stringify(value) ?? String(value))}`
    : !nodes
      ? 'has no nodes array'
      : !edges
        ? 'has no edges array'
        : source.version === undefined
          ? 'has no version'
          : source.version !== 1
            ? `has version ${JSON.stringify(source.version)}`
            : ''
  if (!problem) return value as FlowDocument
  if (process.env.NODE_ENV !== 'production' && !warned.has(problem)) {
    warned.add(problem)
    console.warn(
      `[@dou-ui/flow] the v-model ${problem}; expected { version: 1, nodes: [...], edges: [...] }. What is missing is read as empty and the version as 1; read saved data with migrateDocument().`,
    )
  }
  return {
    ...source,
    version: 1,
    nodes: nodes ? source.nodes! : [],
    edges: edges ? source.edges! : [],
  }
}
