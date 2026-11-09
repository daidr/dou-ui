import { describe, expect, it } from 'vitest'
import { contentSpan, handleLeft } from '../dom'

/** Content in a block, at the top level of the editor (or `nested` deeper, e.g. in a column). */
function content(
  className: string,
  style: string,
  rect: { left: number; right: number },
  nested = false,
) {
  const surface = document.createElement('div')
  surface.className = nested ? 'dou-editor__group' : 'dou-editor__surface'
  const block = document.createElement('div')
  block.className = 'dou-editor__block'
  const element = document.createElement('div')
  element.className = className
  element.setAttribute('style', style)
  element.getBoundingClientRect = () => ({ ...rect, top: 0, bottom: 0 }) as DOMRect
  block.append(element)
  surface.append(block)
  document.body.append(surface)
  return element
}

describe('contentSpan', () => {
  it('is the box of ordinary content', () => {
    const element = content('dou-editor__content', 'padding-inline-start: 8px', {
      left: 100,
      right: 500,
    })
    expect(contentSpan(element)).toEqual({ left: 100, right: 500 })
  })

  it('leaves out the margins a wide table reaches into', () => {
    const element = content(
      'dou-editor__content dou-editor__content--table',
      'padding-inline-start: 40px; margin-inline-end: -60px',
      { left: 60, right: 560 },
    )
    expect(contentSpan(element)).toEqual({ left: 100, right: 500 })
  })

  it('is the box of a table deeper in, e.g. in a column', () => {
    const element = content(
      'dou-editor__content dou-editor__content--table',
      'padding-inline-start: 12px',
      { left: 60, right: 560 },
      true,
    )
    expect(contentSpan(element)).toEqual({ left: 60, right: 560 })
  })
})

function wideTable(tableLeft: number) {
  const frame = content(
    'dou-editor__content dou-editor__content--table',
    'padding-inline-start: 100px; margin-inline-start: -100px',
    { left: 0, right: 600 },
  )
  const table = document.createElement('table')
  table.getBoundingClientRect = () => ({ left: tableLeft, right: tableLeft + 900 }) as DOMRect
  frame.append(table)
  return frame
}

describe('handleLeft', () => {
  it('is the left of ordinary content', () => {
    expect(handleLeft(content('dou-editor__content', '', { left: 80, right: 400 }))).toBe(80)
  })

  it('follows a wide table out into the margin as it scrolls', () => {
    // not scrolled: in line with the text
    expect(handleLeft(wideTable(100))).toBe(100)
    // scrolled 60px: the table's left edge has moved out with it
    expect(handleLeft(wideTable(40))).toBe(40)
    // scrolled past the padding: the frame's edge, by the gutter
    expect(handleLeft(wideTable(-200))).toBe(0)
  })
})
