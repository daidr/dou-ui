import { describe, expect, it, vi } from 'vitest'
import { readBlocks } from '../../document'
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

  it('reports a document of the wrong shape and nothing else', () => {
    const value = [{ content: '旧' }] as unknown as EditorDocument<PartialBlock>
    expect(checkDocument(value).map((p) => p.code)).toEqual(['shape'])
    const bare = { version: 1 } as unknown as EditorDocument<PartialBlock>
    expect(checkDocument(bare).map((p) => p.path)).toEqual(['blocks'])
  })
})

describe('migrateDocument', () => {
  it('fills what is missing and keeps the rest', () => {
    expect(migrateDocument({ blocks: [{ content: '你好' }, null], title: '笔记' })).toEqual({
      version: 1,
      blocks: [{ content: '你好' }],
      title: '笔记',
    })
  })

  it('throws for data that is not an object', () => {
    for (const input of [null, undefined, 'x', [{ id: 'a' }]])
      expect(() => migrateDocument(input)).toThrow('[@dou-ui/editor]')
  })

  it('throws for a version it does not know', () => {
    expect(() => migrateDocument({ version: 2, blocks: [] })).toThrow('version 2')
    expect(() => migrateDocument({ version: '1' })).toThrow('version "1"')
  })
})

describe('readBlocks', () => {
  it('reads a wrongly shaped v-model with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocks = [{ content: '你好' }]
    expect(readBlocks(undefined)).toBeUndefined()
    expect(readBlocks({ version: 1, blocks })).toBe(blocks)
    expect(readBlocks(blocks)).toBe(blocks)
    expect(readBlocks({ version: 1 })).toEqual([])
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      expect.stringContaining('[@dou-ui/editor] the v-model is a list of blocks'),
      expect.stringContaining('[@dou-ui/editor] the v-model has no blocks array'),
    ])
    warn.mockRestore()
  })
})
