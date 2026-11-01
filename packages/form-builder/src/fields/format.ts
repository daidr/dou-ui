import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import { DouLink } from 'dou-ui'
import type { Locale } from 'dou-ui'
import type { FormFieldNode } from '../core/types'
import type { FormRendererMessages } from '../locale'
import { formatMessage } from '../locale'

/** What a field type's `format` gets besides the value and the settings. */
export interface FormFormatContext {
  /** The node being shown. */
  node: FormFieldNode
  /** The renderer's texts, e.g. `yes` and `no`. */
  messages: FormRendererMessages
  /** DouUI's current locale, e.g. for its date patterns. */
  locale: Locale
}

/** The label of each value the options offer, through groups (`options`) and levels (`children`). */
function labelsOf(options: unknown, into = new Map<unknown, string>()) {
  if (!Array.isArray(options)) return into
  for (const option of options) {
    if (option === null || typeof option !== 'object') {
      if (!into.has(option)) into.set(option, String(option))
      continue
    }
    const record = option as {
      value?: unknown
      key?: unknown
      label?: unknown
      options?: unknown
      children?: unknown
    }
    const value = 'value' in record ? record.value : record.key
    if (value !== undefined && !into.has(value))
      into.set(value, typeof record.label === 'string' ? record.label : String(value))
    labelsOf(record.options, into)
    labelsOf(record.children, into)
  }
  return into
}

/** Plain text of any value: lists joined, `true` and `false` as yes and no. */
export function formatValue(value: unknown, context: FormFormatContext): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value))
    return value
      .map((item) => formatValue(item, context))
      .filter(Boolean)
      .join(context.messages.separator)
  if (typeof value === 'boolean') return value ? context.messages.yes : context.messages.no
  if (value instanceof Date) return value.toLocaleString(context.locale.name)
  if (typeof value === 'object') {
    const record = value as { label?: unknown; name?: unknown }
    if (typeof record.label === 'string') return record.label
    if (typeof record.name === 'string') return record.name
    return JSON.stringify(value)
  }
  return String(value)
}

/** The labels of the chosen options, from the setting that holds them (`options` by default). */
export const formatOptions =
  (prop = 'options') =>
  (value: unknown, props: Record<string, unknown>, context: FormFormatContext) => {
    const labels = labelsOf(props[prop])
    const label = (item: unknown) => labels.get(item) ?? formatValue(item, context)
    return Array.isArray(value) ? value.map(label).join(context.messages.separator) : label(value)
  }

/** A path through levels of options as their labels, or a list of such paths. */
export function formatPath(
  value: unknown,
  props: Record<string, unknown>,
  context: FormFormatContext,
) {
  if (!Array.isArray(value)) return formatValue(value, context)
  const separator = typeof props.separator === 'string' ? props.separator : ' / '
  const one = (path: unknown[]) => {
    const labels: string[] = []
    let level: unknown = props.options
    for (const step of path) {
      const option = Array.isArray(level)
        ? (level.find(
            (entry) =>
              entry !== null &&
              typeof entry === 'object' &&
              (entry as { value?: unknown }).value === step,
          ) as { label?: string; children?: unknown } | undefined)
        : undefined
      labels.push(option?.label ?? formatValue(step, context))
      level = option?.children
    }
    return labels.join(separator)
  }
  return Array.isArray(value[0])
    ? (value as unknown[][]).map(one).join(context.messages.separator)
    : one(value)
}

/** A switch or a single box: yes or no, by its `checkedValue` when it has one. */
export function formatToggle(
  value: unknown,
  props: Record<string, unknown>,
  context: FormFormatContext,
) {
  const on = 'checkedValue' in props && props.checkedValue !== undefined ? props.checkedValue : true
  return value === on ? context.messages.yes : context.messages.no
}

/** Text typed into an input, hidden for a password. */
export function formatText(value: unknown, props: Record<string, unknown>) {
  const text = String(value)
  return props.type === 'password' ? '•'.repeat(Math.min(text.length, 8)) : text
}

/** A number, with `precision` decimals when it sets them. */
export function formatNumber(value: unknown, props: Record<string, unknown>) {
  if (typeof value !== 'number') return String(value)
  const precision = typeof props.precision === 'number' ? props.precision : undefined
  return precision === undefined ? String(value) : value.toFixed(precision)
}

/** One number, or both ends of a range. */
export function formatRange(value: unknown, _props: Record<string, unknown>) {
  return Array.isArray(value) ? value.join(' – ') : String(value)
}

/** A date written the way the locale (or `displayFormat`) writes it; a range as both ends. */
export function formatDate(
  value: unknown,
  props: Record<string, unknown>,
  context: FormFormatContext,
): string {
  if (Array.isArray(value)) return value.map((item) => formatDate(item, props, context)).join(' ~ ')
  if (typeof value !== 'string') return formatValue(value, context)
  const quarter = /^(\d{4})-Q([1-4])$/.exec(value)
  if (quarter)
    return formatMessage(context.locale.datePicker.quarter, {
      year: quarter[1]!,
      quarter: quarter[2]!,
    })
  const day = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?([ T].*)?$/.exec(value)
  if (!day) return value
  const [, year, month, date, time] = day
  const region = context.locale.region
  const own = typeof props.displayFormat === 'string' ? props.displayFormat : undefined
  const pattern = date ? (own ?? region.date) : month ? (own ?? region.month) : (own ?? region.year)
  const text = pattern
    .replace(/YYYY/g, year!)
    .replace(/MM/g, month ?? '')
    .replace(/DD/g, date ?? '')
  return time ? `${text} ${time.slice(1)}` : text
}

/** A color, with a swatch before its text. */
export const ColorValue = defineComponent({
  name: 'DouFormColorValue',
  props: { modelValue: { type: String as PropType<string | null>, default: null } },
  setup(props) {
    return () =>
      h('span', { class: 'dou-form-renderer__color' }, [
        h('span', { class: 'dou-form-renderer__swatch', 'aria-hidden': 'true' }, [
          h('span', { style: { background: props.modelValue ?? undefined } }),
        ]),
        props.modelValue,
      ])
  },
})

/** Uploaded files, each a link when it has a `url`. */
export const FilesValue = defineComponent({
  name: 'DouFormFilesValue',
  props: {
    modelValue: {
      type: Array as PropType<{ uid?: string; name: string; url?: string }[]>,
      default: () => [],
    },
  },
  setup(props) {
    return () =>
      h(
        'ul',
        { class: 'dou-form-renderer__files' },
        props.modelValue.map((file, index) =>
          h('li', { key: file.uid ?? index }, [
            file.url ? h(DouLink, { href: file.url, external: true }, () => file.name) : file.name,
          ]),
        ),
      )
  },
})
