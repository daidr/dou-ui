<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  toRef,
  triggerRef,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useFormSize } from '../form/use-form-item'
import { tabsKey } from './tabs'
import type { FunctionalComponent, VNode } from 'vue'
import type { TabPanelEntry, TabsProps, TabsSlots, TabsValue } from './tabs'

defineOptions({ name: 'DouTabs' })

const props = withDefaults(defineProps<TabsProps>(), { activation: 'auto' })
const model = defineModel<TabsValue>()
const emit = defineEmits<{ change: [value: TabsValue] }>()
const slots = defineSlots<TabsSlots>()

const ns = useNamespace('tabs')
const id = useId()
const size = useFormSize(() => props.size)

const panels = shallowRef<TabPanelEntry[]>([])

// Panels register in the order they are set up, which is their order on
// the page; a panel added later is sorted in once it is mounted.
function register(entry: TabPanelEntry) {
  panels.value = [...panels.value, entry]
}
function unregister(uid: number) {
  panels.value = panels.value.filter((entry) => entry.uid !== uid)
}
function reorder() {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  const sorted = [...panels.value].sort((a, b) => {
    if (!a.el.value || !b.el.value) return 0
    return a.el.value.compareDocumentPosition(b.el.value) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1
  })
  if (sorted.some((entry, index) => entry !== panels.value[index])) panels.value = sorted
  else triggerRef(panels)
}

const firstEnabled = computed(() => panels.value.find((entry) => !entry.props.disabled))
const selected = computed(() => model.value ?? firstEnabled.value?.props.value)

const key = (value: TabsValue) => String(value).replace(/\s+/g, '-')
const tabId = (value: TabsValue) => `${id}-tab-${key(value)}`
const panelId = (value: TabsValue) => `${id}-panel-${key(value)}`

provide(tabsKey, {
  selected: toRef(() => selected.value),
  tabId,
  panelId,
  register,
  unregister,
  reorder,
})

function select(entry: TabPanelEntry) {
  if (entry.props.disabled || entry.props.value === selected.value) return
  model.value = entry.props.value
  emit('change', entry.props.value)
}

const listRef = useTemplateRef<HTMLElement>('list')
const tabElements = new Map<number, HTMLElement>()

function setTabElement(uid: number, el: unknown) {
  if (el instanceof HTMLElement) tabElements.set(uid, el)
  else tabElements.delete(uid)
}
function tabElement(entry: TabPanelEntry) {
  return tabElements.get(entry.uid)
}

/** The label slot of a panel, rendered inside its tab. */
const TabLabel: FunctionalComponent<{ entry: TabPanelEntry; selected: boolean }> = ({
  entry,
  selected: isSelected,
}) =>
  (entry.slots.label?.({ selected: isSelected }) as VNode[] | undefined) ??
  entry.props.label ??
  String(entry.props.value)

function onKeydown(event: KeyboardEvent, entry: TabPanelEntry) {
  const enabled = panels.value.filter((panel) => !panel.props.disabled)
  const index = enabled.indexOf(entry)
  let target: TabPanelEntry | undefined
  switch (event.key) {
    case 'ArrowRight':
      target = enabled[(index + 1) % enabled.length]
      break
    case 'ArrowLeft':
      target = enabled[(index - 1 + enabled.length) % enabled.length]
      break
    case 'Home':
      target = enabled[0]
      break
    case 'End':
      target = enabled[enabled.length - 1]
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      select(entry)
      return
    default:
      return
  }
  if (!target) return
  event.preventDefault()
  tabElement(target)?.focus()
  if (props.activation === 'auto') select(target)
}

// The underline slides between the tabs. It is measured from the
// selected tab, like the selection of a segmented control.
const indicator = ref<{ left: number; width: number } | null>(null)
const settled = ref(false)

function measure() {
  const list = listRef.value
  const entry = panels.value.find((panel) => panel.props.value === selected.value)
  const tab = entry && tabElement(entry)
  if (!list || !tab) {
    indicator.value = null
    return
  }
  indicator.value = { left: tab.offsetLeft, width: tab.offsetWidth }
}

let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  requestAnimationFrame(() => (settled.value = true))
  if (typeof ResizeObserver !== 'undefined' && listRef.value) {
    observer = new ResizeObserver(() => measure())
    observer.observe(listRef.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch([selected, panels, size], () => nextTick(measure))

const indicatorStyle = computed(() =>
  indicator.value
    ? { transform: `translateX(${indicator.value.left}px)`, width: `${indicator.value.width}px` }
    : { display: 'none' },
)
</script>

<template>
  <div :class="[ns.b(), ns.m(size), ns.is('settled', settled)]">
    <div :class="ns.e('header')">
      <div ref="list" :class="ns.e('list')" role="tablist" aria-orientation="horizontal">
        <button
          v-for="entry in panels"
          :id="tabId(entry.props.value)"
          :key="entry.uid"
          :ref="(el) => setTabElement(entry.uid, el)"
          type="button"
          role="tab"
          :class="[
            ns.e('tab'),
            ns.is('selected', entry.props.value === selected),
            ns.is('disabled', !!entry.props.disabled),
          ]"
          :aria-selected="entry.props.value === selected"
          :aria-controls="panelId(entry.props.value)"
          :aria-disabled="entry.props.disabled || undefined"
          :tabindex="entry.props.value === selected ? 0 : -1"
          @click="select(entry)"
          @keydown="onKeydown($event, entry)"
        >
          <span :class="ns.e('label')">
            <TabLabel :entry="entry" :selected="entry.props.value === selected" />
          </span>
        </button>
        <span :class="ns.e('indicator')" :style="indicatorStyle" aria-hidden="true" />
      </div>
      <div v-if="slots.extra" :class="ns.e('extra')">
        <slot name="extra" />
      </div>
    </div>
    <slot />
  </div>
</template>
