import type { SplitterLimit } from '../splitter/splitter'
import type { DockSide } from './layout'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Whether `length` px can hold two parts of at least `min` each beside
 * the 1px divider of a split. A number is a percent of the split.
 */
export function roomForSplit(length: number, min: SplitterLimit) {
  const each = typeof min === 'number' ? (length * min) / 100 : Number.parseFloat(min) || 0
  return length - 1 >= each * 2
}

/**
 * Where a tab dropped at `x`, `y` on a group goes: the nearest edge within
 * reach (a quarter of the side, at least 24px) splits it off there, the
 * rest takes it in. The edges of a direction too small to split in two
 * are part of the middle.
 */
export function dockDropSide(
  box: Box,
  x: number,
  y: number,
  min: { width: SplitterLimit; height: SplitterLimit },
): DockSide | 'center' {
  const edgeX = Math.max(24, box.width / 4)
  const edgeY = Math.max(24, box.height / 4)
  const across = roomForSplit(box.width, min.width)
  const down = roomForSplit(box.height, min.height)
  // each edge's distance relative to its reach
  const reach: [DockSide, number | false][] = [
    ['left', across && (x - box.left) / edgeX],
    ['right', across && (box.left + box.width - x) / edgeX],
    ['top', down && (y - box.top) / edgeY],
    ['bottom', down && (box.top + box.height - y) / edgeY],
  ]
  let best: DockSide | 'center' = 'center'
  let nearest = 1
  for (const [side, d] of reach)
    if (d !== false && d < nearest) {
      nearest = d
      best = side
    }
  return best
}
