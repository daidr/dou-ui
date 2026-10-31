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
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlusIcon } from '@dou-ui/icons'
import { useReducedMotion } from '../../composables/use-motion'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import { useFormSize } from '../form/use-form-item'
import { DouTooltip } from '../tooltip'
import { tabsKey } from './tabs'
import type { FunctionalComponent, VNode } from 'vue'
import type { TabPanelEntry, TabsProps, TabsSlots, TabsValue } from './tabs'

defineOptions({ name: 'DouTabs' })

const props = withDefaults(defineProps<TabsProps>(), {
  activation: 'auto',
  placement: 'top',
  closable: false,
  addable: false,
})
const model = defineModel<TabsValue>()
const emit = defineEmits<{ change: [value: TabsValue]; remove: [value: TabsValue]; add: [] }>()
const slots = defineSlots<TabsSlots>()

const ns = useNamespace('tabs')
const { t } = useLocale()
const id = useId()
const vertical = computed(() => props.placement !== 'top')
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

async function select(entry: TabPanelEntry) {
  if (entry.props.disabled || entry.props.value === selected.value) return
  const next = entry.props.value
  if (props.beforeLeave && !(await props.beforeLeave(next, selected.value))) return
  model.value = next
  emit('change', next)
}

const isClosable = (entry: TabPanelEntry) =>
  !entry.props.disabled && (entry.props.closable ?? props.closable)

function remove(entry: TabPanelEntry) {
  if (isClosable(entry)) emit('remove', entry.props.value)
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
  const [prev, next] = vertical.value ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
  switch (event.key) {
    case next:
      target = enabled[(index + 1) % enabled.length]
      break
    case prev:
      target = enabled[(index - 1 + enabled.length) % enabled.length]
      break
    case 'Delete':
    case 'Backspace':
      if (!isClosable(entry)) return
      event.preventDefault()
      remove(entry)
      return
    case 'Home':
      target = enabled[0]
      break
    case 'End':
      target = enabled[enabled.length - 1]
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      void select(entry)
      return
    default:
      return
  }
  if (!target) return
  event.preventDefault()
  tabElement(target)?.focus()
  if (props.activation === 'auto') void select(target)
}

// The underline slides between the tabs. It is measured from the
// selected tab, like the selection of a segmented control.
const indicator = ref<{ left: number; top: number; width: number; height: number } | null>(null)
const settled = ref(false)

function measure() {
  const list = listRef.value
  const entry = panels.value.find((panel) => panel.props.value === selected.value)
  const tab = entry && tabElement(entry)
  if (!list || !tab) {
    indicator.value = null
    return
  }
  indicator.value = {
    left: tab.offsetLeft,
    top: tab.offsetTop,
    width: tab.offsetWidth,
    height: tab.offsetHeight,
  }
}

// When the tabs do not fit, the list scrolls sideways: the edges fade and
// arrows appear on the side that has more, and the selected tab is kept in view.
const overflow = ref({ start: false, end: false })
const reduced = useReducedMotion()

function updateOverflow() {
  const list = listRef.value
  if (!list || vertical.value) {
    overflow.value = { start: false, end: false }
    return
  }
  const max = list.scrollWidth - list.clientWidth
  // a sub-pixel remainder is not something to scroll to
  overflow.value = { start: list.scrollLeft > 1, end: list.scrollLeft < max - 1 }
}

function reveal(smooth: boolean) {
  const list = listRef.value
  const entry = panels.value.find((panel) => panel.props.value === selected.value)
  const tab = entry && tabElement(entry)
  if (!list || !tab || vertical.value) return
  // leave room for the faded edge, so the tab is not under it
  const margin = 32
  const left = tab.offsetLeft - margin
  const right = tab.offsetLeft + tab.offsetWidth + margin - list.clientWidth
  const target = left < list.scrollLeft ? left : right > list.scrollLeft ? right : null
  if (target === null) return
  list.scrollTo({
    left: Math.max(0, target),
    behavior: smooth && !reduced.value ? 'smooth' : 'auto',
  })
}

