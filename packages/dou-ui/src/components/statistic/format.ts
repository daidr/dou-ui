export interface NumberParts {
  /** `-` or nothing. */
  sign: string
  integer: string
  /** The decimal part with its separator, or nothing. */
  decimal: string
}

/** Split a number into parts, grouped and rounded as asked, without `Intl` rounding surprises. */
export function formatNumber(
  value: number,
  options: { precision?: number; groupSeparator: string; decimalSeparator: string },
): NumberParts {
  if (!Number.isFinite(value)) return { sign: '', integer: String(value), decimal: '' }
  const text =
    options.precision === undefined
      ? String(Math.abs(value))
      : Math.abs(value).toFixed(Math.max(0, Math.min(20, options.precision)))
  // Exponent notation only shows up for numbers too large or small to group.
  if (/e/i.test(text)) return { sign: value < 0 ? '-' : '', integer: text, decimal: '' }
  const [whole = '0', fraction] = text.split('.')
  const integer = options.groupSeparator
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, options.groupSeparator)
    : whole
  const negative = value < 0 && /[1-9]/.test(text)
  return {
    sign: negative ? '-' : '',
    integer,
    decimal: fraction === undefined ? '' : `${options.decimalSeparator}${fraction}`,
  }
}
