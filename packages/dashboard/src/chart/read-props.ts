import { flagOf, oneOf, recordOf, textOf, textsOf } from '../widgets/shared'
import type { ChartWidgetProps } from './types'

/** The chart widget's props as its type says; what isn't the right type counts as not set. */
export function chartPropsOf(props: Record<string, unknown>): ChartWidgetProps {
  const labels: Record<string, string> = {}
  for (const [key, label] of Object.entries(recordOf(props.labels) ?? {}))
    if (typeof label === 'string') labels[key] = label
  return {
    source: textOf(props.source),
    path: textOf(props.path),
    kind: oneOf(props.kind, ['line', 'area', 'bar', 'pie'] as const),
    x: textOf(props.x),
    y: textsOf(props.y),
    labels,
    stacked: flagOf(props.stacked),
    horizontal: flagOf(props.horizontal),
    filter: textOf(props.filter),
  }
}
