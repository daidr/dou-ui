// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { fillMap, readMap, updateMap } from '..'
import type { PartialBlock } from '../../core/model'

const text = (blocks: { content: unknown }[]) =>
  blocks.map((block) =>
    (block.content as { text?: string }[]).map((item) => item.text ?? '').join(''),
  )

/** Bring two docs up to date with each other, as a server and a page do once a change arrives. */
function exchange(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)))
}

const doc = (...lines: string[]) => ({
  version: 1 as const,
  blocks: lines.map((line): PartialBlock => ({ type: 'paragraph', content: line })),
})

/** A list item with one nested item. */
const tree = (child: string) => ({
  version: 1 as const,
  blocks: [
    {
      type: 'bulletItem' as const,
      content: 'parent',
      children: [{ type: 'bulletItem' as const, content: child }],
    },
  ],
})

describe('updateMap', () => {
  it('fills an empty map', () => {
    const ydoc = new Y.Doc()
    updateMap(ydoc.getMap('document'), doc('a', 'b'))
    expect(text(readMap(ydoc.getMap('document')).blocks)).toEqual(['a', 'b'])
  })

  it('matches blocks with new ids by content and place, and keeps their ids', () => {
    const ydoc = new Y.Doc()
    const map = ydoc.getMap('document')
    fillMap(map, doc('one', 'two', 'three'))
    const ids = readMap(map).blocks.map((block) => block.id)
    // as if read from Markdown again: every id is new
    updateMap(map, doc('zero', 'one', 'two!', 'three'))
    const after = readMap(map).blocks
    expect(text(after)).toEqual(['zero', 'one', 'two!', 'three'])
    expect(after.slice(1).map((block) => block.id)).toEqual(ids)
  })

  it('writes only what changed, so what someone types meanwhile elsewhere stays', () => {
    const server = new Y.Doc()
    const page = new Y.Doc()
    fillMap(server.getMap('document'), doc('first', 'second'))
    exchange(server, page)
    const [, second] = readMap(page.getMap('document')).blocks
    // the page types into the second block…
    const typed = (page.getMap('document').get(second!.id) as Y.Map<unknown>).get('text') as Y.Text
    page.transact(() => typed.insert(6, ' and more'))
    // …while the server writes a version that changed the first, from before that
    const origin = { agent: 'ai' }
    let seen: unknown = null
    server.on('afterTransaction', (tr: Y.Transaction) => (seen ??= tr.origin))
    updateMap(server.getMap('document'), doc('first, edited', 'second'), undefined, { origin })
    expect(seen).toBe(origin)
    exchange(server, page)
    expect(text(readMap(page.getMap('document')).blocks)).toEqual([
      'first, edited',
      'second and more',
    ])
  })

  it('removes and moves blocks', () => {
    const ydoc = new Y.Doc()
    const map = ydoc.getMap('document')
    fillMap(map, doc('a', 'b', 'c'))
    updateMap(map, doc('c', 'a'))
    expect(text(readMap(map).blocks)).toEqual(['c', 'a'])
  })

  it('keeps nested blocks under their parent', () => {
    const ydoc = new Y.Doc()
    const map = ydoc.getMap('document')
    fillMap(map, tree('child'))
    const [parent] = readMap(map).blocks
    updateMap(map, tree('child, edited'))
    const [after] = readMap(map).blocks
    expect(after!.id).toBe(parent!.id)
    expect(after!.children[0]!.id).toBe(parent!.children[0]!.id)
    expect(text(after!.children)).toEqual(['child, edited'])
  })
})
