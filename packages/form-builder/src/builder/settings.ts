import {
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownSquareIcon,
  ClockIcon,
  HashIcon,
  InfoSquareIcon,
  LayoutIcon,
  LayoutListIcon,
  ListChecksIcon,
  ListTreeIcon,
  OtpIcon,
  PaletteIcon,
  RadioIcon,
  SegmentedControlIcon,
  SeparatorHorizontalIcon,
  SlidersIcon,
  SquareDashedIcon,
  StarIcon,
  StepsIcon,
  TabsIcon,
  TagsIcon,
  TextAlignLeftIcon,
  TextCursorIcon,
  ToggleRightIcon,
  TreeStructureIcon,
  TypeIcon,
  UploadIcon,
} from '@dou-ui/icons'
import { markRaw } from 'vue'
import type { Component } from 'vue'
import type { FormDocument, FormFieldNode, FormListNode, FormNode } from '../core/types'
import type { FormFieldType } from '../fields/define'
import type { FormBuilderMessages } from './locale'

/** The palette groups in the order they are listed; groups of other names follow. */
export const paletteGroups = ['input', 'choice', 'more', 'display', 'layout']

const raw = (icon: Component) => markRaw(icon)

/** Icons and groups of the built-in types, kept out of the renderer's entry. */
const builtinLooks: Record<string, { icon: Component; group: string }> = {
  input: { icon: raw(TextCursorIcon), group: 'input' },
  textarea: { icon: raw(TextAlignLeftIcon), group: 'input' },
  'input-number': { icon: raw(HashIcon), group: 'input' },
  'input-tag': { icon: raw(TagsIcon), group: 'input' },
  'input-otp': { icon: raw(OtpIcon), group: 'input' },
  select: { icon: raw(ChevronDownSquareIcon), group: 'choice' },
  'radio-group': { icon: raw(RadioIcon), group: 'choice' },
  'checkbox-group': { icon: raw(ListChecksIcon), group: 'choice' },
  checkbox: { icon: raw(CheckSquareIcon), group: 'choice' },
  switch: { icon: raw(ToggleRightIcon), group: 'choice' },
  'segmented-control': { icon: raw(SegmentedControlIcon), group: 'choice' },
  cascader: { icon: raw(ListTreeIcon), group: 'choice' },
  'tree-select': { icon: raw(TreeStructureIcon), group: 'choice' },
  slider: { icon: raw(SlidersIcon), group: 'more' },
  rate: { icon: raw(StarIcon), group: 'more' },
  'date-picker': { icon: raw(CalendarIcon), group: 'more' },
  'time-picker': { icon: raw(ClockIcon), group: 'more' },
  'color-picker': { icon: raw(PaletteIcon), group: 'more' },
  upload: { icon: raw(UploadIcon), group: 'more' },
  text: { icon: raw(TypeIcon), group: 'display' },
  divider: { icon: raw(SeparatorHorizontalIcon), group: 'display' },
  alert: { icon: raw(InfoSquareIcon), group: 'display' },
  section: { icon: raw(SquareDashedIcon), group: 'layout' },
  tabs: { icon: raw(TabsIcon), group: 'layout' },
  steps: { icon: raw(StepsIcon), group: 'layout' },
  list: { icon: raw(LayoutListIcon), group: 'layout' },
  page: { icon: raw(LayoutIcon), group: 'layout' },
}

/** The containers the palette offers, after the field types. */
export const containerTypes = ['section', 'tabs', 'steps', 'list']

/** A type's icon: its own, else the built-in one, else a plain box. */
export function iconOf(type: string, spec?: FormFieldType): Component {
  return spec?.icon ?? builtinLooks[type]?.icon ?? builtinLooks.section!.icon
}

export function groupOf(type: string, spec?: FormFieldType): string {
  return spec?.group ?? builtinLooks[type]?.group ?? 'more'
}

/** A type's name for people: its own `label`, else the locale's. */
export function labelOf(
  type: string,
  spec: FormFieldType | undefined,
  messages: FormBuilderMessages,
) {
  return spec?.label ?? messages.types[type] ?? type
}

/** What a node is called in the outline and the inspector's heading. */
export function nodeTitle(
  node: FormNode,
  fields: ReadonlyMap<string, FormFieldType>,
  messages: FormBuilderMessages,
): string {
  const record = node as unknown as Record<string, unknown>
  const own = (record.label ?? record.title) as string | undefined
  if (own) return own
  if ('name' in node && node.name) return node.name
  return labelOf(node.type, fields.get(node.type), messages)
}

// Settings ----------------------------------------------------------------------

type Setting = Record<string, unknown>

export const field = (type: string, name: string, label: string, extra: Setting = {}): FormNode =>
  ({ id: `setting-${name}`, type, name, label, ...extra }) as FormFieldNode

