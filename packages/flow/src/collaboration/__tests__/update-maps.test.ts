// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { fillMaps, readMaps, updateMaps } from '..'
import type { FlowDocument } from '../../core/model'

const maps = (ydoc: Y.Doc) => ({ nodes: ydoc.getMap('nodes'), edges: ydoc.getMap('edges') })

const flow: FlowDocument = {
  version: 1,
  nodes: [
    { id: 'a', type: 'default', x: 0, y: 0, data: { label: 'A' } },
    { id: 'b', type: 'default', x: 200, y: 0, data: { label: 'B' } },
  ],
  edges: [{ id: 'e', source: { node: 'a' }, target: { node: 'b' } }],
}

describe('readMaps and updateMaps', () => {
  it('reads what fillMaps wrote', () => {
    const ydoc = new Y.Doc()
    fillMaps(maps(ydoc), flow)
    expect(readMaps(maps(ydoc))).toEqual(flow)
  })

  it('writes only the fields that changed, so others’ changes to other fields stay', () => {
    const server = new Y.Doc()
    const page = new Y.Doc()
    fillMaps(maps(server), flow)
    Y.applyUpdate(page, Y.encodeStateAsUpdate(server))
    // the page moves a node while the server relabels it
    ;(maps(page).nodes.get('a') as Y.Map<unknown>).set('x', 50)
    const origin = { agent: 'ai' }
    let seen: unknown = null
    server.on('afterTransaction', (tr: Y.Transaction) => (seen ??= tr.origin))
    updateMaps(
      maps(server),
      { ...flow, nodes: [{ ...flow.nodes[0]!, data: { label: 'A!' } }, flow.nodes[1]!] },
      { origin },
    )
    expect(seen).toBe(origin)
    Y.applyUpdate(page, Y.encodeStateAsUpdate(server))
    Y.applyUpdate(server, Y.encodeStateAsUpdate(page))
    expect(readMaps(maps(page)).nodes[0]).toEqual({
      id: 'a',
      type: 'default',
      x: 50,
      y: 0,
      data: { label: 'A!' },
    })
  })

  it('adds and removes nodes and edges', () => {
    const ydoc = new Y.Doc()
    fillMaps(maps(ydoc), flow)
    const next: FlowDocument = {
      version: 1,
      nodes: [flow.nodes[0]!, { id: 'c', type: 'default', x: 0, y: 100, data: {} }],
      edges: [],
    }
    updateMaps(maps(ydoc), next)
    expect(readMaps(maps(ydoc))).toEqual(next)
  })

  it('with `base`, writes only what changed since it, keeping what others did meanwhile', () => {
    const server = new Y.Doc()
    const page = new Y.Doc()
    fillMaps(maps(server), flow)
    Y.applyUpdate(page, Y.encodeStateAsUpdate(server))
    // the server reads the flow and hands it to a program that takes a while
    const base = readMaps(maps(server))
    // meanwhile the page moves a, adds c, and removes the edge
    const nodes = maps(page).nodes
    ;(nodes.get('a') as Y.Map<unknown>).set('x', 50)
    nodes.set('c', new Y.Map(Object.entries({ type: 'default', x: 0, y: 100, data: {} })))
    maps(page).edges.delete('e')
    Y.applyUpdate(server, Y.encodeStateAsUpdate(page))
    // the program relabels b and changes the edge
    updateMaps(
      maps(server),
      {
        ...base,
        nodes: base.nodes.map((n) => (n.id === 'b' ? { ...n, data: { label: 'B!' } } : n)),
        edges: [{ ...base.edges[0]!, label: '通过' }],
      },
      { base },
    )
    const after = readMaps(maps(server))
    const byId = new Map(after.nodes.map((n) => [n.id, n]))
    expect(byId.get('a')!.x).toBe(50)
    expect(byId.get('b')!.data).toEqual({ label: 'B!' })
    expect(byId.has('c')).toBe(true)
    // removed by someone else meanwhile: it stays removed
    expect(after.edges).toEqual([])
  })

  it('with `base`, removes only what the new version left out of it', () => {
    const ydoc = new Y.Doc()
    fillMaps(maps(ydoc), flow, { origin: 'server' })
    const base = readMaps(maps(ydoc))
    maps(ydoc).nodes.set('c', new Y.Map(Object.entries({ type: 'default', x: 0, y: 100 })))
    updateMaps(maps(ydoc), { ...base, nodes: [base.nodes[0]!], edges: [] }, { base })
    expect(new Set(readMaps(maps(ydoc)).nodes.map((n) => n.id))).toEqual(new Set(['a', 'c']))
  })

  it('with `base`, leaves out a new edge to a node removed meanwhile', () => {
    const ydoc = new Y.Doc()
    fillMaps(maps(ydoc), flow)
    const base = readMaps(maps(ydoc))
    maps(ydoc).nodes.delete('b')
    updateMaps(
      maps(ydoc),
      {
        ...base,
        edges: [...base.edges, { id: 'f', source: { node: 'a' }, target: { node: 'b' } }],
      },
      { base },
    )
    expect(maps(ydoc).edges.has('f')).toBe(false)
  })

  it('doesn’t take objects with their keys in another order as changed', () => {
    const ydoc = new Y.Doc()
    const node = { ...flow.nodes[0]!, data: { label: 'A', tone: 'info' } }
    const doc = { ...flow, nodes: [node, flow.nodes[1]!] }
    fillMaps(maps(ydoc), doc)
    const base = readMaps(maps(ydoc))
    // meanwhile someone changes the node's data
    ;(maps(ydoc).nodes.get('a') as Y.Map<unknown>).set('data', { label: 'A', tone: 'done' })
    // the program only moves the node, writing its data with the keys in another order
    updateMaps(
      maps(ydoc),
      { ...doc, nodes: [{ ...node, x: 90, data: { tone: 'info', label: 'A' } }, flow.nodes[1]!] },
      { base },
    )
    expect(readMaps(maps(ydoc)).nodes.find((item) => item.id === 'a')).toMatchObject({
      x: 90,
      data: { label: 'A', tone: 'done' },
    })
  })

  it('warns when given base itself, or nodes of it changed in place', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const ydoc = new Y.Doc()
      fillMaps(maps(ydoc), flow)
      const base = readMaps(maps(ydoc))
      updateMaps(maps(ydoc), base, { base })
      expect(warn.mock.calls[0]![0]).toContain('structuredClone')
      // handed on unchanged: fine; changed in place: warned
      warn.mockClear()
      updateMaps(maps(ydoc), { ...base, nodes: [...base.nodes] }, { base })
      expect(warn).not.toHaveBeenCalled()
      const node = base.nodes.find((item) => item.id === 'b')!
      node.x = 999
      updateMaps(maps(ydoc), { ...base, nodes: [...base.nodes] }, { base })
      expect(readMaps(maps(ydoc)).nodes.find((item) => item.id === 'b')!.x).toBe(200)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toContain('"b"')
    } finally {
      warn.mockRestore()
    }
  })
})
