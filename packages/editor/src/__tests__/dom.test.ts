import { describe, expect, it } from 'vitest'
import { contentSpan, handleLeft } from '../dom'

function content(className: string, style: string, rect: { left: number; right: number }) {
  const element = document.createElement('div')
  element.className = className
  element.setAttribute('style', style)
  element.getBoundingClientRect = () => ({ ...rect, top: 0, bottom: 0 }) as DOMRect
  document.body.append(element)
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
