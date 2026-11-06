<script setup lang="ts">
import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
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
import { announce } from '../../utils/announce'
import { useNamespace } from '../../utils/namespace'
import { scrollPositionOf } from '../../utils/scroll'
import { devWarn } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import { useFormSize } from '../form/use-form-item'
import { DouTooltip } from '../tooltip'
import { pressTab, registerTabDropZone } from './tab-drag'
import { tabsKey } from './tabs'
import type { FunctionalComponent, VNode } from 'vue'
import type { TabDrag } from './tab-drag'
import type { TabPanelEntry, TabsMoveEvent, TabsProps, TabsSlots, TabsValue } from './tabs'

defineOptions({ name: 'DouTabs' })

const props = withDefaults(defineProps<TabsProps>(), {
  activation: 'auto',
  placement: 'top',
  closable: false,
  addable: false,
  iconOnly: false,
  draggable: false,
})
const model = defineModel<TabsValue>()
const emit = defineEmits<{
  change: [value: TabsValue]
  remove: [value: TabsValue]
  add: []
  move: [event: TabsMoveEvent]
}>()
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
/** Put the panels in their order on the page; whether that changed anything. */
function sync() {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  const sorted = [...panels.value].sort((a, b) => {
    if (!a.el.value || !b.el.value) return 0
    return a.el.value.compareDocumentPosition(b.el.value) & Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1
  })
  if (!sorted.some((entry, index) => entry !== panels.value[index])) return false
  panels.value = sorted
  return true
}
function reorder() {
  if (!sync()) triggerRef(panels)
}
// The panels may have been put in a new order, e.g. after a `move`.
onUpdated(sync)

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
  if (entry.props.disabled) return
  await selectValue(entry.props.value)
}
async function selectValue(next: TabsValue) {
  if (next === selected.value) return
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
const headerRef = useTemplateRef<HTMLElement>('header')
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
}) => (entry.slots.label?.({ selected: isSelected }) as VNode[] | undefined) ?? labelText(entry)

const labelText = (entry: TabPanelEntry) => entry.props.label ?? String(entry.props.value)

/** With `iconOnly`, whether the tab shows its icon alone; without an icon it keeps its text. */
function iconAlone(entry: TabPanelEntry) {
  if (!props.iconOnly) return false
  if (entry.props.icon) {
    // the label slot cannot name an icon: the tab would be read out as its value
    if (process.env.NODE_ENV !== 'production' && entry.props.label === undefined)
      devWarn(
        `[dou-ui] DouTabs: \`iconOnly\` names each tab by its \`label\`; the DouTabPanel "${entry.props.value}" has none and is named by its value.`,
      )
    return true
  }
  if (process.env.NODE_ENV !== 'production')
    devWarn(
      `[dou-ui] DouTabs: \`iconOnly\` needs an \`icon\` on each DouTabPanel; "${labelText(entry)}" keeps its text.`,
    )
  return false
}

// With `iconOnly`, the label shows in a tooltip: beside a column, above a row.
const tipPlacement = computed(() =>
  props.placement === 'start' ? 'right' : props.placement === 'end' ? 'left' : 'top',
)
const TabTip: FunctionalComponent<{ entry: TabPanelEntry }> = ({ entry }, { slots: tip }) =>
  iconAlone(entry)
    ? h(DouTooltip, { content: labelText(entry), placement: tipPlacement.value }, tip)
    : tip.default?.()

