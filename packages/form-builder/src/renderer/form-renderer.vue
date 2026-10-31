<script setup lang="ts">
import { computed, effectScope, provide, reactive, useTemplateRef, watch } from 'vue'
import { DouForm } from 'dou-ui'
import type { FormInstance, FormModel } from 'dou-ui'
import { checkVersion, cloneValue, fieldNodes, getPath, setPath } from '../core/document'
import { equalValues } from '../core/expression'
import type { FormDocument } from '../core/types'
import { resolveFields } from '../fields/builtin'
import { fieldProps } from '../fields/define'
import type { FormFieldType } from '../fields/define'
import { rendererKey } from './context'
import type {
  FormRendererEmits,
  FormRendererExpose,
  FormRendererProps,
  FormRendererSlots,
} from './context'
import { findFormulaCycles, formulasOf } from './formulas'
import { FormNodeView } from './node-view'

defineOptions({ name: 'DouFormRenderer' })

const props = withDefaults(defineProps<FormRendererProps>(), { disabled: false })
const emit = defineEmits<FormRendererEmits>()
defineSlots<FormRendererSlots>()

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

/** The value a field starts with: its own default, else its type's empty value. */
function startValue(type: FormFieldType, node: Parameters<typeof fieldProps>[1]) {
  if (node.default !== undefined) return cloneValue(node.default)
  return type.empty ? type.empty(fieldProps(type, node)) : null
}

/**
 * Fill in the fields the model has no value for, before the form items
 * mount and take the values as the ones to reset to.
 */
function fill(document: FormDocument, target: FormModel, types: Map<string, FormFieldType>) {
  checkVersion(document)
  for (const node of fieldNodes(document)) {
    const type = types.get(node.type)
    if (!type || type.kind === 'display') continue
    if (getPath(target, node.name!) === undefined)
      setPath(target, node.name!, startValue(type, node))
  }
}
watch(
  [() => props.form, model, fields],
  ([document, target, types]) => fill(document, target, types),
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

// Options from sources, kept per source and `args` for the renderer's
// life; a failed call is forgotten so the next one tries again.
const loaded = new Map<string, Promise<unknown[]>>()
watch(
  () => props.sources,
  () => loaded.clear(),
)
function load(name: string, args: unknown) {
  const key = `${name}\u0000${JSON.stringify(args)}`
  let result = loaded.get(key)
  if (!result) {
    const source = props.sources?.[name]
    result = source
      ? Promise.resolve()
          .then(() => source(args))
          .then((list) => (Array.isArray(list) ? list : []))
      : Promise.reject(new Error(`there is no source "${name}" in \`sources\``))
    result.catch((error: unknown) => {
      loaded.delete(key)
      console.warn(`[dou-ui] form option source "${name}" failed:`, error)
    })
    loaded.set(key, result)
  }
  return result
}

provide(rendererKey, {
  model: () => model.value,
  fields: () => fields.value,
  labelWidth: () => labelWidth.value,
  changed: (name, value) => emit('change', name, value),
  functions: () => props.functions,
  load,
})

const formRef = useTemplateRef<FormInstance>('formRef')
defineExpose<FormRendererExpose>({
  get model() {
    return model.value
  },
  validate: async (names) => (await formRef.value?.validate(names)) ?? { valid: true, errors: {} },
  resetFields: (names) => formRef.value?.resetFields(names),
  clearValidate: (names) => formRef.value?.clearValidate(names),
  scrollToField: (name) => formRef.value?.scrollToField(name),
})
</script>

<template>
  <DouForm
    ref="formRef"
    :class="['dou-form-renderer', `dou-form-renderer--${layout}`]"
    :model="model"
    :rules="rules"
    :layout="layout"
    :label-align="form.labelAlign"
    :size="form.size"
    :required-mark="form.requiredMark ?? true"
    :disabled="disabled"
    @submit="emit('submit', $event)"
    @invalid="emit('invalid', $event)"
    @reset="emit('reset')"
  >
    <div class="dou-form-renderer__grid" :style="{ '--dou-form-columns': columns }">
      <FormNodeView v-for="node in form.nodes" :key="node.id" :node="node" :columns="columns" />
    </div>
    <slot />
  </DouForm>
</template>
