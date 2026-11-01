import { describe, expect, it } from 'vitest'
import { checkDocument, defineFlowExtension, defineNodeType, migrateDocument } from '..'
import type { FlowDocument } from '..'

const doc = (): FlowDocument => ({
  version: 1,
  nodes: [
    { id: 'a', x: 0, y: 0, data: { label: '开始', outputs: [{ id: 'out' }] } },
    { id: 'g', type: 'group', x: 200, y: 0, width: 300, height: 200 },
    { id: 'b', x: 240, y: 40, parent: 'g', data: { label: '审批', inputs: [{ id: 'in' }] } },
  ],
  edges: [{ id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
})

describe('checkDocument', () => {
  it('finds nothing in a good document, with or without types', () => {
    expect(checkDocument(doc())).toEqual([])
    expect(checkDocument(doc(), { edgeTypes: [] })).toEqual([])
  })

  it('finds the version, ids, positions, parents and missing ends', () => {
    const bad = {
      version: 2,
      nodes: [
        { id: 'a', x: 0, y: 0 },
        { id: 'a', x: 10, y: 0 },
        { id: '', x: 0, y: 0 },
        { id: 'p', x: Number.NaN, y: 0, parent: 'q' },
        { id: 'q', x: 0, y: 0, parent: 'p' },
        { id: 'r', x: 0, y: 0, parent: 'nowhere' },
      ],
      edges: [
        { id: 'e', source: { node: 'a' }, target: { node: 'x' } },
        { id: 'e', source: { node: 'a' }, target: { node: 'q' } },
      ],
    } as unknown as FlowDocument
    const problems = checkDocument(bad)
    expect(problems.map((p) => [p.code, p.path])).toEqual([
      ['version', 'version'],
      ['duplicate-id', 'nodes[1]'],
      ['missing-id', 'nodes[2]'],
      ['bad-position', 'nodes[3]'],
      ['parent-cycle', 'nodes[3].parent'],
      ['parent-cycle', 'nodes[4].parent'],
      ['missing-parent', 'nodes[5].parent'],
      ['missing-node', 'edges[0].target'],
      ['duplicate-id', 'edges[1]'],
    ])
    expect(problems[7]).toMatchObject({ edgeId: 'e', nodeId: 'x', text: 'x' })
  })

  it('checks types and ports against the editor’s types', () => {
    const card = defineNodeType({ type: 'card', ports: [{ id: 'in', kind: 'input' }] })
    const value = doc()
    value.nodes.push({ id: 'c', type: 'card', x: 0, y: 0 }, { id: 'd', type: 'shape', x: 0, y: 0 })
    value.edges.push(
      { id: 'e2', type: 'wavy', source: { node: 'a', port: 'nope' }, target: { node: 'c' } },
      { id: 'e3', source: { node: 'a', port: 'out' }, target: { node: 'c', port: 'in' } },
    )
    // without the editor's types nothing about types is checked
    expect(checkDocument(value)).toEqual([])
    const problems = checkDocument(value, { nodeTypes: [card] })
    expect(problems.map((p) => [p.code, p.text])).toEqual([
      ['unknown-type', 'shape'],
      ['unknown-type', 'wavy'],
      ['missing-port', 'nope'],
    ])
    // types an extension adds count, and the kit is not assumed then
    const shapes = defineFlowExtension({ name: 'shapes', nodeTypes: [card, { type: 'shape' }] })
    expect(checkDocument(value, { extensions: [shapes] }).map((p) => p.text)).toEqual([
      'group',
      'wavy',
      'nope',
    ])
  })
})

describe('migrateDocument', () => {
  it('fills what is missing and keeps the rest', () => {
    expect(migrateDocument({ nodes: [{ id: 'a', x: 0, y: 0 }, null, 1], title: '流程' })).toEqual({
      version: 1,
      nodes: [{ id: 'a', x: 0, y: 0 }],
      edges: [],
      title: '流程',
    })
    expect(migrateDocument(null)).toEqual({ version: 1, nodes: [], edges: [] })
  })

  it('throws for a newer version', () => {
    expect(() => migrateDocument({ version: 2, nodes: [], edges: [] })).toThrow('version 2')
  })
})
