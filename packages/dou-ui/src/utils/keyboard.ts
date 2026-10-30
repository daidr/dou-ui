/**
 * The key press belongs to an input method (e.g. confirming a pinyin
 * candidate), not to the page. Most browsers set `isComposing`; Safari ends
 * the composition first and only leaves `keyCode` 229.
 */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229
}
