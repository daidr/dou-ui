<script setup lang="ts">
import { computed, provide, reactive, useTemplateRef, watch } from 'vue'
import { DouForm } from 'dou-ui'
import type { FormInstance, FormModel } from 'dou-ui'
import { cloneValue, fieldNodes, getPath, setPath } from '../core/document'
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
const layout = computed(() => props.document.layout ?? 'vertical')
const columns = computed(() => Math.max(1, Math.round(props.document.columns ?? 12)))
const labelWidth = computed(() =>
  layout.value === 'horizontal' ? (props.document.labelWidth ?? 96) : undefined,
)

/** The value a field starts with: its own default, else its type's empty value. */
function startValue(type: FormFieldType, node: Parameters<typeof fieldProps>[1]) {
  if (node.default !== undefined) return cloneValue(node.default)
  return type.initial ? type.initial(fieldProps(type, node)) : null
}

/**
 * Fill in the fields the model has no value for, before the form items
 * mount and take the values as the ones to reset to.
 */
function fill(document: FormDocument, target: FormModel, types: Map<string, FormFieldType>) {
  for (const node of fieldNodes(document)) {
    const type = types.get(node.type)
    if (!type || type.kind === 'display') continue
    if (getPath(target, node.name!) === undefined)
      setPath(target, node.name!, startValue(type, node))
  }
}
watch(
  [() => props.document, model, fields],
  ([document, target, types]) => fill(document, target, types),
  {
    immediate: true,
  },
)

provide(rendererKey, {
  model: () => model.value,
  fields: () => fields.value,
  labelWidth: () => labelWidth.value,
})

const form = useTemplateRef<FormInstance>('form')
defineExpose<FormRendererExpose>({
  get model() {
    return model.value
  },
  validate: async (names) => (await form.value?.validate(names)) ?? { valid: true, errors: {} },
  resetFields: (names) => form.value?.resetFields(names),
  clearValidate: (names) => form.value?.clearValidate(names),
  scrollToField: (name) => form.value?.scrollToField(name),
})
</script>

<template>
  <DouForm
    ref="form"
    :class="['dou-form-renderer', `dou-form-renderer--${layout}`]"
    :model="model"
    :rules="rules"
    :layout="layout"
    :label-align="document.labelAlign"
    :size="document.size"
    :required-mark="document.requiredMark ?? true"
    :disabled="disabled"
    @submit="emit('submit', $event)"
    @invalid="emit('invalid', $event)"
    @reset="emit('reset')"
  >
    <div class="dou-form-renderer__grid" :style="{ '--dou-form-columns': columns }">
      <FormNodeView v-for="node in document.nodes" :key="node.id" :node="node" :columns="columns" />
    </div>
    <slot />
  </DouForm>
</template>
