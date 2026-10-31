<script setup lang="ts">
import { computed, nextTick, provide, ref, useId, watch } from 'vue'
import { DouPopover, DouTabPanel, DouTabs } from 'dou-ui'
import { PanelLeftIcon, RedoIcon, UndoIcon } from '@dou-ui/icons'
import { resolveFields } from '../fields/builtin'
import { createBuilderState, builderKey } from './context'
import { useFormBuilderMessages } from './locale'
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
const messages = useFormBuilderMessages(() => props.messages)

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
// On narrow builders the fields and the outline open from the toolbar,
// and close once a node is added or picked; focus moves to the canvas,
// where the node now is.
const sideOpen = ref(false)
watch(
  () => state.selection,
  () => {
    if (!sideOpen.value) return
    sideOpen.value = false
    void nextTick(() => state.canvas.value?.focus({ preventScroll: true }))
  },
)

const {
  transaction,
  dispatch,
  select,
  add,
  remove,
  duplicate,
  moveBy,
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
  add,
  remove,
  duplicate,
  moveBy,
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
        <aside class="dou-form-builder__side" :aria-label="messages.panels.side">
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
            <DouPopover
              v-model:open="sideOpen"
              placement="bottom-start"
              :aria-label="messages.panels.side"
              class="dou-form-builder__side-popover"
            >
              <button type="button" class="dou-form-builder__tool dou-form-builder__side-toggle">
                <PanelLeftIcon />
                <span>{{ messages.panels.fields }}</span>
              </button>
              <template #content>
                <DouTabs v-model="side" size="sm" class="dou-form-builder__side-tabs">
                  <DouTabPanel value="fields" :label="messages.panels.fields">
                    <FormBuilderPalette />
                  </DouTabPanel>
                  <DouTabPanel value="outline" :label="messages.panels.outline">
                    <FormBuilderOutline />
                  </DouTabPanel>
                </DouTabs>
              </template>
            </DouPopover>
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
