import type { Command } from 'prosemirror-state'

/** The palette names; the colors follow the theme and the light or dark scheme. */
export const textColors = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const

export type TextColor = (typeof textColors)[number]

export const isColor = (value: unknown): value is TextColor =>
  textColors.includes(value as TextColor)

/** Set (or with `null` clear) the text color of the selection. */
export function setTextColor(color: TextColor | null): Command {
  return setColor('textColor', color)
}

/** Set (or with `null` clear) the background color of the selection. */
export function setHighlight(color: TextColor | null): Command {
  return setColor('highlight', color)
}

function setColor(name: string, color: TextColor | null): Command {
  return (state, dispatch) => {
    const type = state.schema.marks[name]
    const { from, to, empty } = state.selection
    if (!type || empty) return false
    if (dispatch) {
      const tr = state.tr.removeMark(from, to, type)
      if (color) tr.addMark(from, to, type.create({ value: color }))
      dispatch(tr)
    }
    return true
  }
}
