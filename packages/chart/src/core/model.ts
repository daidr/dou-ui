import {
  extent,
  byIndex,
  inferXKind,
  rowCount,
  xColumn,
  yColumn,
  type ChartAccessor,
  type ChartData,
  type XColumn,
  type XKind,
} from './data'
import type { ChartSeriesKind, ChartSeriesProps, ChartValueAxis } from './series'
import { waterfallSteps } from './waterfall'
import { boxesOf } from './box'

/** A series as registered by its component. */
export interface SeriesInput {
  index: number
  kind: ChartSeriesKind<any>
  props: ChartSeriesProps & {
    stack?: string | boolean
    /** An area's bottom of its own: a band from it up to `y`. */
    y0?: ChartAccessor
    /** A heatmap's value of each cell (its `y` names the row's category). */
    value?: ChartAccessor
  } & Record<string, unknown>
  /** Turned off (in the legend): left out of the axes and not drawn. */
  hidden?: boolean
}

/** What a series is called: its `name`, else its `y` key, else its place. */
export function seriesName(input: Pick<SeriesInput, 'index' | 'props'>): string {
  return (
    input.props.name ?? (typeof input.props.y === 'string' ? input.props.y : `${input.index + 1}`)
  )
}

/** A series with its data read, before colors are worked out. */
export interface ModelSeries {
  input: SeriesInput
  name: string
  rows: ChartData
  axis: ChartValueAxis
  x: XColumn
  y: Float64Array
  top: Float64Array
  base: Float64Array | null
  stackEnds: { up: Float64Array; down: Float64Array } | null
  slot: { index: number; count: number } | null
  /** A heatmap's categories down the value axis, as read. */
  yColumn?: XColumn
}

export interface ChartModel {
  series: ModelSeries[]
  xKind: XKind
  categories: string[]
  /** The smallest and largest x (for `category`: the first and last category index). */
  x: [number, number] | null
  /** The smallest and largest value on each y axis, with 0 when a series grows from it. */
  y: Record<ChartValueAxis, [number, number] | null>
  /** Whether each y axis must reach 0. */
  zero: Record<ChartValueAxis, boolean>
  /** The categories of value axes that list them (a heatmap's rows), first at the top; `null` for number axes. */
  yCategories: Record<ChartValueAxis, string[] | null>
  /** Whether every x is a whole number (years, counts): the x axis then has no ticks in between. */
  xIntegers: boolean
  /**
   * For series that take a band of each x (bars) on a number or time axis:
   * the smallest distance between two x values, which is one band. `NaN`
   * when there is no such series or no two values.
   */
  xStep: number
  /** The most room any series needs around its points, in px (bubbles). */
  inset: number
}

const extents = new WeakMap<Float64Array, [number, number] | null>()
function cachedExtent(values: Float64Array): [number, number] | null {
  if (!extents.has(values)) extents.set(values, extent(values))
  return extents.get(values)!
}

/** The first and last number of a sorted column: its extent, without going through it. */
function ends(values: Float64Array): [number, number] | null {
  let a = 0
  let b = values.length - 1
  while (a <= b && values[a] !== values[a]) a++
  while (b >= a && values[b] !== values[b]) b--
  return a <= b ? [values[a]!, values[b]!] : null
}

const wholes = new WeakMap<Float64Array, boolean>()
function allIntegers(values: Float64Array): boolean {
  let known = wholes.get(values)
  if (known === undefined) {
    known = true
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!
      if (v === v && !Number.isInteger(v)) {
        known = false
        break
      }
    }
    wholes.set(values, known)
  }
  return known
}

const merge = (a: [number, number] | null, b: [number, number] | null): [number, number] | null =>
  !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.max(a[1], b[1])]

/**
 * Reads the data of every shown series into columns, lines up categories
 * shared by series with their own data, stacks what stacks, and finds the
 * range of each axis.
 */
