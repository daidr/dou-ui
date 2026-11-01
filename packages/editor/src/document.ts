import type { Schema } from 'prosemirror-model'
import { kitOf, type EditorExtensionList } from './core/convert'
import type { EditorDocument, PartialBlock, PartialTableRow } from './core/model'
import { editorKit } from './extensions/editor-kit'

export interface DocumentProblem {
  code: 'version' | 'duplicate-id' | 'unknown-type' | 'unknown-mark' | 'unknown-inline'
  /** The block at fault, when it has an id. */
  blockId?: string
  /**
   * Where the problem is, as a path into the document, e.g.
   * `blocks[0].children[2]` or `blocks[1].content[0]`; `version` for the version.
   */
  path: string
  /** The id, type, mark or inline node at fault, for the editor's message. */
  text: string
  /** An English description, for logs. */
  message: string
}

export interface CheckDocumentOptions {
  /** The editor's `extensions`, for the blocks, marks and inline nodes they add; `[editorKit()]` by default, as in the editor. */
  extensions?: EditorExtensionList
}

let defaultKit: EditorExtensionList | undefined

/**
 * The problems of an editor document, before it is saved or shown: an
 * unknown version, blocks or table rows sharing an id, and block types,
 * marks and inline nodes the extensions don't define, which the editor
 * would show as a paragraph or leave out.
 */
export function checkDocument(
  document: EditorDocument<PartialBlock>,
  options: CheckDocumentOptions = {},
): DocumentProblem[] {
  const problems: DocumentProblem[] = []
  if (document.version !== 1)
    problems.push({
      code: 'version',
      path: 'version',
      text: String(document.version),
      message: `Version ${String(document.version)} is not known`,
    })
  const { schema } = kitOf(options.extensions ?? (defaultKit ??= [editorKit()]))
  const ids = new Set<string>()
  const walk = (blocks: readonly PartialBlock[], at: string) =>
    blocks.forEach((block, i) => {
      const path = `${at}[${i}]`
      checkBlock(block, path, schema, ids, problems)
      if (block.children) walk(block.children, `${path}.children`)
    })
  walk(document.blocks, 'blocks')
  return problems
}

function checkBlock(
  block: PartialBlock,
  path: string,
  schema: Schema,
  ids: Set<string>,
  problems: DocumentProblem[],
) {
  const blockId = block.id
  if (blockId !== undefined) {
    if (ids.has(blockId))
      problems.push({
        code: 'duplicate-id',
        blockId,
        path,
        text: blockId,
        message: `The block id "${blockId}" is used more than once`,
      })
    ids.add(blockId)
  }
  const type = block.type ?? 'paragraph'
  if (!schema.nodes[type]?.isInGroup('blockContent'))
    problems.push({
      code: 'unknown-type',
      blockId,
      path,
      text: type,
      message: `No block type "${type}" is defined; it would show as a paragraph`,
    })
  if (Array.isArray(block.content))
    block.content.forEach((item, i) => {
      const at = `${path}.content[${i}]`
      if (item.type === 'inline' && !schema.nodes[item.name]?.isInline)
        problems.push({
          code: 'unknown-inline',
          blockId,
          path: at,
          text: item.name,
          message: `No inline node "${item.name}" is defined; it would be left out`,
        })
      if (item.type === 'text')
        for (const mark of item.marks ?? [])
          if (!schema.marks[mark])
            problems.push({
              code: 'unknown-mark',
              blockId,
              path: at,
              text: mark,
              message: `No mark "${mark}" is defined; it would be left out`,
            })
    })
  if (block.rows) checkRows(block.rows, `${path}.rows`, blockId, problems)
}

function checkRows(
  rows: readonly PartialTableRow[],
  path: string,
  blockId: string | undefined,
  problems: DocumentProblem[],
) {
  const ids = new Set<string>()
  rows.forEach((row, i) => {
    if (row.id === undefined) return
    if (ids.has(row.id))
      problems.push({
        code: 'duplicate-id',
        blockId,
        path: `${path}[${i}]`,
        text: row.id,
        message: `The row id "${row.id}" is used more than once in a table`,
      })
    ids.add(row.id)
  })
}

const objects = <T>(value: unknown) =>
  (Array.isArray(value) ? value : []).filter(
    (item): item is T => !!item && typeof item === 'object',
  )

/**
 * Brings a saved document up to the current version, and fills what an
 * older or hand-written one may lack (`version`, `blocks`). Blocks that are
 * not objects are dropped; anything else is kept as it is, for the editor
 * to read as it reads partial blocks. Throws for a version newer than this
 * one knows.
 */
export function migrateDocument(input: unknown): EditorDocument<PartialBlock> {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const version = source.version ?? 1
  if (version !== 1) throw new Error(`Editor version ${String(version)} is not known`)
  return { ...source, version: 1, blocks: objects<PartialBlock>(source.blocks) }
}
