<script setup lang="ts">
import { computed, provide, ref, useId } from 'vue'
import { DouTabPanel, DouTabs } from 'dou-ui'
import { RedoIcon, UndoIcon } from '@dou-ui/icons'
import { resolveFields } from '../fields/builtin'
import { createBuilderState, builderKey } from './context'
import { useFormDesignerMessages } from './locale'
import { FormBuilderCanvas } from './canvas'
import FormBuilderInspector from './inspector.vue'
import FormBuilderOutline from './outline.vue'
import FormBuilderPalette from './palette.vue'
import type {
  FormBuilderEmits,
  FormBuilderExpose,
  FormBuilderProps,
  FormBuilderSlots,
} from './types'

defineOptions({ name: 'DouFormBuilder' })

const props = defineProps<FormBuilderProps>()
const emit = defineEmits<FormBuilderEmits>()
defineSlots<FormBuilderSlots>()

const fields = computed(() => resolveFields(props.fields))
const messages = useFormDesignerMessages(() => props.messages)

const state = createBuilderState({
  uid: `dou-form-builder-${useId()}`,
  document: () => props.modelValue,
  selection: () => props.selection,
  fields: () => fields.value,
  messages: () => messages.value,
  emitDocument: (document, tr) => {
    emit('update:modelValue', document)
    emit('change', tr)
  },
  emitSelection: (ids) => emit('update:selection', ids),
})
provide(builderKey, state)

const side = ref<'fields' | 'outline'>('fields')

const {
  transaction,
  dispatch,
  select,
  insert,
  remove,
  duplicate,
  move,
  wrap,
  addPage,
  selectParent,
  undo,
  redo,
  shownPage,
} = state
defineExpose<FormBuilderExpose>({
  get document() {
    return state.document
  },
  get selection() {
    return state.selection
  },
  get fields() {
    return state.fields
  },
  get messages() {
    return state.messages
  },
  get canUndo() {
    return state.canUndo
  },
  get canRedo() {
    return state.canRedo
  },
  transaction,
  dispatch,
  select,
  insert,
  remove,
  duplicate,
  move,
  wrap,
  addPage,
  selectParent,
  undo,
  redo,
  shownPage,
})
</script>

<template>
  <div class="dou-form-builder">
    <slot>
      <div class="dou-form-builder__layout">
        <aside class="dou-form-builder__side">
          <DouTabs v-model="side" size="sm" class="dou-form-builder__side-tabs">
            <DouTabPanel value="fields" :label="messages.panels.fields">
              <FormBuilderPalette />
            </DouTabPanel>
            <DouTabPanel value="outline" :label="messages.panels.outline">
              <FormBuilderOutline />
            </DouTabPanel>
          </DouTabs>
        </aside>
        <div class="dou-form-builder__main">
          <div class="dou-form-builder__toolbar" role="toolbar">
            <button
              type="button"
              class="dou-form-builder__tool"
              :disabled="!state.canUndo"
              :aria-label="messages.actions.undo"
              :title="messages.actions.undo"
              aria-keyshortcuts="Control+Z Meta+Z"
              @click="state.undo()"
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              class="dou-form-builder__tool"
              :disabled="!state.canRedo"
              :aria-label="messages.actions.redo"
              :title="messages.actions.redo"
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
              @click="state.redo()"
            >
              <RedoIcon />
            </button>
            <slot name="toolbar" />
          </div>
          <FormBuilderCanvas />
        </div>
        <aside
          class="dou-form-builder__side dou-form-builder__side--end"
          :aria-label="messages.panels.settings"
        >
          <FormBuilderInspector />
        </aside>
      </div>
    </slot>
    <div class="dou-form-builder__live" aria-live="polite" aria-atomic="true">
      {{ state.live.value }}
    </div>
  </div>
</template>