export function buildModel(
  inputs: SeriesInput[],
  chart: {
    data: ChartData
    x?: ChartAccessor
    xKind?: XKind
    /** The y axis of series that don't name one. */
    axis?: ChartValueAxis
    /** Value axes whose stacks show each part's share of the whole (0 to 1). */
    percent?: Partial<Record<ChartValueAxis, boolean>>
    /**
     * The order of the categories along x: by their totals (the sum of the
     * shown series' values), or as a function of two category names orders
     * them. As they come in the data when not given.
     */
    sort?: ChartCategorySort
  },
): ChartModel {
  const shown = inputs.filter((input) => !input.hidden)
  const sourceOf = (input: SeriesInput) => ({
    rows: input.props.data ?? chart.data,
    x: input.props.x ?? chart.x,
  })

  // how x is read: as the x axis says, else guessed from the first series with data
  let xKind = chart.xKind
  // a radar's spokes are its categories, whatever they are written as
  if (shown.some((input) => input.kind.polar)) xKind = 'category'
  if (!xKind) {
    xKind = 'linear'
    for (const input of shown) {
      const { rows, x } = sourceOf(input)
      if (x !== undefined && rowCount(rows)) {
        xKind = inferXKind(rows, x)
        break
      }
    }
  }
  const kind = xKind

  const series: ModelSeries[] = shown.map((input) => {
    const { rows, x } = sourceOf(input)
    // no x: rows are placed by their index
    const column = xColumn(rows, x ?? byIndex, x === undefined ? 'linear' : kind)
    const name = seriesName(input)
    if (input.kind.categoryY) {
      // a heatmap: `y` names a category, `value` is the cell's value
      const value = input.props.value
      const values = value === undefined ? new Float64Array(rowCount(rows)) : yColumn(rows, value)
      const places = xColumn(rows, input.props.y, 'category')
      return {
        input,
        name,
        rows,
        axis: input.props.axis ?? chart.axis ?? 'y',
        x: column,
        y: values,
        top: places.values,
        base: null,
        stackEnds: null,
        slot: null,
        yColumn: places,
      }
    }
    if (input.kind.box) {
      const list = boxesOf(rows, input.props.y, input.props.whisker as number | undefined)
      const n = list.length
      const [y, top, base] = [new Float64Array(n), new Float64Array(n), new Float64Array(n)]
      list.forEach((box, i) => {
        if (!box) {
          y[i] = top[i] = base[i] = Number.NaN
          return
        }
        y[i] = box.median
        base[i] = Math.min(box.low, ...box.outliers)
        top[i] = Math.max(box.high, ...box.outliers)
      })
      return {
        input,
        name,
        rows,
        axis: input.props.axis ?? chart.axis ?? 'y',
        x: column,
        y,
        top,
        base,
        stackEnds: null,
        slot: null,
      }
    }
    const y = yColumn(rows, input.props.y)
    if (input.kind.waterfall) {
      const steps = waterfallSteps(rows, y, input.props.total as ChartAccessor | undefined)
      return {
        input,
        name,
        rows,
        axis: input.props.axis ?? chart.axis ?? 'y',
        x: column,
        ...steps,
        stackEnds: null,
        slot: null,
      }
    }
    const y0 = input.props.y0
    return {
      input,
      name,
      rows,
      axis: input.props.axis ?? chart.axis ?? 'y',
      x: column,
      y,
      top: y,
      // a band: its bottom is read like its top
      base: y0 === undefined ? null : yColumn(rows, y0),
      stackEnds: null,
      slot: null,
    }
  })

  // categories of series with their own data are merged, in order of first appearance
  let categories: string[] = []
  if (kind === 'category') {
    const columns = [...new Set(series.map((s) => s.x))]
    if (columns.length === 1) categories = columns[0]!.categories
    else {
      const at = new Map<string, number>()
      for (const column of columns)
        for (const label of column.categories) if (!at.has(label)) at.set(label, at.size)
      categories = [...at.keys()]
      const remapped = new Map<XColumn, XColumn>()
      for (const column of columns) {
        const values = new Float64Array(column.values.length)
        for (let i = 0; i < values.length; i++)
          values[i] = at.get(column.categories[column.values[i]!]!)!
        remapped.set(column, { ...column, values, categories, sorted: false })
      }
      for (const s of series) s.x = remapped.get(s.x)!
    }
  }

  if (kind === 'category' && chart.sort && categories.length > 1)
    categories = sortCategories(series, categories, chart.sort)

  const yCategories = categoriesDown(series)

  stack(series, chart.percent ?? {})
  assignSlots(series)

  let x: [number, number] | null = null
  let xStep = Number.NaN
  if (kind === 'category') x = categories.length ? [0, categories.length - 1] : null
  else {
    for (const s of series) {
      x = merge(x, s.x.sorted ? ends(s.x.values) : cachedExtent(s.x.values))
      if (s.input.kind.band) {
        const gap = smallestGap(s.x.values)
        if (!(gap >= xStep)) xStep = gap
      }
    }
  }

  const y: ChartModel['y'] = { y: null, y2: null }
  const zero: ChartModel['zero'] = { y: false, y2: false }
  for (const s of series) {
    if (yCategories[s.axis]) continue
    y[s.axis] = merge(y[s.axis], cachedExtent(s.top))
    if (s.base) y[s.axis] = merge(y[s.axis], cachedExtent(s.base))
    // a band floats where its values are; what grows from 0 makes the axis reach it
    if (s.input.kind.zero && s.input.props.y0 === undefined) zero[s.axis] = true
  }

  const xIntegers = kind === 'linear' && series.every((s) => allIntegers(s.x.values))
  let inset = 0
  for (const s of series)
    inset = Math.max(
      inset,
      s.input.kind.inset?.({ props: s.input.props, rows: s.rows, x: s.x, y: s.y }) ?? 0,
    )
  for (const axis of ['y', 'y2'] as const) {
    const list = yCategories[axis]
    if (list) y[axis] = list.length ? [0, list.length - 1] : null
  }
  return { series, xKind: kind, categories, x, y, zero, yCategories, xIntegers, xStep, inset }
}

