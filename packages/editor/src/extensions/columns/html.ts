import type { BlockOutput } from '../../core/output'
import { blockElement } from '../../core/prepare'
import { widthOf } from './schema'

/**
 * Columns in HTML: a flex row of `div`s, each with its share of the row,
 * so the page shows them side by side without the editor's styles.
 * Markdown has no columns: their blocks follow one another.
 */
export const columnsOutput: Record<string, BlockOutput> = {
  columns: {
    html: (_block, { children }) =>
      `<div data-columns style="display: flex; gap: 2em">${children}</div>`,
    markdown: (_block, { children }) => children,
  },
  column: {
    html: (block, { children }) => {
      const width = widthOf(block.props.width)
      const data = width ? ` data-width="${width}"` : ''
      return `<div data-column${data} style="flex: ${width ?? 1} 1 0; min-width: 0">${children}</div>`
    },
    markdown: (_block, { children }) => children,
  },
}

/** Back from that HTML: `div[data-columns]` and the `div[data-column]` in it. */
export function prepareColumns(root: HTMLElement) {
  const doc = root.ownerDocument
  for (const element of Array.from(root.querySelectorAll('div[data-column]'))) {
    const width = widthOf((element as HTMLElement).dataset.width)
    element.replaceWith(
      blockElement(
        doc,
        'column',
        [],
        Array.from(element.childNodes),
        width ? { width: String(width) } : {},
      ),
    )
  }
  for (const element of Array.from(root.querySelectorAll('div[data-columns]')))
    element.replaceWith(blockElement(doc, 'columns', [], Array.from(element.childNodes)))
}
