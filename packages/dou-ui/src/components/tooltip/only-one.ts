/**
 * Only one tooltip shows at a time: one opened by hover closes the one a
 * keyboard focus left open elsewhere, and the other way round.
 */
let shown: (() => void) | undefined

/** Call when a tooltip opens; `close` is how another tooltip shuts it. */
export function claimTooltip(close: () => void) {
  if (shown !== close) shown?.()
  shown = close
}

/** Call when a tooltip closes. */
export function releaseTooltip(close: () => void) {
  if (shown === close) shown = undefined
}