function scrollByPage(direction: 1 | -1) {
  const list = listRef.value
  if (!list) return
  list.scrollBy({
    left: direction * list.clientWidth * 0.8,
    behavior: reduced.value ? 'auto' : 'smooth',
  })
}

let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  updateOverflow()
  reveal(false)
  requestAnimationFrame(() => (settled.value = true))
  if (typeof ResizeObserver !== 'undefined' && listRef.value) {
    observer = new ResizeObserver(() => {
      measure()
      updateOverflow()
    })
    observer.observe(listRef.value)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch([selected, panels, size, () => props.placement], () =>
  nextTick(() => {
    measure()
    updateOverflow()
    reveal(settled.value)
  }),
)

const indicatorStyle = computed(() => {
  const box = indicator.value
  if (!box) return { display: 'none' }
  return vertical.value
    ? { transform: `translateY(${box.top}px)`, height: `${box.height}px` }
    : { transform: `translateX(${box.left}px)`, width: `${box.width}px` }
})
</script>

<template>
  <div
    :class="[
      ns.b(),
      ns.m(size),
      ns.is('settled', settled),
      ns.is('vertical', vertical),
      vertical && ns.is(`placement-${placement}`, true),
    ]"
  >
    <div :class="ns.e('header')">
      <button
        v-if="overflow.start || overflow.end"
        type="button"
        tabindex="-1"
        :class="[ns.e('scroll'), ns.is('start', true)]"
        :disabled="!overflow.start"
        :aria-label="t('tabs.scrollPrev')"
        @click="scrollByPage(-1)"
      >
        <ChevronLeftIcon />
      </button>
      <div
        ref="list"
        :class="[
          ns.e('list'),
          ns.is('fade-start', overflow.start),
          ns.is('fade-end', overflow.end),
        ]"
        role="tablist"
        :aria-orientation="vertical ? 'vertical' : 'horizontal'"
        @scroll.passive="updateOverflow"
      >
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
            ns.is('closable', isClosable(entry)),
          ]"
          :aria-selected="entry.props.value === selected"
          :aria-controls="panelId(entry.props.value)"
          :aria-disabled="entry.props.disabled || undefined"
          :tabindex="entry.props.value === selected ? 0 : -1"
          :aria-keyshortcuts="isClosable(entry) ? 'Delete' : undefined"
          @click="select(entry)"
          @keydown="onKeydown($event, entry)"
        >
          <span :class="ns.e('label')">
            <TabLabel :entry="entry" :selected="entry.props.value === selected" />
          </span>
          <!-- not a button of its own: a tab cannot hold one; `Delete` closes it from the keyboard -->
          <DouTooltip v-if="isClosable(entry)" :content="t('tabs.close')" shortcut="delete">
            <span :class="ns.e('close')" aria-hidden="true" @click.stop="remove(entry)">
              <CloseIcon />
            </span>
          </DouTooltip>
        </button>
        <span :class="ns.e('indicator')" :style="indicatorStyle" aria-hidden="true" />
      </div>
      <button
        v-if="overflow.start || overflow.end"
        type="button"
        tabindex="-1"
        :class="[ns.e('scroll'), ns.is('end', true)]"
        :disabled="!overflow.end"
        :aria-label="t('tabs.scrollNext')"
        @click="scrollByPage(1)"
      >
        <ChevronRightIcon />
      </button>
      <button
        v-if="addable"
        type="button"
        :class="ns.e('add')"
        :aria-label="t('tabs.add')"
        @click="emit('add')"
      >
        <PlusIcon />
      </button>
      <div v-if="slots.extra" :class="ns.e('extra')">
        <slot name="extra" />
      </div>
    </div>
    <slot />
  </div>
</template>
