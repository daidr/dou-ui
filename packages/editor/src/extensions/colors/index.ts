import type { MarkSpec } from 'prosemirror-model'
import { defineEditorExtension } from '../../core/extension'
import ColorMenu from './color-menu.vue'
import { isColor } from './palette'

export { setHighlight, setTextColor, textColors, type TextColor } from './palette'

function colorMark(field: 'color' | 'highlight', tag: string, className: string): MarkSpec {
  return {
    attrs: { value: {} },
    field,
    parseDOM: [
      {
        tag: `${tag}[data-color]`,
        getAttrs: (dom) => {
          const value = (dom as HTMLElement).dataset.color
          return isColor(value) ? { value } : false
        },
      },
      // a plain `<mark>` is a yellow highlight
      ...(tag === 'mark' ? [{ tag: 'mark', attrs: { value: 'yellow' } }] : []),
    ],
    toDOM: (mark) => [tag, { class: className, 'data-color': mark.attrs.value as string }, 0],
  }
}

/**
 * Text and background colors from a palette that follows the theme. The
 * formatting toolbar gets a color menu; the text runs keep the names as
 * `color` and `highlight`.
 */
export const colors = defineEditorExtension({
  name: 'colors',
  marks: {
    textColor: colorMark('color', 'span', 'dou-editor__color'),
    highlight: colorMark('highlight', 'mark', 'dou-editor__highlight'),
  },
  output: {
    marks: {
      textColor: { html: (value) => [`<span data-color="${value}">`, '</span>'] },
      highlight: { html: (value) => [`<mark data-color="${value}">`, '</mark>'] },
    },
  },
  toolbar: [ColorMenu],
})