/** How categories along x are ordered: by their totals, or by a comparison of their names. */
export type ChartCategorySort = 'ascending' | 'descending' | ((a: string, b: string) => number)

/** `categories` put in the order `sort` asks for, the series' x moved with them. */
function sortCategories(
  series: ModelSeries[],
  categories: string[],
  sort: ChartCategorySort,
): string[] {
  const order = categories.map((_, i) => i)
  if (typeof sort === 'function') order.sort((a, b) => sort(categories[a]!, categories[b]!))
  else {
    const totals = new Float64Array(categories.length)
    for (const s of series) {
      // a heatmap's values are cells, not amounts along x
      if (s.input.kind.categoryY) continue
      for (let i = 0; i < s.y.length; i++) {
        const x = s.x.values[i]!
        const v = s.y[i]!
        if (x === x && v === v) totals[x] = totals[x]! + v
      }
    }
    const sign = sort === 'descending' ? -1 : 1
    // ties keep the order they came in
    order.sort((a, b) => sign * (totals[a]! - totals[b]!) || a - b)
  }
  const place = new Float64Array(categories.length)
  order.forEach((from, to) => (place[from] = to))
  const sorted = order.map((i) => categories[i]!)
  const moved = new Map<XColumn, XColumn>()
  for (const s of series) {
    let column = moved.get(s.x)
    if (!column) {
      const values = new Float64Array(s.x.values.length)
      for (let i = 0; i < values.length; i++) {
        const v = s.x.values[i]!
        values[i] = v === v ? place[v]! : v
      }
      column = { ...s.x, values, categories: sorted, sorted: false }
      moved.set(s.x, column)
    }
    s.x = column
  }
  return sorted
}

/**
 * The categories down each value axis of series that list them
 * (heatmaps), merged in order of first appearance; each series' `top`
 * then gives its rows' places among them.
 */
function categoriesDown(series: ModelSeries[]): ChartModel['yCategories'] {
  const out: ChartModel['yCategories'] = { y: null, y2: null }
  for (const axis of ['y', 'y2'] as const) {
    const own = series.filter((s) => s.axis === axis && s.yColumn)
    if (!own.length) continue
    const at = new Map<string, number>()
    for (const s of own)
      for (const label of s.yColumn!.categories) if (!at.has(label)) at.set(label, at.size)
    for (const s of own) {
      const { values, categories } = s.yColumn!
      const top = new Float64Array(values.length)
      for (let i = 0; i < values.length; i++) {
        const v = values[i]!
        top[i] = v === v ? at.get(categories[v]!)! : Number.NaN
      }
      s.top = top
    }
    out[axis] = [...at.keys()]
  }
  return out
}

