import { numberOf, oneOf, recordOf, textOf } from './shared'
import type { StatWidgetProps, TableWidgetColumn, TableWidgetProps, TextWidgetProps } from './types'

/*
 * The props of the built-in widgets as their types say, from whatever JSON
 * was saved: what isn't the right type counts as not set. The widgets and
 * their settings both read through these.
 */

export function statPropsOf(props: Record<string, unknown>): StatWidgetProps {
  const precision = numberOf(props.precision)
  return {
    source: textOf(props.source),
    field: textOf(props.field),
    value: numberOf(props.value),
    prefix: textOf(props.prefix),
    suffix: textOf(props.suffix),
    precision:
      precision !== undefined && Number.isInteger(precision) && precision >= 0 && precision <= 20
        ? precision
        : undefined,
    trend: textOf(props.trend),
    delta: textOf(props.delta),
  }
}

export function textPropsOf(props: Record<string, unknown>): TextWidgetProps {
  const text = props.text
  return {
    text: typeof text === 'number' ? String(text) : textOf(text),
    size: oneOf(props.size, ['sm', 'md', 'lg'] as const),
  }
}

/** The columns given, those with a text `key`; not set when not a list. */
function columnsOf(value: unknown): TableWidgetColumn[] | undefined {
  if (!Array.isArray(value)) return undefined
  const columns: TableWidgetColumn[] = []
  for (const item of value) {
    const column = recordOf(item)
    if (typeof column?.key !== 'string') continue
    const title = textOf(column.title)
    columns.push(title === undefined ? { key: column.key } : { key: column.key, title })
  }
  return columns
}

export function tablePropsOf(props: Record<string, unknown>): TableWidgetProps {
  return {
    source: textOf(props.source),
    path: textOf(props.path),
    columns: columnsOf(props.columns),
    rowKey: textOf(props.rowKey),
  }
}
