<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  toRaw,
  useId,
  useTemplateRef,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { formItemKey, formKey } from './form'
import type {
  FormItemExpose,
  FormItemHandle,
  FormItemProps,
  FormItemSlots,
  FormRule,
  FormTrigger,
} from './form'
import { getPath, rulesFor, setPath, toArray, validateValue } from './rules'
import { useFormSize } from './use-form-item'

defineOptions({ name: 'DouFormItem' })

const props = withDefaults(defineProps<FormItemProps>(), {
  required: false,
})
const slots = defineSlots<FormItemSlots>()

const ns = useNamespace('form-item')
const form = inject(formKey, undefined)
const { t } = useLocale()
const size = useFormSize(() => undefined)

const id = `dou-form-item-${useId()}`
const inputId = `${id}-input`
const labelId = `${id}-label`
const messageId = `${id}-message`

const rootRef = useTemplateRef<HTMLElement>('root')

const rules = computed<FormRule[]>(() => {
  const fromForm = props.prop ? toArray(form?.rules()?.[props.prop]) : []
  const list = [...fromForm, ...toArray(props.rules)]
  if (props.required && !list.some((rule) => rule.required)) list.unshift({ required: true })
  return list
})
const required = computed(() => rules.value.some((rule) => rule.required))

const validationError = ref('')
const error = computed(() => props.error || validationError.value)
const hasHelp = computed(() => !!(slots.help || props.help))
const isGroup = ref(false)

// Each run gets a number; an async result only lands if no newer run
// (or a reset) has started since.
let run = 0

async function check(list: FormRule[]) {
  if (!props.prop) return null
  const current = ++run
  const model = form?.model() ?? {}
  const message = await validateValue(getPath(model, props.prop), list, model, t)
  if (current === run) validationError.value = message ?? ''
  return message
}

const validate = () => check(rules.value)

function trigger(event: FormTrigger, { lazy = false } = {}) {
  const list = rulesFor(rules.value, event, lazy, !!validationError.value)
  if (list.length) void check(list)
}

function clone<T>(value: T): T {
  try {
    return structuredClone(toRaw(value))
  } catch {
    return value
  }
}

// The value the field held when it appeared, restored by `reset`.
const initial = props.prop ? clone(getPath(form?.model(), props.prop)) : undefined

function clear() {
  run++
  validationError.value = ''
}

function reset() {
  if (props.prop) setPath(form?.model(), props.prop, clone(initial))
  clear()
}

function focus() {
  const root = rootRef.value
  if (!root) return
  const target =
    root.querySelector<HTMLElement>(`[id="${inputId}"]`) ??
    root.querySelector<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])',
    )
  target?.focus({ preventScroll: true })
}

const handle: FormItemHandle = {
  prop: () => props.prop,
  el: () => rootRef.value,
  validate,
  reset,
  clear,
  focus,
}

onMounted(() => form?.register(handle))
onBeforeUnmount(() => form?.unregister(handle))

provide(formItemKey, {
  inputId,
  labelId,
  describedBy: computed(() => (error.value || hasHelp.value ? messageId : undefined)),
  invalid: computed(() => !!error.value),
  required,
  trigger,
  markGroup: () => (isGroup.value = true),
  isGroup,
})

const mark = computed(() => {
  const setting = form?.requiredMark.value ?? true
  if (setting === 'optional') return required.value ? null : 'optional'
  return setting && required.value ? 'asterisk' : null
})

const labelWidth = computed(() =>
  typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth,
)

const classes = computed(() => [
  ns.b(),
  ns.m(size.value),
  ns.is('required', required.value),
  ns.is('error', !!error.value),
  ns.is('fixed-label', !!labelWidth.value),
])

defineExpose<FormItemExpose>({
  get error() {
    return error.value
  },
  validate,
  reset,
  clear,
})
</script>

<template>
  <div
    ref="root"
    :class="classes"
    :style="labelWidth ? { '--dou-form-label-width': labelWidth } : undefined"
  >
    <label
      v-if="label || slots.label"
      :id="labelId"
      :class="ns.e('label')"
      :for="isGroup ? undefined : inputId"
    >
      <span :class="ns.e('label-text')">
        <slot name="label">{{ label }}</slot>
      </span>
      <span v-if="mark === 'asterisk'" :class="ns.e('asterisk')" aria-hidden="true">*</span>
      <span v-else-if="mark === 'optional'" :class="ns.e('optional')">
        {{ t('form.optional') }}
      </span>
    </label>
    <div :class="ns.e('body')">
      <div :class="ns.e('control')"><slot /></div>
      <div :id="messageId" :class="ns.e('feedback')" aria-live="polite">
        <div v-if="error" :class="ns.e('error')">{{ error }}</div>
        <div v-else-if="hasHelp" :class="ns.e('help')">
          <slot name="help">{{ help }}</slot>
        </div>
      </div>
    </div>
  </div>
</template>
