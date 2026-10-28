import { describe, expect, it } from 'vitest'
import { computePosition } from '../use-floating'
import type { PositionOptions } from '../use-floating'

const options: PositionOptions = {
  offset: 8,
  padding: 8,
  flip: true,
  viewport: { width: 1000, height: 800 },
}
const reference = { x: 400, y: 300, width: 100, height: 32 }
const size = { width: 200, height: 100 }

describe('computePosition', () => {
  it('places the box on each side, centered or aligned', () => {
    expect(computePosition(reference, size, 'bottom', options)).toMatchObject({
      x: 350,
      y: 340,
      placement: 'bottom',
    })
    expect(computePosition(reference, size, 'top-start', options)).toMatchObject({
      x: 400,
      y: 192,
      placement: 'top-start',
    })
    expect(computePosition(reference, size, 'bottom-end', options)).toMatchObject({ x: 300 })
    expect(computePosition(reference, size, 'right', options)).toMatchObject({ x: 508, y: 266 })
    expect(computePosition(reference, size, 'left', options)).toMatchObject({ x: 192, y: 266 })
  })

  it('flips to the opposite side when the preferred one has no room', () => {
    const nearTop = { ...reference, y: 40 }
    expect(computePosition(nearTop, size, 'top', options)).toMatchObject({
      placement: 'bottom',
      y: 80,
    })
    const nearBottom = { ...reference, y: 740 }
    expect(computePosition(nearBottom, size, 'bottom-start', options).placement).toBe('top-start')
  })

  it('stays put when neither side has room', () => {
    const tall = { width: 200, height: 700 }
    expect(computePosition(reference, tall, 'bottom', options).placement).toBe('bottom')
  })

  it('slides along the edge to stay inside the viewport', () => {
    const nearLeft = { ...reference, x: 0 }
    expect(computePosition(nearLeft, size, 'bottom', options).x).toBe(8)
    const nearRight = { ...reference, x: 950 }
    expect(computePosition(nearRight, size, 'bottom', options).x).toBe(792)
  })

  it('reports the room left on the chosen side', () => {
    expect(computePosition(reference, size, 'bottom', options).available).toBe(452)
  })
})
