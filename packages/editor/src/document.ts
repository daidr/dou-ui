import type { Schema } from 'prosemirror-model'
import { kitOf, type EditorExtensionList } from './core/convert'
import type { Block, EditorDocument, PartialBlock, PartialTableRow } from './core/model'
import { editorKit } from './extensions/editor-kit'

/** A document with no blocks, to start from when nothing is saved yet. */
export const emptyDocument = (): EditorDocument<Block> => ({ version: 1, blocks: [] })

export interface DocumentProblem {
  code: 'version' | 'shape' | 'duplicate-id' | 'unknown-type' | 'unknown-mark' | 'unknown-inline'
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
 * The problems of an editor document, before it is saved or shown: an
 * unknown version, blocks or table rows sharing an id, and block types,
 * marks and inline nodes the extensions don't define, which the editor
 * would show as a paragraph or leave out.
 */
export function checkDocument(
  document: EditorDocument<PartialBlock>,
  options: CheckDocumentOptions = {},
): DocumentProblem[] {
  const shape = shapeProblems(document, ['blocks'])
  if (shape.length) return shape
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

/** The saved data as an object of version 1, or an error saying why it can't be. */
function sourceOf(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error(
      `[@dou-ui/editor] an editor document must be an object, not ${Array.isArray(input) ? 'an array' : (JSON.stringify(input) ?? String(input))}`,
    )
  const source = input as Record<string, unknown>
  const version = source.version ?? 1
  if (version !== 1)
    throw new Error(
      `[@dou-ui/editor] unknown document version ${JSON.stringify(version) ?? String(version)} (expected 1); data saved by a newer @dou-ui/editor needs that version to open`,
    )
  return source
}

/**
 * Brings a saved document up to the current version, and fills what an
 * older or hand-written one may lack (`version`, `blocks`). Blocks that are
 * not objects are dropped; anything else is kept as it is, for the editor
 * to read as it reads partial blocks. Throws for data that is not an object (an array,
 * `null`, a string) and for a version it does not know.
 */
export function migrateDocument(input: unknown): EditorDocument<PartialBlock> {
  const source = sourceOf(input)
  return { ...source, version: 1, blocks: objects<PartialBlock>(source.blocks) }
}

const warned = new Set<string>()

/**
 * The blocks of the `v-model`, as the editor reads them. A document of the
 * wrong shape (not an object, a bare list of blocks, without `blocks` or a
 * known `version`) gets a warning in development and is read as well as it
 * can be: a list as the blocks, anything else missing as no blocks. What
 * the editor writes back always carries `version: 1`. `undefined`, no
 * `v-model` bound, is fine.
 */
export function readBlocks(value: unknown): PartialBlock[] | undefined {
  if (value === undefined) return undefined
  const plain = !!value && typeof value === 'object' && !Array.isArray(value)
  const source = (plain ? value : {}) as Partial<EditorDocument<PartialBlock>>
  const blocks = Array.isArray(source.blocks)
  const problem = Array.isArray(value)
    ? 'is a list of blocks'
    : !plain
      ? `is ${JSON.stringify(value) ?? String(value)}`
      : !blocks
        ? 'has no blocks array'
        : source.version === undefined
          ? 'has no version'
          : source.version !== 1
            ? `has version ${JSON.stringify(source.version)}`
            : ''
  if (problem && process.env.NODE_ENV !== 'production' && !warned.has(problem)) {
    warned.add(problem)
    console.warn(
      `[@dou-ui/editor] the v-model ${problem}; expected { version: 1, blocks: [...] }. It is read as well as it can be and the version as 1; read saved data with migrateDocument().`,
    )
  }
  if (Array.isArray(value)) return value as PartialBlock[]
  return blocks ? source.blocks : []
}