function onKeydown(event: KeyboardEvent, entry: TabPanelEntry) {
  if (event.altKey && isDraggable(entry) && moveByKey(event, entry)) return
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

/* dragging */

const isDraggable = (entry: TabPanelEntry) =>
  !entry.props.disabled && (entry.props.draggable ?? props.draggable)

/** This instance, to tell a move within the tabs from one that comes from other tabs. */
const self = {}
const draggingUid = ref<number | null>(null)
let clickBlocked = false

function onClick(entry: TabPanelEntry) {
  // the press that ended a drag is not a click on the tab
  if (clickBlocked) return
  void select(entry)
}

function onPointerdown(event: PointerEvent, entry: TabPanelEntry) {
  if (!isDraggable(entry) || (event.target as Element).closest(`.${ns.e('close')}`)) return
  const el = tabElement(entry)
  if (!el) return
  pressTab(event, {
    el,
    root: listRef.value,
    drag: () => ({
      value: entry.props.value,
      label: labelText(entry),
      group: props.group,
      name: props.name,
      index: panels.value.indexOf(entry),
      source: self,
    }),
    onStart: () => (draggingUid.value = entry.uid),
    onEnd: () => {
      draggingUid.value = null
      clickBlocked = true
      setTimeout(() => (clickBlocked = false))
    },
  })
}

/** Where a tab dropped now would go: before the tab at `index`, or after the last. */
const marker = ref<{ index: number; at: number } | null>(null)

function insertionAt(x: number, y: number) {
  const entries = panels.value
  const index = entries.findIndex((entry) => {
    const rect = tabElement(entry)?.getBoundingClientRect()
    if (!rect) return false
    return vertical.value ? y < rect.top + rect.height / 2 : x < rect.left + rect.width / 2
  })
  return index < 0 ? entries.length : index
}

/** Whether dropping there leaves the tab where it is. */
const stays = (drag: TabDrag, index: number) =>
  drag.source === self && (index === drag.index || index === drag.index + 1)

function markerOffset(index: number) {
  const entries = panels.value
  const style = getComputedStyle(listRef.value!)
  const gap = Number.parseFloat(vertical.value ? style.rowGap : style.columnGap) || 0
  const before = entries[index] && tabElement(entries[index])
  if (before) return (vertical.value ? before.offsetTop : before.offsetLeft) - gap / 2
  const last = entries.at(-1)
  const after = last && tabElement(last)
  if (!after) return 0
  return vertical.value
    ? after.offsetTop + after.offsetHeight + gap / 2
    : after.offsetLeft + after.offsetWidth + gap / 2
}

/** Scroll a row that does not fit while the pointer is near one of its ends. */
function scrollNearEdge(x: number, y: number) {
  const list = listRef.value
  if (!list) return
  const rect = list.getBoundingClientRect()
  const EDGE = 32
  const speed = (d: number) => Math.ceil(((EDGE - Math.max(0, d)) / EDGE) * 10)
  const [pos, startEdge, endEdge] = vertical.value
    ? [y, rect.top, rect.bottom]
    : [x, rect.left, rect.right]
  let delta = 0
  if (pos - startEdge < EDGE) delta = -speed(pos - startEdge)
  else if (endEdge - pos < EDGE) delta = speed(endEdge - pos)
  if (!delta) return
  if (vertical.value) list.scrollTop += delta
  else list.scrollLeft += delta
}

const dropZone = registerTabDropZone({
  el: () => headerRef.value,
  // its own tabs always come back; tabs from others only when these take drops
  accepts: (drag) =>
    drag.source === self || (props.draggable && !!props.group && drag.group === props.group),
  over(drag, x, y) {
    scrollNearEdge(x, y)
    const index = insertionAt(x, y)
    if (stays(drag, index)) {
      marker.value = null
      return
    }
    // kept inside the row, which cuts off what sticks out
    const list = listRef.value!
    const end = (vertical.value ? list.scrollHeight : list.scrollWidth) - 2
    const at = Math.min(Math.max(markerOffset(index), 1), end)
    if (marker.value?.index !== index || marker.value.at !== at) marker.value = { index, at }
  },
  leave: () => (marker.value = null),
  drop(drag) {
    const index = marker.value?.index
    marker.value = null
    if (index === undefined) return
    const within = drag.source === self
    emit('move', {
      value: drag.value,
      from: { name: drag.name, index: drag.index },
      to: { name: props.name, index: within && index > drag.index ? index - 1 : index },
    })
    // dragging a tab is using it
    void selectValue(drag.value)
  },
})
onMounted(() => {
  dropZone.update()
  if (process.env.NODE_ENV !== 'production' && props.group && props.name === undefined)
    devWarn(
      `[dou-ui] DouTabs: tabs in the group "${props.group}" need a \`name\`; \`move\` cannot tell which tabs a tab came from without it.`,
    )
})
onUpdated(() => dropZone.update())
onBeforeUnmount(() => dropZone.remove())

const markerStyle = computed(() => {
  const at = marker.value?.at
  if (at === undefined) return { display: 'none' }
  return { transform: vertical.value ? `translateY(${at}px)` : `translateX(${at}px)` }
})

/** A tab moved with the keyboard keeps the focus once it is in its new place. */
let focusAfterMove: TabsValue | undefined

function moveByKey(event: KeyboardEvent, entry: TabPanelEntry) {
  const [prev, next] = vertical.value ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
  const entries = panels.value
  const index = entries.indexOf(entry)
  const last = entries.length - 1
  const target =
    event.key === prev
      ? index - 1
      : event.key === next
        ? index + 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : null
  if (target === null) return false
  event.preventDefault()
  if (target < 0 || target > last || target === index) return true
  focusAfterMove = entry.props.value
  emit('move', {
    value: entry.props.value,
    from: { name: props.name, index },
    to: { name: props.name, index: target },
  })
  announce(
    t('tabs.moved', { label: labelText(entry), position: target + 1, total: entries.length }),
  )
  return true
}

watch(
  panels,
  () => {
    if (focusAfterMove === undefined) return
    const entry = panels.value.find((panel) => panel.props.value === focusAfterMove)
    focusAfterMove = undefined
    const el = entry && tabElement(entry)
    if (el && document.activeElement !== el) el.focus()
  },
  { flush: 'post' },
)

const moveKeys = computed(() =>
  vertical.value
    ? 'Alt+ArrowUp Alt+ArrowDown Alt+Home Alt+End'
    : 'Alt+ArrowLeft Alt+ArrowRight Alt+Home Alt+End',
)
function keyShortcuts(entry: TabPanelEntry) {
  const keys = [isClosable(entry) && 'Delete', isDraggable(entry) && moveKeys.value].filter(Boolean)
  return keys.length ? keys.join(' ') : undefined
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

// Arrows in a narrow row would leave no room for a single tab: there the
// row scrolls by swiping, the wheel or the keyboard alone.
const ARROWS_MIN_WIDTH = 160
const arrows = ref(true)

function updateOverflow() {
  // a header not laid out yet has no width to go by
  const width = headerRef.value?.clientWidth || Infinity
  arrows.value = width >= ARROWS_MIN_WIDTH
  const list = listRef.value
  if (!list) {
    overflow.value = { start: false, end: false }
    return
  }
  if (vertical.value) {
    // a column only overflows with a fixed `height`; there it fades but has no arrows
    const max = list.scrollHeight - list.clientHeight
    // kept in range while the column bounces
    const top = scrollPositionOf(list).top
    overflow.value = { start: top > 1, end: top < max - 1 }
    return
  }
  const max = list.scrollWidth - list.clientWidth
  // from the start, also right to left, and kept in range while the row bounces
  const left = Math.abs(scrollPositionOf(list).left)
  // a sub-pixel remainder is not something to scroll to
  overflow.value = { start: left > 1, end: left < max - 1 }
}

function reveal(smooth: boolean) {
  const list = listRef.value
  const entry = panels.value.find((panel) => panel.props.value === selected.value)
  const tab = entry && tabElement(entry)
  if (!list || !tab) return
  // leave room for the faded edge, so the tab is not under it
  const margin = 32
  if (vertical.value) {
    const top = tab.offsetTop - margin
    const bottom = tab.offsetTop + tab.offsetHeight + margin - list.clientHeight
    const target = top < list.scrollTop ? top : bottom > list.scrollTop ? bottom : null
    if (target === null) return
    list.scrollTo({
      top: Math.max(0, target),
      behavior: smooth && !reduced.value ? 'smooth' : 'auto',
    })
    return
  }
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
watch(
  [selected, panels, size, () => props.placement, () => props.iconOnly, () => props.height],
  () =>
    nextTick(() => {
      measure()
      updateOverflow()
      reveal(settled.value)
    }),
)

const rootStyle = computed(() =>
  props.height === undefined
    ? undefined
    : {
        height: typeof props.height === 'number' ? `${props.height}px` : props.height,
      },
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
      ns.is('fixed', height !== undefined),
      ns.is('icon-only', iconOnly),
      ns.is('drop-target', !!marker),
    ]"
    :style="rootStyle"
  >
    <div ref="header" :class="ns.e('header')">
      <button
        v-if="!vertical && arrows && (overflow.start || overflow.end)"
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
        <template v-for="entry in panels" :key="entry.uid">
          <TabTip :entry="entry">
            <button
              :id="tabId(entry.props.value)"
              :ref="(el) => setTabElement(entry.uid, el)"
              type="button"
              role="tab"
              :class="[
                ns.e('tab'),
                ns.is('selected', entry.props.value === selected),
                ns.is('disabled', !!entry.props.disabled),
                ns.is('closable', isClosable(entry)),
                ns.is('icon-alone', iconAlone(entry)),
                ns.is('draggable', isDraggable(entry)),
                ns.is('dragging', draggingUid === entry.uid),
              ]"
              :aria-selected="entry.props.value === selected"
              :aria-controls="panelId(entry.props.value)"
              :aria-label="iconAlone(entry) ? labelText(entry) : undefined"
              :aria-disabled="entry.props.disabled || undefined"
              :tabindex="entry.props.value === selected ? 0 : -1"
              :aria-keyshortcuts="keyShortcuts(entry)"
              @click="onClick(entry)"
              @pointerdown="onPointerdown($event, entry)"
              @keydown="onKeydown($event, entry)"
            >
              <component
                :is="entry.props.icon"
                v-if="entry.props.icon"
                :class="ns.e('icon')"
                aria-hidden="true"
              />
              <span v-if="!iconAlone(entry)" :class="ns.e('label')">
                <TabLabel :entry="entry" :selected="entry.props.value === selected" />
              </span>
              <!-- not a button of its own: a tab cannot hold one; `Delete` closes it from the keyboard.
               An icon alone already has the label's tooltip, so the close button goes without. -->
              <DouTooltip
                v-if="isClosable(entry)"
                :content="t('tabs.close')"
                shortcut="delete"
                :disabled="iconAlone(entry)"
              >
                <span :class="ns.e('close')" aria-hidden="true" @click.stop="remove(entry)">
                  <CloseIcon />
                </span>
              </DouTooltip>
            </button>
          </TabTip>
        </template>
        <span :class="ns.e('indicator')" :style="indicatorStyle" aria-hidden="true" />
        <span v-if="draggable" :class="ns.e('marker')" :style="markerStyle" aria-hidden="true" />
      </div>
      <button
        v-if="!vertical && arrows && (overflow.start || overflow.end)"
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