const gaps = new WeakMap<Float64Array, number>()
/** The smallest distance between two different values, or `NaN` with fewer than two. */
export function smallestGap(values: Float64Array): number {
  let gap = gaps.get(values)
  if (gap === undefined) {
    // typed arrays sort as numbers, NaN last
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
    const sorted = values.slice().sort()
    gap = Number.NaN
    for (let i = 1; i < sorted.length; i++) {
      const d = sorted[i]! - sorted[i - 1]!
      if (d > 0 && !(d >= gap)) gap = d
    }
    gaps.set(values, gap)
  }
  return gap
}

/**
 * Gives each series that takes a band of each x (bars) its part of it: a
 * stack shares one part, every other series gets its own.
 */
function assignSlots(series: ModelSeries[]) {
  const keys = new Map<string, number>()
  const banded = series.filter((s) => s.input.kind.band)
  const keyOf = (s: ModelSeries) => {
    const name = s.input.props.stack
    return s.stackEnds && name !== undefined && name !== false
      ? `${s.axis}\u0000${name === true ? '' : name}`
      : `#${s.input.index}`
  }
  for (const s of banded) {
    const key = keyOf(s)
    if (!keys.has(key)) keys.set(key, keys.size)
  }
  for (const s of banded) s.slot = { index: keys.get(keyOf(s))!, count: keys.size }
}

/**
 * Stacks series that share a `stack` name, the same axis and the same x
 * values: each sits on the ones before it, positives upwards and
 * negatives downwards. A gap counts as 0 for the ones above. On a
 * `percent` axis, each stack is then scaled to reach 1 at every x: what
 * it reaches up and down together.
 */
function stack(series: ModelSeries[], percent: Partial<Record<ChartValueAxis, boolean>>) {
  const groups = new Map<string, ModelSeries[]>()
  for (const s of series) {
    const name = s.input.props.stack
    if (!s.input.kind.stackable || name === undefined || name === false) continue
    if (s.input.props.y0 !== undefined) {
      if (process.env.NODE_ENV !== 'production')
        console.warn(
          `[@dou-ui/chart] series "${s.name}" has both \`y0\` and \`stack\`: a band can't stack, so it is drawn unstacked.`,
        )
      continue
    }
    const key = `${s.axis}\u0000${name === true ? '' : name}`
    const group = groups.get(key)
    if (!group) groups.set(key, [s])
    else if (group[0]!.x === s.x) group.push(s)
    // the app's bundler replaces this, as for Vue's own warnings
    else if (process.env.NODE_ENV !== 'production')
      console.warn(
        `[@dou-ui/chart] series "${s.name}" has other x values than its stack, so it is drawn unstacked.`,
      )
  }
  for (const group of groups.values()) {
    const length = group[0]!.y.length
    const up = new Float64Array(length)
    const down = new Float64Array(length)
    for (const s of group) {
      const base = new Float64Array(length)
      const top = new Float64Array(length)
      for (let i = 0; i < length; i++) {
        const v = s.y[i]!
        if (v !== v) {
          // a gap: no slice of its own, the next one sits where it would
          base[i] = top[i] = Number.NaN
          continue
        }
        const from = v >= 0 ? up[i]! : down[i]!
        base[i] = from
        top[i] = from + v
        if (v >= 0) up[i] = top[i]!
        else down[i] = top[i]!
      }
      s.base = base
      s.top = top
      s.stackEnds = { up, down }
    }
    if (!percent[group[0]!.axis]) continue
    for (let i = 0; i < length; i++) {
      const total = up[i]! - down[i]!
      if (!(total > 0)) continue
      for (const s of group) {
        const base = s.base!
        base[i] = base[i]! / total
        s.top[i] = s.top[i]! / total
      }
      up[i] = up[i]! / total
      down[i] = down[i]! / total
    }
  }
}
