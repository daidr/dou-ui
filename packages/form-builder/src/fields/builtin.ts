import {
  DouCascader,
  DouColorPicker,
  DouDatePicker,
  DouInput,
  DouInputNumber,
  DouInputOtp,
  DouInputTag,
  DouRate,
  DouSegmentedControl,
  DouSelect,
  DouSlider,
  DouSwitch,
  DouTextarea,
  DouTimePicker,
  DouTreeSelect,
  DouUpload,
} from 'dou-ui'
import { defineFormField } from './define'
import { fitPathToOptions, fitToOptions } from './options'
import type { FormFieldType } from './define'
import {
  AlertField,
  CheckboxField,
  CheckboxGroupField,
  DividerField,
  normalizeOptions,
  RadioField,
  TextField,
} from './components'
import type { FormOption } from './components'
import {
  ColorValue,
  FilesValue,
  formatDate,
  formatNumber,
  formatOptions,
  formatPath,
  formatRange,
  formatText,
  formatToggle,
} from './format'

const text = () => ''
const none = () => null
const list = () => []
const listWhen = (key: string) => (props: Record<string, unknown>) => (props[key] ? [] : null)

/**
 * The field types every renderer and builder knows. Each one is named
 * after the component it renders, in kebab case without the `Dou`
 * prefix: `input-number` renders `DouInputNumber`.
 */
export const builtinFields: FormFieldType<any>[] = [
  defineFormField({ type: 'input', component: DouInput, empty: text, format: formatText }),
  defineFormField({ type: 'textarea', component: DouTextarea, empty: text }),
  defineFormField({ type: 'input-number', component: DouInputNumber, format: formatNumber }),
  defineFormField({
    type: 'select',
    optionsProp: 'options',
    fitValue: fitToOptions,
    component: DouSelect,
    defaultProps: { options: [] },
    empty: listWhen('multiple'),
  }),
  defineFormField({
    type: 'radio-group',
    component: RadioField,
    optionsProp: 'options',
    fitValue: fitToOptions,
    empty: none,
  }),
  defineFormField({
    type: 'checkbox-group',
    component: CheckboxGroupField,
    optionsProp: 'options',
    fitValue: fitToOptions,
    empty: list,
  }),
  defineFormField({
    type: 'checkbox',
    component: CheckboxField,
    empty: () => false,
    format: formatToggle,
  }),
  defineFormField({
    type: 'switch',
    component: DouSwitch,
    empty: () => false,
    format: formatToggle,
  }),
  defineFormField({
    type: 'segmented-control',
    component: DouSegmentedControl,
    optionsProp: 'options',
    fitValue: fitToOptions,
    defaultProps: { options: [] },
    empty: (props: { options?: FormOption[] }) => normalizeOptions(props.options)[0]?.value ?? null,
  }),
  defineFormField({
    type: 'slider',
    component: DouSlider,
    format: formatRange,
    empty: (props: { range?: boolean; min?: number; max?: number }) => {
      const min = props.min ?? 0
      return props.range ? [min, props.max ?? 100] : min
    },
  }),
  defineFormField({ type: 'rate', component: DouRate, empty: () => 0, readonlyComponent: DouRate }),
  defineFormField({
    type: 'date-picker',
    component: DouDatePicker,
    empty: none,
    format: formatDate,
  }),
  defineFormField({
    type: 'time-picker',
    component: DouTimePicker,
    empty: none,
    format: formatRange,
  }),
  defineFormField({
    type: 'color-picker',
    component: DouColorPicker,
    empty: none,
    readonlyComponent: ColorValue,
  }),
  defineFormField({
    type: 'cascader',
    optionsProp: 'options',
    fitValue: fitPathToOptions,
    component: DouCascader,
    format: formatPath,
    defaultProps: { options: [] },
    empty: none,
  }),
  defineFormField({
    type: 'tree-select',
    optionsProp: 'data',
    fitValue: fitToOptions,
    component: DouTreeSelect,
    format: formatOptions('data'),
    defaultProps: { data: [] },
    empty: listWhen('multiple'),
  }),
  defineFormField({ type: 'input-tag', component: DouInputTag, empty: list }),
  defineFormField({ type: 'input-otp', component: DouInputOtp, empty: text }),
  defineFormField({
    type: 'upload',
    component: DouUpload,
    empty: list,
    readonlyComponent: FilesValue,
  }),
  defineFormField({ type: 'text', kind: 'display', component: TextField }),
  defineFormField({ type: 'divider', kind: 'display', component: DividerField }),
  defineFormField({ type: 'alert', kind: 'display', component: AlertField }),
]

/** The built-in types, then `extra` on top: a type of the same name replaces the built-in one. */
export function resolveFields(extra: readonly FormFieldType<any>[] = []) {
  const map = new Map<string, FormFieldType>()
  for (const spec of builtinFields) map.set(spec.type, spec)
  for (const spec of extra) map.set(spec.type, spec)
  return map
}
