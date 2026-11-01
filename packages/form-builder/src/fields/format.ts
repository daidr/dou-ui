import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import { DouLink, formatDateValue } from 'dou-ui'
import type { DatePickerType, Locale } from 'dou-ui'
import type { FormFieldNode } from '../core/types'
import type { FormRendererMessages } from '../locale'

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

const warnedTypes = new Set<string>()
function warnObject(type: string) {
  if (process.env.NODE_ENV === 'production' || warnedTypes.has(type)) return
  warnedTypes.add(type)
  console.warn(
    `[@dou-ui/form-builder] a value of field type "${type}" is an object and shows as JSON when read-only; give the type a \`format\` or \`readonlyComponent\``,
  )
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
    warnObject(context.node.type)
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

/**
 * A path through levels of options as their labels, or a list of such
 * paths; only the last label with `showLastOnly`, as the cascader shows it.
 */
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
    return props.showLastOnly ? (labels[labels.length - 1] ?? '') : labels.join(separator)
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

/** One number or time, or both ends of a range. */
export function formatRange(
  value: unknown,
  _props: Record<string, unknown>,
  context: FormFormatContext,
) {
  return Array.isArray(value)
    ? value.map((item) => formatValue(item, context)).join(context.messages.rangeSeparator)
    : formatValue(value, context)
}

/** A date written the way the date picker writes it (`displayFormat`, else the locale's); a range as both ends. */
export function formatDate(
  value: unknown,
  props: Record<string, unknown>,
  context: FormFormatContext,
): string {
  if (Array.isArray(value))
    return value
      .map((item) => formatDate(item, props, context))
      .join(context.messages.rangeSeparator)
  if (typeof value !== 'string') return formatValue(value, context)
  return formatDateValue(value, {
    locale: context.locale,
    type: typeof props.type === 'string' ? (props.type as DatePickerType) : undefined,
    displayFormat: typeof props.displayFormat === 'string' ? props.displayFormat : undefined,
  })
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
