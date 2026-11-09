import { describe, expect, it } from 'vitest'
import { contentSpan } from '../dom'

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
    const element = content('dou-editor__content', 'padding-left: 8px', { left: 100, right: 500 })
    expect(contentSpan(element)).toEqual({ left: 100, right: 500 })
  })

  it('leaves out the margins a wide table reaches into', () => {
    const element = content(
      'dou-editor__content dou-editor__content--table',
      'padding-left: 40px; margin-right: -60px',
      { left: 60, right: 560 },
    )
    expect(contentSpan(element)).toEqual({ left: 100, right: 500 })
  })
})
