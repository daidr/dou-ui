<script setup lang="ts">
import {
  computed,
  effectScope,
  nextTick,
  provide,
  reactive,
  shallowReactive,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { DouForm } from 'dou-ui'
import type { FormInstance, FormModel } from 'dou-ui'
import { checkVersion, cloneValue, getPath, isSteps, setPath } from '../core/document'
import { equalValues } from '../core/expression'
import { fillValues, visibleValues } from '../core/values'
import { resolveFields } from '../fields/builtin'
import { useFormRendererMessages } from '../locale'
import { rendererKey } from './context'
import type {
  FormRendererEmits,
  FormRendererExpose,
  FormRendererProps,
  FormRendererSlots,
} from './context'
import { findFormulaCycles, formulasOf } from '../core/formulas'
import { FormNodeView, nodeKey } from './node-view'

defineOptions({ name: 'DouFormRenderer' })

const props = withDefaults(defineProps<FormRendererProps>(), { disabled: false })
const emit = defineEmits<FormRendererEmits>()
const slots = defineSlots<FormRendererSlots>()

const own = reactive<FormModel>({})
// `reactive` hands back the same proxy for an object it has seen, and
// writes through to the object itself.
const model = computed(() => reactive(props.model ?? own) as FormModel)
const fields = computed(() => resolveFields(props.fields))
const layout = computed(() => props.form.layout ?? 'vertical')
const columns = computed(() => Math.max(1, Math.round(props.form.columns ?? 12)))
const labelWidth = computed(() =>
  layout.value === 'horizontal' ? (props.form.labelWidth ?? 96) : undefined,
)

const warnedCycles = new Set<string>()
function warnCycle(cycle: string[]) {
  const key = cycle.join(' -> ')
  if (warnedCycles.has(key)) return
  warnedCycles.add(key)
  console.warn(
    `[dou-ui] form formulas read each other in a circle (${key}); they are not worked out`,
  )
}

// Fill in the fields the model has no value for, before the form items
// mount and take the values as the ones to reset to.
watch(
  [() => props.form, model, fields],
  ([document, target, types]) => {
    checkVersion(document)
    fillValues(document.nodes, target, types)
  },
  {
    immediate: true,
  },
)

// Formulas: each field with one holds its result, worked out again as
// soon as a value it reads changes (synchronously, so a formula reading
// another formula sees its new result). Formulas on a circle are skipped.
const formulas = computed(() => {
  const cycles = findFormulaCycles(props.form)
  for (const cycle of cycles) warnCycle(cycle)
  return formulasOf(props.form)
})
watch(
  [formulas, model, () => props.functions],
  ([list, target, functions], _, onCleanup) => {
    const scope = effectScope()
    scope.run(() => {
      for (const { name, expression } of list)
        watch(
          () => expression.evaluate({ values: target, value: null, functions }),
          (result) => {
            if (!equalValues(result, getPath(target, name)))
              setPath(target, name, cloneValue(result))
          },
          { immediate: true, flush: 'sync' },
        )
    })
    onCleanup(() => scope.stop())
  },
  { immediate: true },
)

// Options from sources, kept per source and `arg` for the renderer's
// life; a failed call is forgotten so the next one tries again.
const loaded = new Map<string, Promise<unknown[]>>()
const versions = reactive<Record<string, number>>({})
const everyVersion = shallowRef(0)
watch(
  () => props.sources,
  () => loaded.clear(),
)
function load(name: string, arg: unknown) {
  const key = `${name}\u0000${JSON.stringify(arg)}`
  let result = loaded.get(key)
  if (!result) {
    const source = props.sources?.[name]
    result = source
      ? Promise.resolve()
          .then(() => source(arg))
          .then((list) => (Array.isArray(list) ? list : []))
      : Promise.reject(new Error(`there is no source "${name}" in \`sources\``))
    result.catch((error: unknown) => {
      if (loaded.get(key) === result) loaded.delete(key)
      console.warn(`[dou-ui] form option source "${name}" failed:`, error)
    })
    loaded.set(key, result)
  }
  return result
}
function reloadSource(name?: string) {
  if (name === undefined) {
    loaded.clear()
    everyVersion.value++
    return
  }
  for (const key of loaded.keys()) if (key.startsWith(`${name}\u0000`)) loaded.delete(key)
  versions[name] = (versions[name] ?? 0) + 1
}

const messages = useFormRendererMessages(() => props.messages)
const formRef = useTemplateRef<FormInstance>('formRef')

// Tabs and steps holding a field bring it into view before it is scrolled to.
const revealers = new Set<(path: string) => boolean>()
function scrollToField(name: string) {
  for (const reveal of revealers) reveal(name)
  void nextTick(() => formRef.value?.scrollToField(name))
}
async function validate(names?: string | string[]) {
  return (await formRef.value?.validate(names)) ?? { valid: true, errors: {} }
}
function getValues(): FormModel {
  return props.keepHidden
    ? cloneValue(model.value)
    : visibleValues(props.form, model.value, { functions: props.functions })
}
function onInvalid(errors: Record<string, string>) {
  const first = Object.keys(errors)[0]
  if (first) scrollToField(first)
  emit('invalid', errors)
}

// The form items showing an error, for the tabs to mark their pages.
type Tracked = { path: () => string | undefined; error: () => string | undefined }
const tracked = shallowReactive(new Set<Tracked>())
const errorPaths = computed(() => {
  const paths: string[] = []
  for (const entry of tracked) {
    const path = entry.path()
    if (path && entry.error()) paths.push(path)
  }
  return paths
})

/** A form that is a series of steps shows the default slot on its last step. */
const footerOwner = computed(() => props.form.nodes.find(isSteps)?.id)

provide(rendererKey, {
  model: () => model.value,
  fields: () => fields.value,
  labelWidth: () => labelWidth.value,
  changed: (name, value) => emit('change', name, value),
  functions: () => props.functions,
  load,
  sourceVersion: (name) => everyVersion.value + (versions[name] ?? 0),
  messages: () => messages.value,
  validate,
  scrollToField,
  addRevealer: (reveal) => {
    revealers.add(reveal)
    return () => revealers.delete(reveal)
  },
  trackError: (path, error) => {
    const entry = { path, error }
    tracked.add(entry)
    return () => tracked.delete(entry)
  },
  errorPaths: () => errorPaths.value,
  footer: () => slots.default?.(),
  footerOwner: () => footerOwner.value,
  resets: () => resets.value,
})

// Resetting the whole form, by `resetFields()` or a reset button, also
// takes steps back to the first one.
const resets = shallowRef(0)
function resetFields(names?: string | string[]) {
  formRef.value?.resetFields(names)
  if (names === undefined) resets.value++
}
function onReset() {
  resets.value++
  emit('reset')
}

defineExpose<FormRendererExpose>({
  get model() {
    return model.value
  },
  validate,
  resetFields,
  clearValidate: (names) => formRef.value?.clearValidate(names),
  scrollToField,
  reloadSource,
  getValues,
})
</script>

<template>
  <DouForm
    ref="formRef"
    :class="[
      'dou-form-renderer',
      `dou-form-renderer--${layout}`,
      (form.requiredMark ?? true) === true && 'dou-form-renderer--marked',
    ]"
    :model="model"
    :rules="rules"
    :layout="layout"
    :label-align="form.labelAlign"
    :size="form.size"
    :required-mark="form.requiredMark ?? true"
    :disabled="disabled"
    :scroll-to-error="false"
    @submit="emit('submit', getValues())"
    @invalid="onInvalid"
    @reset="onReset"
  >
    <div class="dou-form-renderer__grid" :style="{ '--dou-form-columns': columns }">
      <FormNodeView
        v-for="node in form.nodes"
        :key="nodeKey(node)"
        :node="node"
        :columns="columns"
      />
    </div>
    <slot v-if="!footerOwner" />
  </DouForm>
</template>
