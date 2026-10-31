/**
 * Scales turn data values into pixels and back. They are plain objects
 * with the mapping folded into two numbers, so `map` costs a multiply and
 * an add: it runs once per drawn point.
 */

export type ScaleKind = 'linear' | 'log' | 'time' | 'category'

export interface Scale {
  kind: ScaleKind
  /** The values at the two ends, after rounding to nice numbers. */
  domain: [number, number]
  /** The pixels the two ends of `domain` land on. */
  range: [number, number]
  map(value: number): number
  invert(pixel: number): number
  /** For `category`: the room each category gets, in px. 0 otherwise. */
  step: number
  /** For `category`: the categories. */
  categories: string[]
  /** For all but `log`: `map(v)` is `v * k + b`, for loops that can't afford a call per point. */
  k: number
  b: number
}

/**
 * The step of 1, 2 or 5 times a power of ten that gives closest to
 * `count` steps across `span` (rounding on a log scale, so it may give a
 * few more or fewer).
 */
export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count)
  if (!(raw > 0) || !Number.isFinite(raw)) return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice =
    fraction >= Math.SQRT2 * 5 ? 10 : fraction >= Math.sqrt(10) ? 5 : fraction >= Math.SQRT2 ? 2 : 1
  return nice * power
}

/** The next nice step up: 1 → 2 → 5 → 10. */
export function nextNiceStep(step: number): number {
  const power = 10 ** Math.floor(Math.log10(step) + 1e-9)
  const fraction = Math.round(step / power)
  return (fraction < 2 ? 2 : fraction < 5 ? 5 : 10) * power
}

/** How many decimals tell the ticks of `step` apart. */
export function stepDecimals(step: number): number {
  return Math.max(0, Math.min(20, -Math.floor(Math.log10(step) + 1e-9)))
}

const round = (value: number, decimals: number) => Number(value.toFixed(decimals))

/**
 * A domain wide enough to show `[min, max]`: an empty span is widened, and
 * with `nice` the ends are rounded out to the tick step for about `count` ticks.
 */
export function linearDomain(
  min: number,
  max: number,
  { count = 5, nice = true }: { count?: number; nice?: boolean } = {},
): [number, number] {
  if (!(min <= max)) return [0, 1]
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1
    ;[min, max] = [min - pad, max + pad]
    if (min < 0 && max - pad >= 0) min = 0
  }
  if (!nice) return [min, max]
  // rounded out to the step for the data itself, so the ends stay close to
  // it; a coarser step only when that would make too many steps
  let step = niceStep(max - min, count)
  let lo = Math.floor(min / step) * step
  let hi = Math.ceil(max / step) * step
  for (let guard = 0; guard < 4 && (hi - lo) / step > count * 2 + 1e-9; guard++) {
    step = nextNiceStep(step)
    lo = Math.floor(min / step) * step
    hi = Math.ceil(max / step) * step
  }
  const decimals = stepDecimals(step)
  return [round(lo, decimals), round(hi, decimals)]
}

/** Ticks at the multiples of a nice step inside `[lo, hi]`, about `count` of them. */
export function linearTicks(lo: number, hi: number, count: number): number[] {
  if (!(hi > lo)) return Number.isFinite(lo) ? [lo] : []
  const step = niceStep(hi - lo, count)
  const decimals = stepDecimals(step)
  const first = Math.ceil(lo / step - 1e-9)
  const last = Math.floor(hi / step + 1e-9)
  const ticks: number[] = []
  for (let i = first; i <= last; i++) ticks.push(round(i * step, decimals))
  return ticks
}

export function linearScale(
  domain: [number, number],
  range: [number, number],
  kind: 'linear' | 'time' = 'linear',
): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  const b = d1 === d0 ? (r0 + r1) / 2 : r0 - d0 * k
  return {
    kind,
    domain,
    range,
    step: 0,
    categories: [],
    k,
    b,
    map: (value) => value * k + b,
    invert: (pixel) => (k === 0 ? d0 : (pixel - b) / k),
  }
}

/* log */

/** Rounds out to whole powers of ten; values at or below 0 can't be shown and are left out. */
export function logDomain(min: number, max: number): [number, number] {
  if (!(max > 0)) return [1, 10]
  if (!(min > 0)) min = max / 10
  const lo = 10 ** Math.floor(Math.log10(min))
  let hi = 10 ** Math.ceil(Math.log10(max))
  if (hi === lo) hi = lo * 10
  return [lo, hi]
}

export function logTicks(lo: number, hi: number, count: number): number[] {
  const from = Math.floor(Math.log10(lo) + 1e-9)
  const to = Math.ceil(Math.log10(hi) - 1e-9)
  const decades = to - from
  // few decades: 1, 2 and 5 of each; many: every few powers of ten
  const steps = decades * 3 <= count ? [1, 2, 5] : [1]
  const every = Math.max(1, Math.ceil(decades / Math.max(1, count)))
  const ticks: number[] = []
  for (let e = from; e <= to; e += steps.length > 1 ? 1 : every) {
    for (const s of steps) {
      const v = s * 10 ** e
      if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) ticks.push(Number(v.toPrecision(12)))
    }
  }
  return ticks
}

export function logScale(domain: [number, number], range: [number, number]): Scale {
  const [l0, l1] = [Math.log10(domain[0]), Math.log10(domain[1])]
  const [r0, r1] = range
  const k = l1 === l0 ? 0 : (r1 - r0) / (l1 - l0)
  return {
    kind: 'log',
    domain,
    range,
    step: 0,
    categories: [],
    k: Number.NaN,
    b: Number.NaN,
    // values at or below 0 go off the bottom
    map: (value) => (value > 0 ? r0 + (Math.log10(value) - l0) * k : r0 - (r1 - r0) * 10),
    invert: (pixel) => 10 ** (k === 0 ? l0 : l0 + (pixel - r0) / k),
  }
}

/* category */

/**
 * Categories side by side, each in the middle of its own step. `map(i)` is
 * the middle of category `i`; `domain` is `[-0.5, n - 0.5]` so that a
 * category's step runs from `map(i - 0.5)` to `map(i + 0.5)`.
 */
export function categoryScale(categories: string[], range: [number, number]): Scale {
  const n = Math.max(1, categories.length)
  const scale = linearScale([-0.5, n - 0.5], range)
  return { ...scale, kind: 'category', step: Math.abs(range[1] - range[0]) / n, categories }
}

/** Every `every`-th category index, starting from the first. */
export function categoryTicks(count: number, every = 1): number[] {
  const ticks: number[] = []
  for (let i = 0; i < count; i += every) ticks.push(i)
  return ticks
}

/**
 * The pixel that areas and bars grow from: 0, or the nearer end when 0 is
 * off the axis (always the start on a log axis).
 */
export function baseline(scale: Scale): number {
  if (scale.kind === 'log') return scale.range[0]
  const [a, b] = scale.domain
  return scale.map(Math.min(Math.max(0, Math.min(a, b)), Math.max(a, b)))
}
