/*
 * Sibling order keys are strings compared character by character. A key
 * between two others can always be made by going one character longer,
 * so moving a task rewrites only that task, which suits collaboration.
 */

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'
const BASE = DIGITS.length

/** Whether a key is made of the characters `orderBetween` uses. */
export const isOrderKey = (key: string) => /^[0-9a-z]*[1-9a-z]$/.test(key)

/**
 * A key that sorts after `before` and before `after`; leave either out for
 * the start or the end. `before` must sort before `after`.
 */
export function orderBetween(before = '', after?: string) {
  let out = ''
  // once the key is below `after` at some character, `after` stops bounding it
  let bound = after
  for (let i = 0; ; i++) {
    const low = i < before.length ? DIGITS.indexOf(before[i]!) : 0
    const high = bound != null ? (i < bound.length ? DIGITS.indexOf(bound[i]!) : 0) : BASE
    if (high - low > 1) return out + DIGITS[Math.ceil((low + high) / 2)]
    out += DIGITS[low]
    if (high > low) bound = undefined
  }
}

/** `count` keys in order, spread out so that later insertions stay short. */
export function orderKeys(count: number) {
  let width = 1
  while (BASE ** width <= count + 1) width++
  const step = Math.floor(BASE ** width / (count + 1))
  return Array.from({ length: count }, (_, i) => {
    let key = ((i + 1) * step).toString(36).padStart(width, '0')
    // a key never ends in 0, so one can always be made before it
    while (key.endsWith('0')) key = key.slice(0, -1)
    return key
  })
}
