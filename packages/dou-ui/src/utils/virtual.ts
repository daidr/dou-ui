/** Lists longer than this render only the rows in view, unless told otherwise. */
export const VIRTUAL_THRESHOLD = 100

/** Whether a list of `count` rows renders virtually: as asked, or once it is long. */
export const shouldVirtualize = (asked: boolean | undefined, count: number) =>
  asked ?? count > VIRTUAL_THRESHOLD

/** The rows of a fixed-height list to render for a viewport scrolled to `scrollTop`. */
export function visibleWindow(
  count: number,
  scrollTop: number,
  viewport: number,
  row: number,
  overscan = 4,
) {
  const from = Math.max(0, Math.floor(scrollTop / row) - overscan)
  return { from, to: Math.min(count, Math.ceil((scrollTop + viewport) / row) + overscan) }
}
