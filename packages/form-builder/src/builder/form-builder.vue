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
import {
  ariaHotkey,
  DouDrawer,
  DouPopover,
  DouTabPanel,
  DouTabs,
  formatHotkey,
  useApplePlatform,
} from 'dou-ui'
import {
  BracesIcon,
  EyeIcon,
  ListChecksIcon,
  PanelLeftIcon,
  RedoIcon,
  SlidersIcon,
  UndoIcon,
} from '@dou-ui/icons'
import { resolveFields } from '../fields/builtin'
import { createBuilderState, builderKey } from './context'
import type { FormBuilderMode } from './context'
import { resolveFormBuilderExtensions } from './extension'
import type { FormBuilderToolbarItem } from './extension'
import { formatMessage } from '../locale'
import FormBuilderJson from './json-dialog.vue'
import FormBuilderPreview from './preview.vue'
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

const extensions = computed(() => resolveFormBuilderExtensions(props.extensions))
const fields = computed(() => resolveFields([...(props.fields ?? []), ...extensions.value.fields]))
const messages = useFormBuilderMessages(() => props.messages)

// The mode follows `v-model:mode` when it is bound, else the builder's own.
const ownMode = ref<FormBuilderMode>('design')
const mode = computed(() => props.mode ?? ownMode.value)
const previewing = computed(() => mode.value === 'preview')

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
  mode: () => mode.value,
  emitMode: (next) => {
    ownMode.value = next
    emit('update:mode', next)
  },
  functions: () => props.functions,
  sources: () => props.sources,
  extensions: () => extensions.value,
})
provide(builderKey, state)

const jsonOpen = ref(false)
const toolbarItems = computed(() => extensions.value.toolbars.flatMap((toolbar) => toolbar(state)))

// The key of a toolbar item goes in its tooltip, and to screen readers apart from its name.
const apple = useApplePlatform()
function toolTitle(item: FormBuilderToolbarItem) {
  if (!item.shortcut) return item.label
  const keys = formatHotkey(item.shortcut, apple.value)
    .map((step) => step.join(apple.value ? '' : '+'))
    .join(' ')
  return formatMessage(messages.value.actions.withShortcut, { label: item.label, keys })
}

// Extensions start once the builder is mounted, again when their hooks change, and stop when it goes.
const stops: (() => void)[] = []
let mounted = false
let setUp = false
let setupTimes: number[] = []
let setupWarned = false
/** An extension made in the template is new on every render, and set up again each time. */
function warnRepeatedSetup() {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production' || setupWarned) return
  const now = Date.now()
  setupTimes = [...setupTimes.filter((time) => now - time < 1000), now]
  if (setupTimes.length < 4) return
  setupWarned = true
  console.warn(
    '[@dou-ui/form-builder] the extensions keep being set up again, which also clears undo each time. Create them once in <script setup> instead of in the template.',
  )
}
function teardownExtensions() {
  for (const stop of stops.splice(0)) stop()
}
function setupExtensions() {
  if (setUp) warnRepeatedSetup()
  setUp = true
  teardownExtensions()
  for (const setup of extensions.value.setups) {
    const stop = setup(state)
    if (typeof stop === 'function') stops.push(stop)
  }
}
onMounted(() => {
  mounted = true
  setupExtensions()
})
// A list written inline is new on every render; set up again only when the hooks change.
watch(
  () => [extensions.value.history, ...extensions.value.setups],
  (hooks, before) => {
    if (mounted && (hooks.length !== before.length || hooks.some((hook, i) => hook !== before[i])))
      setupExtensions()
  },
)
onBeforeUnmount(teardownExtensions)

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
// Picking several nodes by tapping is for phones only.
watch(compact, (on) => {
  if (!on) state.tapToggles.value = false
})
// A tap on a node (not a drag, and not a node just added) opens its settings.
function onCanvasClick(event: MouseEvent) {
  if (!compact.value || state.tapToggles.value || state.dragger.value?.swallowClick()) return
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
  replace,
  wrap,
  addPage,
  selectParent,
  undo,
  redo,
  shownPage,
  setMode,
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
  get mode() {
    return state.mode
  },
  setMode,
  transaction,
  dispatch,
  select,
  add,
  remove,
  duplicate,
  moveBy,
  moveTo,
  replace,
  wrap,
  addPage,
  selectParent,
  undo,
  redo,
  shownPage,
})
</script>

<template>
  <div
    ref="root"
    :class="['dou-form-builder', compact && 'is-compact', previewing && 'is-previewing']"
  >
    <slot>
      <div class="dou-form-builder__layout">
        <aside v-if="!previewing" class="dou-form-builder__side" :aria-label="messages.panels.side">
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
            <template v-if="previewing" />
            <button
              v-else-if="compact"
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
              v-if="!previewing"
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
              v-if="!previewing"
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
            <button
              v-for="item in toolbarItems"
              :key="item.key"
              type="button"
              class="dou-form-builder__tool"
              :disabled="item.disabled"
              :aria-pressed="item.pressed"
              :aria-label="item.icon ? item.label : undefined"
              :aria-keyshortcuts="item.shortcut ? ariaHotkey(item.shortcut, apple) : undefined"
              :title="toolTitle(item)"
              @click="item.run()"
            >
              <component :is="item.icon" v-if="item.icon" />
              <span v-else>{{ item.label }}</span>
            </button>
            <slot name="toolbar" />
            <span class="dou-form-builder__toolbar-spacer" />
            <button
              v-if="compact && !previewing"
              type="button"
              class="dou-form-builder__tool dou-form-builder__select-toggle"
              :aria-pressed="state.tapToggles.value"
              :aria-label="messages.actions.selectMany"
              :title="messages.actions.selectMany"
              @click="state.tapToggles.value = !state.tapToggles.value"
            >
              <ListChecksIcon />
            </button>
            <button
              v-if="compact && !previewing"
              type="button"
              class="dou-form-builder__tool dou-form-builder__settings-toggle"
              aria-haspopup="dialog"
              :aria-label="messages.panels.settings"
              :title="messages.panels.settings"
              @click="settingsOpen = true"
            >
              <SlidersIcon />
            </button>
            <button
              type="button"
              class="dou-form-builder__tool"
              aria-haspopup="dialog"
              :aria-label="messages.json.title"
              :title="messages.json.title"
              @click="jsonOpen = true"
            >
              <BracesIcon />
            </button>
            <button
              type="button"
              class="dou-form-builder__tool dou-form-builder__preview-toggle"
              :aria-pressed="previewing"
              :title="messages.preview.toggle"
              @click="state.setMode(previewing ? 'design' : 'preview')"
            >
              <EyeIcon />
              <span>{{ messages.preview.toggle }}</span>
            </button>
          </div>
          <FormBuilderPreview v-if="previewing" />
          <FormBuilderCanvas v-else @click.capture="onCanvasClick" />
        </div>
        <aside
          v-if="!compact && !previewing"
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
    <FormBuilderJson v-model:open="jsonOpen" />
    <div class="dou-form-builder__live" aria-live="polite" aria-atomic="true">
      {{ state.live.value }}
    </div>
  </div>
</template>
