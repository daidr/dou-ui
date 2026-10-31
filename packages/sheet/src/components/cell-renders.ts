import { CheckIcon } from '@dou-ui/icons'
import { h, type FunctionalComponent } from 'vue'
import { optionOf, type SheetCellRenderProps } from '../core/cell-type'

/*
 * The built-in types' cell content. Functional: they are drawn for every
 * visible cell of their type, so they have no instance of their own.
 */

const PROPS = ['value', 'text', 'setup', 'readonly'] as const

/** A check box cell: the box of a checkbox, which a click switches. */
export const CellCheck: FunctionalComponent<SheetCellRenderProps> = (props) =>
  h(
    'span',
    {
      class: props.value === true ? 'dou-sheet__check is-checked' : 'dou-sheet__check',
      'data-sheet-toggle': '',
      'aria-hidden': 'true',
    },
    h(CheckIcon, { strokeWidth: 2 }),
  )
CellCheck.props = PROPS as unknown as string[]

/**
 * A select cell: its value as a soft tag, in its option's tone or neutral.
 * A value that isn't one of the options shows as plain text.
 */
export const CellOption: FunctionalComponent<SheetCellRenderProps> = (props) => {
  let found = false
  let tone
  for (const option of props.setup.options ?? []) {
    const picked = optionOf(option)
    if (picked.value === props.value) {
      found = true
      tone = picked.tone
      break
    }
  }
  if (!found || !props.text) return h('span', { class: 'dou-sheet__text' }, props.text)
  const cls = 'dou-tag dou-tag--soft dou-sheet__tag'
  return h(
    'span',
    { class: tone && tone !== 'neutral' ? `${cls} dou-tag--${tone}` : cls },
    props.text,
  )
}
CellOption.props = PROPS as unknown as string[]