const sw = (name: string, label: string, extra: Setting = {}) => field('switch', name, label, extra)
export const text = (name: string, label: string, extra: Setting = {}) =>
  field('input', name, label, { ...extra, props: { clearable: true, ...(extra.props as Setting) } })
export const number = (name: string, label: string, props: Setting = {}, extra: Setting = {}) =>
  field('input-number', name, label, { ...extra, props: { controls: false, ...props } })

export function choices(
  messages: FormBuilderMessages,
  key: string,
  values: readonly (string | boolean)[],
): { value: string | boolean; label: string }[] {
  const labels = messages.choices[key] ?? {}
  return values.map((value) => ({ value, label: labels[String(value)] ?? String(value) }))
}

export const segmented = (
  messages: FormBuilderMessages,
  name: string,
  values: readonly string[],
  fallback: string,
  extra: Setting = {},
  key = name,
) =>
  field('segmented-control', name, messages.settings[key] ?? name, {
    default: fallback,
    props: { options: choices(messages, key, values), block: true },
    ...extra,
  })

function optionList(messages: FormBuilderMessages, name = 'options'): FormListNode {
  const s = messages.settings
  return {
    id: `setting-${name}`,
    type: 'list',
    name,
    label: s.options,
    columns: 12,
    children: [
      field('input', 'label', s.optionLabel!, { span: 6 }),
      field('input', 'value', s.optionValue!, { span: 6 }),
    ],
  }
}

/** Settings of the built-in types, edited in a node's `props`. */
export function builtinSettings(type: string, messages: FormBuilderMessages): FormNode[] {
  const s = messages.settings as Record<string, string>
  const placeholder = text('placeholder', s.placeholder!)
  const clearable = sw('clearable', s.clearable!)
  const multiple = sw('multiple', s.multiple!)
  const filterable = sw('filterable', s.filterable!)
  const options = optionList(messages)
  const direction = segmented(messages, 'direction', ['horizontal', 'vertical'], 'horizontal')
  switch (type) {
    case 'input':
      return [
        placeholder,
        clearable,
        number('maxlength', s.maxlength!, { min: 1 }),
        sw('showCount', s.showCount!),
      ]
    case 'textarea':
      return [
        placeholder,
        number('rows', s.rows!, { min: 1, placeholder: '3' }),
        sw('autosize', s.autosize!),
        number('maxlength', s.maxlength!, { min: 1 }),
        sw('showCount', s.showCount!),
      ]
    case 'input-number':
      return [
        placeholder,
        number('min', s.min!, {}, { span: 6 }),
        number('max', s.max!, {}, { span: 6 }),
        number('step', s.step!, { min: 0, placeholder: '1' }, { span: 6 }),
        number('precision', s.precision!, { min: 0, precision: 0 }, { span: 6 }),
        sw('controls', s.controls!, { default: true }),
      ]
    case 'select':
      return [options, placeholder, multiple, filterable, clearable]
    case 'radio-group':
    case 'checkbox-group':
      return [options, direction]
    case 'segmented-control':
      return [options]
    case 'checkbox':
      return [text('text', s.text!)]
    case 'slider':
      return [
        number('min', s.min!, {}, { span: 6, default: 0 }),
        number('max', s.max!, {}, { span: 6, default: 100 }),
        number('step', s.step!, { min: 0 }, { default: 1 }),
        sw('range', s.range!),
      ]
    case 'rate':
      return [
        number('max', s.count!, { min: 1, max: 10, precision: 0 }, { default: 5 }),
        sw('allowHalf', s.allowHalf!),
      ]
    case 'date-picker':
      return [
        field('select', 'type', s.dateType!, {
          default: 'date',
          props: {
            options: choices(messages, 'dateType', [
              'date',
              'week',
              'month',
              'quarter',
              'year',
              'datetime',
            ]),
          },
        }),
        sw('range', s.range!, { visibleWhen: "values.type != 'week'" }),
        placeholder,
        clearable,
      ]
    case 'time-picker':
      return [sw('range', s.range!), placeholder, clearable]
    case 'color-picker':
      return [sw('showAlpha', s.showAlpha!), clearable]
    case 'cascader':
    case 'tree-select':
      return [placeholder, multiple, filterable, clearable]
    case 'input-tag':
      return [placeholder, number('max', s.maxTags!, { min: 1, precision: 0 }), clearable]
    case 'input-otp':
      return [
        number('length', s.length!, { min: 1, max: 12, precision: 0 }, { default: 6 }),
        sw('mask', s.mask!),
      ]
    case 'upload':
      return [
        text('accept', s.accept!, { props: { placeholder: 'image/*, .pdf' } }),
        multiple,
        number('maxCount', s.maxCount!, { min: 1, precision: 0 }),
        sw('dropzone', s.dropzone!),
      ]
    case 'text':
      return [
        field('textarea', 'content', s.content!, {
          props: { autosize: { minRows: 2, maxRows: 8 } },
        }),
        segmented(messages, 'variant', ['title', 'body', 'caption'], 'body'),
      ]
    case 'divider':
      return [text('text', s.content!), sw('dashed', s.dashed!)]
    case 'alert':
      return [
        field('select', 'tone', s.tone!, {
          default: 'neutral',
          props: {
            options: choices(messages, 'tone', [
              'neutral',
              'primary',
              'success',
              'warning',
              'danger',
            ]),
          },
        }),
        text('title', s.title!),
        field('textarea', 'content', s.content!, {
          props: { autosize: { minRows: 2, maxRows: 8 } },
        }),
      ]
    default:
      return []
  }
}

