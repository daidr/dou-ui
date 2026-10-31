import { describe, expect, it } from 'vitest'
import { contrastRatio } from './create'
import { dark } from './dark'
import { light } from './light'
import type { ThemeTokens } from './types'

describe.each([
  ['light', light],
  ['dark', dark],
] as Array<[string, ThemeTokens]>)('%s syntax colors', (_, theme) => {
  it('read as text on the surface and on muted blocks (4.5:1)', () => {
    const low = Object.entries(theme.color.syntax).filter(([, color]) =>
      [theme.color.bg.surface, theme.color.bg.muted].some((bg) => contrastRatio(color, bg) < 4.5),
    )
    expect(low).toEqual([])
  })
})
