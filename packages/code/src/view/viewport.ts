/**
 * The part of the window in view, above a phone's keyboard and inside a
 * pinch zoom, in the coordinates `getBoundingClientRect` gives.
 *
 * Browsers disagree on what those coordinates are relative to: the layout
 * viewport (so the visual viewport sits `offsetTop` into them), or the
 * visual viewport itself (iOS Safari, where adding `offsetTop` counts the
 * scroll twice). The page's own box tells which: the visual viewport's place
 * in the page, plus where the page starts in those coordinates.
 */
export function visibleViewport(): { left: number; top: number; width: number; height: number } {
  const root = document.documentElement
  const vv = window.visualViewport
  if (!vv) return { left: 0, top: 0, width: root.clientWidth, height: root.clientHeight }
  const page = root.getBoundingClientRect()
  return {
    left: vv.pageLeft + page.left,
    top: vv.pageTop + page.top,
    width: vv.width,
    height: vv.height,
  }
}
