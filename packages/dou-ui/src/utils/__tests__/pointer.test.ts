import { afterEach, describe, expect, it, vi } from 'vitest'
import { holdPointer } from '../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

/** A press on `target`, as the drag code gets it in `pointerdown`. */
function press(target: Element, pointerType = 'touch') {
  const event = new PointerEvent('pointerdown', { pointerId: 1, pointerType, bubbles: true })
  target.dispatchEvent(event)
  return event
}

function touchmove(target: EventTarget) {
  const event = new Event('touchmove', { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('holdPointer', () => {
  it('lets the touch scroll until the drag is grabbed, and again once released', () => {
    const item = document.body.appendChild(document.createElement('div'))
    const hold = holdPointer(press(item))
    expect(touchmove(item).defaultPrevented).toBe(false)
    hold.grab()
    expect(touchmove(item).defaultPrevented).toBe(true)
    hold.release()
    expect(touchmove(item).defaultPrevented).toBe(false)
  })

  it('keeps a removed element from scrolling', () => {
    const list = document.body.appendChild(document.createElement('ul'))
    const item = list.appendChild(document.createElement('li'))
    const hold = holdPointer(press(item), list)
    hold.grab()
    item.remove()
    expect(touchmove(item).defaultPrevented).toBe(true)
    hold.release()
  })

  it('captures the pointer on the root while grabbed', () => {
    const list = document.body.appendChild(document.createElement('ul'))
    const item = list.appendChild(document.createElement('li'))
    let captured = false
    const set = vi.fn<(id: number) => void>(() => void (captured = true))
    const release = vi.fn<(id: number) => void>(() => void (captured = false))
    Object.assign(list, {
      setPointerCapture: set,
      releasePointerCapture: release,
      hasPointerCapture: () => captured,
    })
    const hold = holdPointer(press(item), list)
    expect(set).not.toHaveBeenCalled()
    hold.grab()
    expect(set).toHaveBeenCalledWith(1)
    hold.release()
    expect(release).toHaveBeenCalledWith(1)
  })

  it('does nothing for a mouse', () => {
    const item = document.body.appendChild(document.createElement('div'))
    const hold = holdPointer(press(item, 'mouse'), item)
    hold.grab()
    expect(touchmove(item).defaultPrevented).toBe(false)
    hold.release()
  })
})
