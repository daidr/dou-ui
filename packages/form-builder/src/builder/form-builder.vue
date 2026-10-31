<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  useId,
  watch,
} from 'vue'
import { DouDrawer, DouPopover, DouTabPanel, DouTabs } from 'dou-ui'
import { PanelLeftIcon, RedoIcon, SlidersIcon, UndoIcon } from '@dou-ui/icons'
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

// On phones (a builder narrower than 560px) the fields and the settings
// are drawers from the bottom. The settings open at half height when a
// node is picked, and can be pulled up.
const root = shallowRef<HTMLElement | null>(null)
const compact = ref(false)
const settingsOpen = ref(false)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !root.value) return
  observer = new ResizeObserver(([entry]) => {
    compact.value = (entry?.contentRect.width ?? Infinity) < 560
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
// A tap on a node (not a drag, and not a node just added) opens its settings.
function onCanvasClick(event: MouseEvent) {
  if (!compact.value || state.dragger.value?.swallowClick()) return
  const node = (event.target as HTMLElement).closest('.dou-form-builder__node')
  if (!node || (event.target as HTMLElement).closest('.dou-form-builder__actions')) return
  void nextTick(() => {
    if (state.focused.value) settingsOpen.value = true
  })
}
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
  moveTo,
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
  moveTo,
  wrap,
  addPage,
  selectParent,
  undo,
  redo,
  shownPage,
})
</script>

<template>
  <div ref="root" :class="['dou-form-builder', compact && 'is-compact']">
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
            <button
              v-if="compact"
              type="button"
              class="dou-form-builder__tool dou-form-builder__side-toggle"
              aria-haspopup="dialog"
              @click="sideOpen = true"
            >
              <PanelLeftIcon />
              <span>{{ messages.panels.fields }}</span>
            </button>
            <DouPopover
              v-else
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
            <button
              v-if="compact"
              type="button"
              class="dou-form-builder__tool dou-form-builder__settings-toggle"
              aria-haspopup="dialog"
              :aria-label="messages.panels.settings"
              :title="messages.panels.settings"
              @click="settingsOpen = true"
            >
              <SlidersIcon />
            </button>
          </div>
          <FormBuilderCanvas @click.capture="onCanvasClick" />
        </div>
        <aside
          v-if="!compact"
          class="dou-form-builder__side dou-form-builder__side--end"
          :aria-label="messages.panels.settings"
        >
          <FormBuilderInspector />
        </aside>
      </div>
      <template v-if="compact">
        <DouDrawer
          v-model:open="sideOpen"
          placement="bottom"
          :title="messages.panels.side"
          :snap-points="['50%', '90%']"
          swipeable
          class="dou-form-builder__drawer"
        >
          <DouTabs v-model="side" size="sm" class="dou-form-builder__side-tabs">
            <DouTabPanel value="fields" :label="messages.panels.fields">
              <FormBuilderPalette />
            </DouTabPanel>
            <DouTabPanel value="outline" :label="messages.panels.outline">
              <FormBuilderOutline />
            </DouTabPanel>
          </DouTabs>
        </DouDrawer>
        <DouDrawer
          v-model:open="settingsOpen"
          placement="bottom"
          :title="messages.panels.settings"
          :snap-points="['50%', '90%']"
          swipeable
          class="dou-form-builder__drawer"
        >
          <FormBuilderInspector />
        </DouDrawer>
      </template>
    </slot>
    <div class="dou-form-builder__live" aria-live="polite" aria-atomic="true">
      {{ state.live.value }}
    </div>
  </div>
</template>
