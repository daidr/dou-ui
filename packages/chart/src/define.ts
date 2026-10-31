import type { Tone } from 'dou-ui'
import {
  defineComponent,
  useModel,
  type ComponentObjectPropsOptions,
  type ExtractPropTypes,
  type PropType,
} from 'vue'
import type { ChartAccessor, ChartData } from './core/data'
import type { ChartSeriesKind, ChartValueAxis } from './core/series'
import { useChartPart, useOwnNode } from './context'

/** The props every series component takes. */
const seriesProps = {
  y: { type: [String, Function] as PropType<ChartAccessor>, required: true },
  name: String,
  data: [Array, Object] as PropType<ChartData>,
  x: [String, Function] as PropType<ChartAccessor>,
  color: String,
  tone: String as PropType<Tone>,
  axis: String as PropType<ChartValueAxis>,
  stack: { type: [String, Boolean] as PropType<string | boolean>, default: undefined },
  /** Turned off in the legend (`v-model:hidden`). */
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
   * `top`), `view` the scales; `view.point(x, value)` gives where a value lands. Draw only through
   * `painter`, and keep to the points on screen for large data.
   */
  draw: ChartSeriesKind<ExtractPropTypes<Props>>['draw']
}

/**
 * Makes a series component of your own. It sits in a `DouChart` like the
 * built-in ones and gets the same axes, stacking, legend and colors:
 * describe how it widens the axes (`zero`, `band`, `inset`) and how it draws.
 *
 * ```ts
 * const DouChartLollipop = defineChartSeries({
 *   type: 'lollipop',
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
  const component = `DouChart${options.type[0]!.toUpperCase()}${options.type.slice(1)}`
  return defineComponent({
    name: component,
    props: { ...seriesProps, ...(own as Props) },
    emits: ['update:hidden'],
    setup(props) {
      const el = useOwnNode()
      const hidden = useModel(props as { hidden: boolean }, 'hidden')
      useChartPart(component, (chart) =>
        chart.addSeries({ kind: kind as ChartSeriesKind<any>, props: props as never, el, hidden }),
      )
      return () => null
    },
  })
}
