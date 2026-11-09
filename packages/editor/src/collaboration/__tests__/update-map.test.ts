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
    updateMap(server.getMap('document'), doc('first, edited', 'second'), { origin })
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

  it('pairs blocks across one of another type, so the rest keep their ids', () => {
    const ydoc = new Y.Doc()
    const map = ydoc.getMap('document')
    fillMap(map, {
      version: 1,
      blocks: [
        { type: 'paragraph', content: 'p one' },
        { type: 'heading', content: 'H' },
        { type: 'paragraph', content: 'p two' },
      ],
    })
    const [one, , two] = readMap(map).blocks
    updateMap(map, doc('p one!', 'p two!'))
    const after = readMap(map).blocks
    expect(text(after)).toEqual(['p one!', 'p two!'])
    expect(after.map((block) => block.id)).toEqual([one!.id, two!.id])
  })

  it('takes a paragraph unlike its neighbours as new, not as the next one edited', () => {
    const ydoc = new Y.Doc()
    const map = ydoc.getMap('document')
    fillMap(map, doc('季度收入上涨了百分之十', '下季度计划在上海开新店'))
    const [first, second] = readMap(map).blocks
    updateMap(
      map,
      doc('季度收入上涨了百分之十二', '团队又来了两位同事', '下季度计划在上海开两家新店'),
    )
    const after = readMap(map).blocks
    expect(text(after)).toEqual([
      '季度收入上涨了百分之十二',
      '团队又来了两位同事',
      '下季度计划在上海开两家新店',
    ])
    expect(after[0]!.id).toBe(first!.id)
    expect(after[2]!.id).toBe(second!.id)
  })

  it('with `base`, keeps what others typed and added since it was read', () => {
    const server = new Y.Doc()
    const page = new Y.Doc()
    fillMap(server.getMap('document'), doc('user block', 'ai block'))
    exchange(server, page)
    const base = readMap(server.getMap('document'))
    // meanwhile on the page: typing into the first block, and a new block at the end
    const pageMap = page.getMap('document')
    const [first] = readMap(pageMap).blocks
    page.transact(() =>
      ((pageMap.get(first!.id) as Y.Map<unknown>).get('text') as Y.Text).insert(
        10,
        ' typed meanwhile',
      ),
    )
    updateMap(pageMap, doc('user block typed meanwhile', 'ai block', 'page block'))
    exchange(server, page)
    // the program changed only the second, from what it read; ids are new as from Markdown
    updateMap(server.getMap('document'), doc('user block', 'ai block, rewritten'), {
      base: { version: 1, blocks: base.blocks.map((block) => ({ ...block, id: undefined })) },
    })
    exchange(server, page)
    expect(text(readMap(page.getMap('document')).blocks)).toEqual([
      'user block typed meanwhile',
      'ai block, rewritten',
      'page block',
    ])
  })

  it('keeps comment threads on text a Markdown round trip leaves the same', () => {
    const ydoc = new Y.Doc()
    const map = ydoc.getMap('document')
    fillMap(map, {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'hello ' },
            { type: 'text', text: 'world', comments: ['t1'] },
          ],
        },
        { type: 'paragraph', content: 'other' },
      ],
    })
    // read back without the threads, as from Markdown: one block unchanged, one edited
    updateMap(map, {
      version: 1,
      blocks: [
        { type: 'paragraph', content: 'hello world' },
        { type: 'paragraph', content: 'other, edited' },
      ],
    })
    const kept = JSON.stringify(readMap(map).blocks[0]!.content)
    expect(kept).toContain('t1')
    // and in a block whose text changed elsewhere
    updateMap(map, {
      version: 1,
      blocks: [
        { type: 'paragraph', content: 'oh hello world' },
        { type: 'paragraph', content: 'other, edited' },
      ],
    })
    const [changed] = readMap(map).blocks
    expect(text([changed!])).toEqual(['oh hello world'])
    expect(JSON.stringify(changed!.content)).toContain('t1')
  })

  it('stays fast on a long document rewritten from Markdown', () => {
    const ydoc = new Y.Doc()
    const map = ydoc.getMap('document')
    const lines = Array.from({ length: 3000 }, (_, i) => `第 ${i} 段：上海的天气晴`)
    fillMap(map, doc(...lines))
    lines[1500] = '第 1500 段：上海的天气多云'
    const start = performance.now()
    updateMap(map, doc(...lines))
    expect(performance.now() - start).toBeLessThan(1500)
    expect(text(readMap(map).blocks)[1500]).toBe('第 1500 段：上海的天气多云')
  })
})
