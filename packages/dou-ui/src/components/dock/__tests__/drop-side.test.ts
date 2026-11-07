import { describe, expect, it } from 'vitest'
import { dockDropSide, roomForSplit } from '../drop-side'

const box = { left: 0, top: 0, width: 600, height: 400 }
const px = { width: '220px', height: '200px' } as const

describe('dockDropSide', () => {
  it('splits at the nearest edge within reach, takes in the middle', () => {
    expect(dockDropSide(box, 10, 200, px)).toBe('left')
    expect(dockDropSide(box, 590, 200, px)).toBe('right')
    expect(dockDropSide(box, 300, 300, { width: '220px', height: '100px' })).toBe('center')
    expect(dockDropSide(box, 300, 390, { width: '220px', height: '100px' })).toBe('bottom')
  })

  it('treats the edges of a direction without room for two as the middle', () => {
    // 600 wide holds two 220s; 400 high does not hold two 201s
    const tall = { width: '220px', height: '201px' } as const
    expect(dockDropSide(box, 300, 5, tall)).toBe('center')
    expect(dockDropSide(box, 300, 395, tall)).toBe('center')
    expect(dockDropSide(box, 5, 5, tall)).toBe('left')
    // a narrow group: its left and right edges merge too
    const narrow = { ...box, width: 300 }
    expect(dockDropSide(narrow, 5, 200, px)).toBe('center')
    expect(dockDropSide(narrow, 295, 200, px)).toBe('center')
  })

  it('counts the 1px divider and takes percent of the split', () => {
    expect(roomForSplit(441, '220px')).toBe(true)
    expect(roomForSplit(440, '220px')).toBe(false)
    // percent of what the divider leaves, as in DouSplitter: 50 is two halves
    expect(roomForSplit(300, 50)).toBe(true)
    expect(roomForSplit(300, 51)).toBe(false)
  })
})
