<script setup lang="ts">
import { computed, provide } from 'vue'
import { useReducedMotion } from '../../composables/use-motion'
import { useNamespace } from '../../utils/namespace'
import { formKey } from './form'
import type { FormEmits, FormExpose, FormItemHandle, FormProps, FormSlots } from './form'
import { toArray } from './rules'

defineOptions({ name: 'DouForm' })

const props = withDefaults(defineProps<FormProps>(), {
  layout: 'vertical',
  labelAlign: 'start',
  disabled: false,
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
  layout: computed(() => props.layout),
  size: computed(() => props.size),
  disabled: computed(() => props.disabled),
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
])

defineExpose<FormExpose>({ validate, resetFields, clearValidate, scrollToField })
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
