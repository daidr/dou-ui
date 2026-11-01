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
