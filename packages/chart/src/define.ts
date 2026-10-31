import type { Tone } from 'dou-ui'
import {
  defineComponent,
  type ComponentObjectPropsOptions,
  type ExtractPropTypes,
  type PropType,
} from 'vue'
import type { ChartAccessor, ChartRow } from './core/data'
import type { ChartSeriesKind, ChartValueAxis } from './core/series'
import { useChartPart, useOwnNode } from './context'

/** The props every series component takes. */
const seriesProps = {
  y: { type: [String, Function] as PropType<ChartAccessor>, required: true },
  name: String,
  data: Array as PropType<readonly ChartRow[]>,
  x: [String, Function] as PropType<ChartAccessor>,
  color: String,
  tone: String as PropType<Tone>,
  axis: String as PropType<ChartValueAxis>,
  stack: { type: [String, Boolean] as PropType<string | boolean>, default: undefined },
  hidden: Boolean,
} as const

export interface ChartSeriesOptions<Props extends ComponentObjectPropsOptions> extends Omit<
  ChartSeriesKind<ExtractPropTypes<Props>>,
  'draw'
> {
  /** Props of its own, declared as for any component; they reach `draw` on `series.props`. */
  props?: Props
  /**
   * Draws the series. `series` has its values read into columns (`x.values`,
   * `top`), `view` the scales to turn them into pixels. Draw only through
   * `painter`, and keep to the points on screen for large data.
   */
  draw: ChartSeriesKind<ExtractPropTypes<Props>>['draw']
}

/**
 * Makes a series component of your own. It sits in a `DouChart` like the
 * built-in ones and gets the same axes, stacking, legend and colors:
 * describe how it widens the axes (`zero`, `band`) and how it draws.
 *
 * ```ts
 * const DouChartLollipop = defineChartSeries({
 *   name: 'lollipop',
 *   zero: true,
 *   props: { radius: { type: Number, default: 4 } },
 *   draw(painter, series, view) { … },
 * })
 * ```
 */
export function defineChartSeries<Props extends ComponentObjectPropsOptions = {}>(
  options: ChartSeriesOptions<Props>,
) {
  const { props: own, ...kind } = options
  const component = `DouChart${options.name[0]!.toUpperCase()}${options.name.slice(1)}`
  return defineComponent({
    name: component,
    props: { ...seriesProps, ...(own as Props) },
    setup(props) {
      const el = useOwnNode()
      useChartPart(component, (chart) =>
        chart.addSeries({ kind: kind as ChartSeriesKind<any>, props: props as never, el }),
      )
      return () => null
    },
  })
}
