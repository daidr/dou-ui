import type { NodeSpec } from 'prosemirror-model'
import type { BlockProps, PartialBlock } from '../../core/model'

/** The most columns a set can have, from the picker or by dropping blocks beside them. */
export const MAX_COLUMNS = 5
export const MIN_COLUMNS = 2

/** A column's width: a positive weight, rounded; anything else is the default (1). */
export function widthOf(value: unknown): number | null {
  const width = Number(value)
  if (value === null || value === undefined || !Number.isFinite(width) || width <= 0) return null
  return Math.min(100, Math.max(0.01, Math.round(width * 1000) / 1000))
}

const countOf = (props: BlockProps) => {
  const count = Math.round(Number(props.count))
  return Number.isFinite(count) ? Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, count)) : MIN_COLUMNS
}

/**
 * A set of columns. Its content node holds no text and isn't shown; its
 * children are `column` blocks, laid out side by side.
 */
export const columnsSpec: NodeSpec = {
  atom: true,
  selectable: false,
  layout: 'row',
  maxColumns: MAX_COLUMNS,
  /** New columns, `props.count` of them (2 by default), each with an empty paragraph. */
  template: (props: BlockProps): PartialBlock[] =>
    Array.from({ length: countOf(props) }, () => ({
      type: 'column',
      children: [{ type: 'paragraph' }],
    })),
  parseDOM: [{ tag: 'div[data-content-type="columns"]' }],
  toDOM: () => [
    'div',
    { class: 'dou-editor__content dou-editor__content--columns', 'data-content-type': 'columns' },
  ],
}

/**
 * One column: its children are the blocks shown in it. `props.width` is
 * its share of the row, a weight against the other columns' (1 when left
 * out), so two people resizing different columns at once both keep theirs.
 */
export const columnSpec: NodeSpec = {
  atom: true,
  selectable: false,
  layout: 'column',
  attrs: { width: { default: null } },
  optionalProps: ['width'],
  normalizeProps: (attrs: { width?: unknown }) =>
    'width' in attrs ? { ...attrs, width: widthOf(attrs.width) } : attrs,
  parseDOM: [
    {
      tag: 'div[data-content-type="column"]',
      getAttrs: (dom) => ({ width: widthOf((dom as HTMLElement).dataset.width) }),
    },
  ],
  toDOM: (node) => [
    'div',
    {
      class: 'dou-editor__content dou-editor__content--column',
      'data-content-type': 'column',
      ...(node.attrs.width ? { 'data-width': String(node.attrs.width) } : {}),
    },
  ],
}
