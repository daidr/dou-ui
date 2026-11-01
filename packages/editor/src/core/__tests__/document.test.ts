import { describe, expect, it } from 'vitest'
import { checkDocument, editorKit, mention, migrateDocument } from '../../index'
import type { EditorDocument, PartialBlock } from '../../index'

const doc = (): EditorDocument<PartialBlock> => ({
  version: 1,
  blocks: [
    { id: 'h', type: 'heading', props: { level: 1 }, content: '出行计划' },
    {
      id: 'p',
      content: [{ type: 'text', text: '去上海', marks: ['bold'] }],
      children: [{ id: 'c', type: 'checkItem', content: '订票' }],
    },
    {
      id: 't',
      type: 'table',
      rows: [
        { id: 'r1', cells: ['日期', '地点'] },
        { id: 'r2', cells: ['周一', '上海'] },
      ],
    },
  ],
})

describe('checkDocument', () => {
  it('finds nothing in a good document', () => {
    expect(checkDocument(doc())).toEqual([])
  })

  it('finds the version, ids, types, marks and inline nodes', () => {
    const value = doc() as unknown as { version: number; blocks: PartialBlock[] }
    value.version = 2
    value.blocks[1]!.children!.push({
      id: 'h',
      type: 'video',
      content: [
        { type: 'text', text: '看', marks: ['glow'] },
        { type: 'inline', name: 'mention', props: { id: 'u1' } },
      ],
    })
    value.blocks[2]!.rows!.push({ id: 'r1', cells: ['周二', '杭州'] })
    const problems = checkDocument(value as unknown as EditorDocument<PartialBlock>)
    expect(problems.map((p) => [p.code, p.path, p.text])).toEqual([
      ['version', 'version', '2'],
      ['duplicate-id', 'blocks[1].children[1]', 'h'],
      ['unknown-type', 'blocks[1].children[1]', 'video'],
      ['unknown-mark', 'blocks[1].children[1].content[0]', 'glow'],
      ['unknown-inline', 'blocks[1].children[1].content[1]', 'mention'],
      ['duplicate-id', 'blocks[2].rows[2]', 'r1'],
    ])
    // with the extension that adds it, the mention is known
    const extensions = [editorKit(), mention({ search: () => [] })]
    expect(checkDocument(value as never, { extensions }).map((p) => p.code)).not.toContain(
      'unknown-inline',
    )
  })
})

describe('migrateDocument', () => {
  it('fills what is missing and keeps the rest', () => {
    expect(migrateDocument({ blocks: [{ content: '你好' }, null], title: '笔记' })).toEqual({
      version: 1,
      blocks: [{ content: '你好' }],
      title: '笔记',
    })
    expect(migrateDocument('x')).toEqual({ version: 1, blocks: [] })
  })

  it('throws for a newer version', () => {
    expect(() => migrateDocument({ version: 2, blocks: [] })).toThrow('version 2')
  })
})
