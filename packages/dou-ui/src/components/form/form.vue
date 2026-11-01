<script setup lang="ts">
import { computed, provide } from 'vue'
import { useReducedMotion } from '../../composables/use-motion'
import { useNamespace } from '../../utils/namespace'
import { formKey, formShowErrorsKey } from './form'
import type {
  FormEmits,
  FormErrors,
  FormExpose,
  FormItemHandle,
  FormProps,
  FormSlots,
} from './form'
import { toArray } from './rules'

defineOptions({ name: 'DouForm' })

const props = withDefaults(defineProps<FormProps>(), {
  layout: 'vertical',
  labelAlign: 'start',
  disabled: false,
  readonly: false,
  requiredMark: true,
  scrollToError: true,
})
const emit = defineEmits<FormEmits>()
defineSlots<FormSlots>()

const ns = useNamespace('form')
const reducedMotion = useReducedMotion()

const items = new Set<FormItemHandle>()

provide(formKey, {
  model: () => props.model,
  rules: () => props.rules,
  schema: () => props.schema,
  layout: computed(() => props.layout),
  size: computed(() => props.size),
  disabled: computed(() => props.disabled),
  readonly: computed(() => props.readonly),
  requiredMark: computed(() => props.requiredMark),
  register: (item) => items.add(item),
  unregister: (item) => items.delete(item),
})

/** Items in document order, optionally narrowed to some paths. */
function pick(paths?: string | string[]) {
  const wanted = paths === undefined ? undefined : toArray(paths)
  const list = [...items].filter((item) => {
    const prop = item.prop()
    return prop !== undefined && (!wanted || wanted.includes(prop))
  })
  list.sort((a, b) => {
    const [x, y] = [a.el(), b.el()]
    if (!x || !y) return 0
    return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })
  return list
}

async function validate(paths?: string | string[]) {
  const targets = pick(paths)
  const messages = await Promise.all(targets.map((item) => item.validate()))
  const errors: Record<string, string> = {}
  targets.forEach((item, index) => {
    const message = messages[index]
    if (message) errors[item.prop()!] = message
  })
  return { valid: Object.keys(errors).length === 0, errors }
}

function resetFields(paths?: string | string[]) {
  for (const item of pick(paths)) item.reset()
}

function clearValidate(paths?: string | string[]) {
  for (const item of pick(paths)) item.clear()
}

function showErrors(errors: Partial<FormErrors>) {
  const byPath = new Map(pick().map((item) => [item.prop()!, item]))
  const missed: string[] = []
  for (const [path, message] of Object.entries(errors)) {
    // `items[0].name`, as many servers write it, is `items.0.name` here.
    const item = byPath.get(path) ?? byPath.get(path.replace(/\[(\d+)\]/g, '.$1'))
    if (item) item.setError(message ?? '')
    else if (message) missed.push(path)
  }
  return missed
}

function setErrors(errors: Partial<FormErrors>) {
  const missed = showErrors(errors)
  if (missed.length && process.env.NODE_ENV !== 'production')
    console.warn(
      `[dou-ui] DouForm.setErrors: no field shows ${missed.map((path) => `"${path}"`).join(', ')}. Show these errors elsewhere, e.g. above the form.`,
    )
  return missed
}

function scrollToField(prop: string) {
  const [item] = pick(prop)
  item?.el()?.scrollIntoView?.({
    block: 'center',
    behavior: reducedMotion.value ? 'auto' : 'smooth',
  })
  item?.focus()
}

async function onSubmit() {
  const { valid, errors } = await validate()
  if (valid) {
    emit('submit', props.model ?? {})
    return
  }
  if (props.scrollToError) {
    const first = Object.keys(errors)[0]
    if (first) scrollToField(first)
  }
  emit('invalid', errors)
}

function onReset() {
  resetFields()
  emit('reset')
}

const labelWidth = computed(() =>
  typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth,
)

const classes = computed(() => [
  ns.b(),
  ns.m(props.layout),
  ns.m(`label-${props.labelAlign}`),
  ns.is('disabled', props.disabled),
  ns.is('readonly', props.readonly),
])

defineExpose<FormExpose & { [formShowErrorsKey]: typeof showErrors }>({
  validate,
  resetFields,
  clearValidate,
  scrollToField,
  setErrors,
  [formShowErrorsKey]: showErrors,
})
</script>

<template>
  <form
    :class="classes"
    :style="labelWidth ? { '--dou-form-label-width': labelWidth } : undefined"
    novalidate
    @submit.prevent="onSubmit"
    @reset.prevent="onReset"
  >
    <slot />
  </form>
</template>
