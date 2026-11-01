<script setup lang="ts">
import {
  computed,
  effectScope,
  inject,
  nextTick,
  provide,
  reactive,
  shallowReactive,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { DouForm, showFormErrors } from 'dou-ui'
import type { FormErrors, FormInstance, FormModel } from 'dou-ui'
import { checkVersion, cloneValue, getPath, isSteps, setPath } from '../core/document'
import { equalValues } from '../core/expression'
import { fillValues, visibleValues } from '../core/values'
import { resolveFields } from '../fields/builtin'
import { useFormRendererMessages } from '../locale'
import { controlsReadonlyKey, rendererKey } from './context'
import type {
  FormRendererEmits,
  FormRendererExpose,
  FormRendererProps,
  FormRendererSlots,
} from './context'
import { findFormulaCycles, formulasOf } from '../core/formulas'
import { FormNodeView, nodeKey } from './node-view'

defineOptions({ name: 'DouFormRenderer' })

const props = withDefaults(defineProps<FormRendererProps>(), { disabled: false, readonly: false })
const emit = defineEmits<FormRendererEmits>()
const slots = defineSlots<FormRendererSlots>()

const controlsReadonly = inject(controlsReadonlyKey, () => false)

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
    `[@dou-ui/form-builder] form formulas read each other in a circle (${key}); they are not worked out`,
  )
}

// Fill in the fields the model has no value for, before the form items
// mount and take the values as the ones to reset to. A read-only form
// shows the values as they are, so a field left empty does not show a default.
watch(
  [() => props.form, model, fields, () => props.readonly],
  ([document, target, types, readonly]) => {
    checkVersion(document)
    if (!readonly) fillValues(document.nodes, target, types)
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
  [formulas, model, () => props.functions, () => props.readonly],
  ([list, target, functions, readonly], _, onCleanup) => {
    // A read-only form works formulas out as it shows them, and writes nothing.
    if (readonly) return
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
      console.warn(`[@dou-ui/form-builder] form option source "${name}" failed:`, error)
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
const footerOwner = computed(() =>
  props.readonly ? undefined : props.form.nodes.find(isSteps)?.id,
)

provide(rendererKey, {
  model: () => model.value,
  fields: () => fields.value,
  labelWidth: () => labelWidth.value,
  changed: (name, value) => emit('change', name, value),
  functions: () => props.functions,
  validators: () => props.validators,
  readonly: () => props.readonly,
  controlsReadonly,
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

/** Shows errors through the form, warning in the renderer's own name about the ones it cannot show. */
function setErrors(errors: Partial<FormErrors>) {
  const form = formRef.value
  const missed = form
    ? showFormErrors(form, errors)
    : Object.keys(errors).filter((path) => errors[path])
  if (missed.length && process.env.NODE_ENV !== 'production')
    console.warn(
      `[@dou-ui/form-builder] DouFormRenderer.setErrors: no field shows ${missed.map((path) => `"${path}"`).join(', ')}. Show these errors elsewhere, e.g. above the form.`,
    )
  return missed
}

defineExpose<FormRendererExpose>({
  get model() {
    return model.value
  },
  validate,
  resetFields,
  clearValidate: (names) => formRef.value?.clearValidate(names),
  setErrors,
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
      (form.requiredMark ?? true) === true && !readonly && 'dou-form-renderer--marked',
      readonly && 'dou-form-renderer--readonly',
    ]"
    :model="model"
    :rules="rules"
    :layout="layout"
    :label-align="form.labelAlign"
    :size="form.size"
    :required-mark="readonly ? false : (form.requiredMark ?? true)"
    :disabled="disabled"
    :readonly="controlsReadonly()"
    :scroll-to-error="false"
    @submit="emit('submit', getValues())"
    @invalid="onInvalid"
    @reset="onReset"
  >
    <div
      :key="readonly ? 'readonly' : 'edit'"
      class="dou-form-renderer__grid"
      :style="{ '--dou-form-columns': columns }"
    >
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
