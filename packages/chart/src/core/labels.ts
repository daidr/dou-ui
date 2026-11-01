import type { Rect } from './painter'
import type { ChartLabelAnchor } from './series'

/*
 * Data labels: text by a point or in a bar. The series say where each
 * label may go; here the text is placed beside that point, and labels
 * that would cover one placed before them, or run off the room they
 * have, are left out. Lines' labels at their end are moved apart instead,
 * so each line keeps its name.
 */

/** Height of a label's box, as tick labels. */
export const DATA_LABEL = 16
/** Room between a label and its point, or the edge of its bar. */
const GAP = 4
/** Room around a label's text inside a bar. */
const PAD = 4

export interface DataLabelInput {
  key: string
  /** The series' index. */
  series: number
  text: string
  anchor: ChartLabelAnchor
  /** Room from the point, past a dot or a line. */
  offset?: number
}

export interface PlacedDataLabel {
  key: string
  series: number
  text: string
  /** The box's top left, in px from the chart's top left. */
  left: number
  top: number
  /** Which end of the text `left` is. */
  align: 'start' | 'middle' | 'end'
  /** In a bar: the color of the bar, for text that reads on it. */
  on?: string
}

type Box = [left: number, top: number, right: number, bottom: number]

const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

/**
 * Places labels in the order given; one that covers a label placed before
 * it (or one of `taken`), or doesn't fit in `bounds` (or in its bar), is
 * left out.
 */
export function placeDataLabels(
  inputs: DataLabelInput[],
  bounds: Rect,
  measure: (text: string) => number,
  /** Labels already there that these must not cover (the ends of lines, say). */
  taken: Box[] = [],
): PlacedDataLabel[] {
  const out: PlacedDataLabel[] = []
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height
  for (const input of inputs) {
    const { anchor, text } = input
    const width = measure(text)
    const [x, y] = anchor.at
    const gap = GAP + (input.offset ?? 0)
    let box: Box
    let align: PlacedDataLabel['align']
    switch (anchor.side) {
      case 'top':
        box = [x - width / 2, y - gap - DATA_LABEL, x + width / 2, y - gap]
        align = 'middle'
        break
      case 'bottom':
        box = [x - width / 2, y + gap, x + width / 2, y + gap + DATA_LABEL]
        align = 'middle'
        break
      case 'right':
        box = [x + gap, y - DATA_LABEL / 2, x + gap + width, y + DATA_LABEL / 2]
        align = 'start'
        break
      case 'left':
        box = [x - gap - width, y - DATA_LABEL / 2, x - gap, y + DATA_LABEL / 2]
        align = 'end'
        break
      default: {
        box = [x - width / 2, y - DATA_LABEL / 2, x + width / 2, y + DATA_LABEL / 2]
        align = 'middle'
        const shape = anchor.box
        // inside a bar: with room around it, or not at all
        if (shape && (width + PAD * 2 > shape.width + 0.5 || DATA_LABEL + PAD > shape.height + 0.5))
          continue
      }
    }
    const room = anchor.room
    if (room !== undefined) {
      const across = anchor.side === 'top' || anchor.side === 'bottom' ? width : DATA_LABEL
      if (across > room + 0.5) continue
    }
    if (box[0] < bounds.x - 0.5 || box[2] > right + 0.5) continue
    if (box[1] < bounds.y - 0.5 || box[3] > bottom + 0.5) continue
    if (taken.some((other) => overlaps(box, other))) continue
    taken.push(box)
    out.push({
      key: input.key,
      series: input.series,
      text,
      left: align === 'start' ? box[0] : align === 'end' ? box[2] : x,
      top: box[1],
      align,
      on: anchor.side === 'center' ? anchor.box?.color : undefined,
    })
  }
  return out
}

/**
 * Moves boxes of `height` centered at `centers` apart along one line so
 * none overlaps the next, keeping each as near its own center as it can
 * and all within `[from, to]`. Gives the new centers, in the same order.
 */
export function spread(centers: number[], height: number, from: number, to: number): number[] {
  const order = centers.map((_, i) => i)
  order.sort((a, b) => centers[a]! - centers[b]!)
  const placed = order.map((i) => centers[i]!)
  const half = height / 2
  // down, keeping each clear of the one above
  for (let k = 0; k < placed.length; k++) {
    const least = k === 0 ? from + half : placed[k - 1]! + height
    if (placed[k]! < least) placed[k] = least
  }
  // then up from the end, where the last ran past it
  for (let k = placed.length - 1; k >= 0; k--) {
    const most = k === placed.length - 1 ? to - half : placed[k + 1]! - height
    if (placed[k]! > most) placed[k] = most
  }
  const out: number[] = Array.from({ length: centers.length })
  order.forEach((i, k) => (out[i] = placed[k]!))
  return out
}

/** Relative luminance of an `rgb()` / `rgba()` color (as the browser gives computed colors), 0 to 1. */
export function luminance(color: string): number | null {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color)
  if (!m) {
    const hex = /^#([\da-f]{6})$/i.exec(color)
    if (!hex) return null
    const n = Number.parseInt(hex[1]!, 16)
    return relative([(n >> 16) & 255, (n >> 8) & 255, n & 255])
  }
  return relative([Number(m[1]), Number(m[2]), Number(m[3])])
}

function relative(rgb: number[]): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255
    return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Contrast ratio between two luminances. */
export const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
