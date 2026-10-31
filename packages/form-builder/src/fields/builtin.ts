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

const empty = () => ''
const none = () => null
const list = () => []
const listWhen = (key: string) => (props: Record<string, unknown>) => (props[key] ? [] : null)

/** The field types every renderer and builder knows. */
export const builtinFields: FormFieldType<any>[] = [
  defineFormField({ type: 'input', component: DouInput, initial: empty }),
  defineFormField({ type: 'textarea', component: DouTextarea, initial: empty }),
  defineFormField({ type: 'number', component: DouInputNumber }),
  defineFormField({
    type: 'password',
    component: DouInput,
    defaults: { type: 'password', showPassword: true },
    initial: empty,
  }),
  defineFormField({
    type: 'select',
    component: DouSelect,
    defaults: { options: [] },
    initial: listWhen('multiple'),
  }),
  defineFormField({ type: 'radio-group', component: RadioField, initial: none }),
  defineFormField({ type: 'checkbox-group', component: CheckboxGroupField, initial: list }),
  defineFormField({
    type: 'checkbox',
    component: CheckboxField,
    initial: () => false,
  }),
  defineFormField({ type: 'switch', component: DouSwitch, initial: () => false }),
  defineFormField({
    type: 'segmented',
    component: DouSegmentedControl,
    defaults: { options: [] },
    initial: (props: { options?: FormOption[] }) =>
      normalizeOptions(props.options)[0]?.value ?? null,
  }),
  defineFormField({
    type: 'slider',
    component: DouSlider,
    initial: (props: { range?: boolean; min?: number; max?: number }) => {
      const min = props.min ?? 0
      return props.range ? [min, props.max ?? 100] : min
    },
  }),
  defineFormField({ type: 'rate', component: DouRate, initial: () => 0 }),
  defineFormField({
    type: 'date',
    component: DouDatePicker,
    initial: none,
  }),
  defineFormField({ type: 'time', component: DouTimePicker, initial: none }),
  defineFormField({ type: 'color', component: DouColorPicker, initial: none }),
  defineFormField({
    type: 'cascader',
    component: DouCascader,
    defaults: { options: [] },
    initial: none,
  }),
  defineFormField({
    type: 'tree-select',
    component: DouTreeSelect,
    defaults: { data: [] },
    initial: listWhen('multiple'),
  }),
  defineFormField({ type: 'tags', component: DouInputTag, initial: list }),
  defineFormField({ type: 'otp', component: DouInputOtp, initial: empty }),
  defineFormField({ type: 'upload', component: DouUpload, initial: list }),
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
