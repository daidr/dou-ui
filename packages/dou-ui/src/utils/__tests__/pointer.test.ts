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

  it('lets go by itself once the finger is lifted, when nothing released it', async () => {
    const list = document.body.appendChild(document.createElement('ul'))
    const item = list.appendChild(document.createElement('li'))
    const lost = vi.fn<() => void>()
    const hold = holdPointer(press(item), list, lost)
    hold.grab()
    item.remove()
    // The lifted finger is only heard by the removed element.
    item.dispatchEvent(new Event('touchend'))
    await new Promise((resolve) => setTimeout(resolve))
    expect(lost).toHaveBeenCalledTimes(1)
    expect(touchmove(window).defaultPrevented).toBe(false)
    // Released already: a later release is harmless, and the hold isn't lost twice.
    hold.release()
    window.dispatchEvent(new Event('touchend'))
    await new Promise((resolve) => setTimeout(resolve))
    expect(lost).toHaveBeenCalledTimes(1)
  })

  it('stays while a released drag already ended it', async () => {
    const item = document.body.appendChild(document.createElement('div'))
    const lost = vi.fn<() => void>()
    const hold = holdPointer(press(item), null, lost)
    hold.grab()
    window.dispatchEvent(new Event('touchend'))
    hold.release()
    await new Promise((resolve) => setTimeout(resolve))
    expect(lost).not.toHaveBeenCalled()
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