/** What the node-level settings of a node depend on. */
export interface NodeSettingsContext {
  messages: FormBuilderMessages
  /** Columns of the grid the node sits on. */
  columns: number
  /** Whether the node sits in a list item, so its name is a key of the item. */
  inItem: boolean
  /** The node's type, for a field. */
  type?: FormFieldType
}

/** The builder's own type for a node's width: a number of columns, or one per breakpoint. */
export const SPAN_TYPE = 'dou-builder-span'
/** The builder's own type for expression text, with completions and problems. */
export const EXPRESSION_TYPE = 'dou-builder-expression'
/** The builder's own type for a condition, edited as rows or as text. */
export const CONDITION_TYPE = 'dou-builder-condition'

function spanSetting(context: NodeSettingsContext): FormNode {
  // The field draws its own label, with the "by form width" switch on the same row.
  const node = field(SPAN_TYPE, 'span', '', {
    default: context.columns,
    props: { columns: context.columns },
  }) as FormFieldNode
  delete node.label
  return node
}

/** The settings of a node itself, besides its type's: name, label, width and so on. */
export function nodeSettings(node: FormNode, context: NodeSettingsContext): FormNode[] {
  const s = context.messages.settings as Record<string, string>
  const span = spanSetting(context)
  const name = text('name', context.inItem ? s.itemName! : s.name!, {
    help: context.inItem ? s.itemNameHelp : s.nameHelp,
    props: { clearable: false },
  })
  const columns = number('columns', s.columns!, {
    min: 1,
    max: 24,
    precision: 0,
    placeholder: String(context.columns),
  })
  switch (node.type) {
    case 'section':
      return [
        text('title', s.title!),
        field('textarea', 'description', s.description!, {
          props: { autosize: { minRows: 1, maxRows: 6 } },
        }),
        sw('bordered', s.bordered!),
        columns,
        span,
      ]
    case 'page':
      return [
        text('title', s.title!),
        field('textarea', 'description', s.description!, {
          props: { autosize: { minRows: 1, maxRows: 6 } },
        }),
        columns,
      ]
    case 'tabs':
    case 'steps':
      return [span]
    case 'list':
      return [
        name,
        text('label', s.label!),
        text('help', s.help!),
        span,
        number('min', s.minItems!, { min: 0, precision: 0 }, { span: 6 }),
        number('max', s.maxItems!, { min: 1, precision: 0 }, { span: 6 }),
        text('addText', s.addText!),
        sw('sortable', s.sortable!, { default: true }),
        sw('required', s.required!),
        columns,
      ]
    default: {
      const type = context.type
      if (type?.kind === 'display') return [span]
      const own = node as FormFieldNode
      const result: FormNode[] = [name, text('label', s.label!), text('help', s.help!), span]
      if (type && own.type !== 'upload')
        result.push({
          id: 'setting-default',
          type: own.type,
          name: 'default',
          label: s.default,
          props: own.props,
        } as FormFieldNode)
      result.push(sw('required', s.required!))
      return result
    }
  }
}

/** The settings of the document itself. */
export function documentSettings(messages: FormBuilderMessages): FormNode[] {
  const s = messages.settings as Record<string, string>
  const horizontal = "values.layout == 'horizontal'"
  return [
    segmented(messages, 'layout', ['vertical', 'horizontal', 'inline'], 'vertical'),
    segmented(messages, 'labelAlign', ['start', 'end'], 'start', { visibleWhen: horizontal }),
    number(
      'labelWidth',
      s.labelWidth!,
      { min: 40, max: 400, step: 8, precision: 0 },
      { default: 96, visibleWhen: horizontal },
    ),
    segmented(messages, 'size', ['sm', 'md', 'lg'], 'md'),
    field('radio-group', 'requiredMark', s.requiredMark!, {
      default: true,
      props: { options: choices(messages, 'requiredMark', [true, 'optional', false]) },
    }),
    number('columns', s.columns!, { min: 1, max: 24, precision: 0 }, { default: 12 }),
  ]
}

/** A settings form: the nodes in a vertical, compact document. */
export function settingsDocument(nodes: FormNode[]): FormDocument {
  return { version: 1, size: 'sm', columns: 12, requiredMark: false, nodes }
}
