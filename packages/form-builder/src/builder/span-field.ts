import { computed, defineComponent, h, useId } from 'vue'
import type { PropType } from 'vue'
import { DouCheckbox, DouInputNumber } from 'dou-ui'
import type { FormResponsive } from '../core/types'
import { defineFormField } from '../fields/define'
import { useBuilderState } from './context'
import { SPAN_TYPE } from './settings'

const breakpoints = ['base', 'sm', 'md', 'lg', 'xl'] as const
type Breakpoint = (typeof breakpoints)[number]
type Span = FormResponsive<number>

/**
 * A node's width in columns: one number, or one per form width when
 * "by form width" is on. A width left empty takes the next narrower one.
 */
const SpanInput = defineComponent({
  name: 'DouFormBuilderSpan',
  props: {
    modelValue: { type: [Number, Object] as PropType<Span | null>, default: undefined },
    columns: { type: Number, default: 12 },
    disabled: Boolean,
  },
  emits: { 'update:modelValue': (_value: Span) => true },
  setup(props, { emit }) {
    const state = useBuilderState()
    const labelId = `dou-form-builder-span-${useId()}`
    const responsive = computed(
      () => typeof props.modelValue === 'object' && props.modelValue !== null,
    )
    const whole = computed(() => {
      const value = props.modelValue
      if (typeof value === 'number') return value
      if (value && typeof value === 'object') return value.base ?? props.columns
      return props.columns
    })
    const clamp = (value: number) => Math.min(Math.max(1, Math.round(value)), props.columns)

    function setOne(value: number | null) {
      emit('update:modelValue', value === null ? props.columns : clamp(value))
    }
    function setAt(key: Breakpoint, value: number | null) {
      const current = { ...(props.modelValue as Partial<Record<Breakpoint, number>>) }
      if (value === null) delete current[key]
      else current[key] = clamp(value)
      emit('update:modelValue', current)
    }
    function toggle(on: boolean) {
      emit('update:modelValue', on ? { base: whole.value } : whole.value)
    }

    return () => {
      const messages = state.messages
      const choices = messages.choices.breakpoint ?? {}
      const input = (
        value: number | null | undefined,
        set: (value: number | null) => void,
        label: string,
        placeholder?: string,
      ) =>
        h(DouInputNumber, {
          modelValue: value ?? null,
          min: 1,
          max: props.columns,
          precision: 0,
          size: 'sm',
          controls: false,
          disabled: props.disabled,
          placeholder,
          'aria-label': label,
          'onUpdate:modelValue': set,
        })
      const rows = responsive.value
        ? breakpoints.map((key, index) => {
            const value = (props.modelValue as Partial<Record<Breakpoint, number>>)[key]
            // An empty width shows the one it takes over from.
            let inherited: number | undefined
            for (let at = index - 1; at >= 0 && inherited === undefined; at--)
              inherited = (props.modelValue as Partial<Record<Breakpoint, number>>)[
                breakpoints[at]!
              ]
            return h('label', { key, class: 'dou-form-builder__span-row' }, [
              h('span', { class: 'dou-form-builder__span-label' }, choices[key] ?? key),
              input(
                value,
                (next) => setAt(key, next),
                choices[key] ?? key,
                String(inherited ?? props.columns),
              ),
            ])
          })
        : [
            h('div', { class: 'dou-form-builder__span-row' }, [
              input(whole.value, setOne, messages.settings.span ?? 'span'),
              h('span', { class: 'dou-form-builder__span-label' }, `/ ${props.columns}`),
            ]),
          ]
      return h(
        'div',
        { class: 'dou-form-builder__span', role: 'group', 'aria-labelledby': labelId },
        [
          h('div', { class: 'dou-form-builder__span-head' }, [
            h(
              'div',
              { id: labelId, class: 'dou-form-item__label' },
              h('span', { class: 'dou-form-item__label-text' }, messages.settings.span),
            ),
            h(
              DouCheckbox,
              {
                modelValue: responsive.value,
                disabled: props.disabled,
                size: 'sm',
                class: 'dou-form-builder__span-toggle',
                'onUpdate:modelValue': (on: unknown) => toggle(on === true),
              },
              () => messages.settings.spanResponsive,
            ),
          ]),
          ...rows,
        ],
      )
    }
  },
})

/** The width setting of the inspector, a field type of the builder's own. */
export const spanField = defineFormField({
  type: SPAN_TYPE,
  component: SpanInput,
  empty: (props: { columns?: number }) => props.columns ?? 12,
})
