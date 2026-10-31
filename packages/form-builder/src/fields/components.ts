import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import {
  DouAlert,
  DouCheckbox,
  DouCheckboxGroup,
  DouDivider,
  DouRadio,
  DouRadioGroup,
  DouText,
} from 'dou-ui'
import type { CheckboxValue, RadioValue, Tone } from 'dou-ui'

/** A choice as written in a document: a plain value is both value and label. */
export type FormOption =
  string | number | { value: string | number | boolean; label?: string; disabled?: boolean }

export function normalizeOptions(options: readonly FormOption[] | undefined) {
  return (options ?? []).map((option) =>
    typeof option === 'object'
      ? {
          value: option.value,
          label: option.label ?? String(option.value),
          disabled: option.disabled,
        }
      : { value: option, label: String(option), disabled: false },
  )
}

const optionProps = {
  options: { type: Array as PropType<FormOption[]>, default: () => [] },
  direction: { type: String as PropType<'horizontal' | 'vertical'>, default: 'horizontal' },
  disabled: Boolean,
}

/** One choice out of a few, all in view. */
export const RadioField = defineComponent({
  name: 'DouFormRadioField',
  props: {
    ...optionProps,
    modelValue: { type: [String, Number, Boolean] as PropType<RadioValue>, default: undefined },
  },
  emits: { 'update:modelValue': (_value: RadioValue) => true },
  setup(props, { emit }) {
    return () =>
      h(
        DouRadioGroup,
        {
          modelValue: props.modelValue ?? undefined,
          direction: props.direction,
          disabled: props.disabled,
          'onUpdate:modelValue': (value: RadioValue | undefined) =>
            value !== undefined && emit('update:modelValue', value),
        },
        () =>
          normalizeOptions(props.options).map((option) =>
            h(
              DouRadio,
              { key: String(option.value), value: option.value, disabled: option.disabled },
              () => option.label,
            ),
          ),
      )
  },
})

/** Any number of choices out of a few, all in view. */
export const CheckboxGroupField = defineComponent({
  name: 'DouFormCheckboxGroupField',
  props: {
    ...optionProps,
    modelValue: { type: Array as PropType<CheckboxValue[]>, default: undefined },
  },
  emits: { 'update:modelValue': (_value: CheckboxValue[]) => true },
  setup(props, { emit }) {
    return () =>
      h(
        DouCheckboxGroup,
        {
          modelValue: props.modelValue ?? [],
          direction: props.direction,
          disabled: props.disabled,
          'onUpdate:modelValue': (value: CheckboxValue[]) => emit('update:modelValue', value),
        },
        () =>
          normalizeOptions(props.options).map((option) =>
            h(
              DouCheckbox,
              {
                key: String(option.value),
                value: option.value as CheckboxValue,
                disabled: option.disabled,
              },
              () => option.label,
            ),
          ),
      )
  },
})

/** A single box, e.g. to agree to terms; its text sits beside it. */
export const CheckboxField = defineComponent({
  name: 'DouFormCheckboxField',
  props: {
    modelValue: { type: Boolean, default: false },
    text: String,
    disabled: Boolean,
  },
  emits: { 'update:modelValue': (_value: boolean) => true },
  setup(props, { emit }) {
    return () =>
      h(
        DouCheckbox,
        {
          modelValue: props.modelValue,
          disabled: props.disabled,
          'onUpdate:modelValue': (value: unknown) => emit('update:modelValue', value === true),
        },
        props.text ? () => props.text : undefined,
      )
  },
})

/** A heading or a paragraph between fields. */
export const TextField = defineComponent({
  name: 'DouFormTextField',
  props: {
    content: { type: String, default: '' },
    /** `title` for a heading, `body` for a paragraph, `caption` for small print. */
    variant: { type: String as PropType<'title' | 'body' | 'caption'>, default: 'body' },
  },
  setup(props) {
    return () =>
      props.variant === 'title'
        ? h(
            DouText,
            { as: 'h3', size: 'lg', weight: 'medium', class: 'dou-form-renderer__title' },
            () => props.content,
          )
        : h(
            DouText,
            {
              as: 'p',
              size: props.variant === 'caption' ? 'sm' : 'md',
              variant: 'secondary',
              class: 'dou-form-renderer__paragraph',
            },
            () => props.content,
          )
  },
})

export const DividerField = defineComponent({
  name: 'DouFormDividerField',
  props: { text: String, dashed: Boolean },
  setup(props) {
    return () => h(DouDivider, { dashed: props.dashed }, props.text ? () => props.text : undefined)
  },
})

export const AlertField = defineComponent({
  name: 'DouFormAlertField',
  props: {
    tone: { type: String as PropType<Tone>, default: 'neutral' },
    title: String,
    content: String,
  },
  setup(props) {
    return () =>
      h(
        DouAlert,
        { tone: props.tone, title: props.title },
        props.content ? () => props.content : undefined,
      )
  },
})
