<script setup lang="ts">
import {
  computed,
  inject,
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
import { CheckIcon, ChevronDownIcon, CloseIcon, PinIcon, PlusIcon } from '@dou-ui/icons'
import { useReducedMotion } from '../../composables/use-motion'
import { announce } from '../../utils/announce'
import { useNamespace } from '../../utils/namespace'
import { scrollPositionOf } from '../../utils/scroll'
import { devWarn } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import { useFormSize } from '../form/use-form-item'
import { DouPopover } from '../popover'
import TabButton from './tab-button.vue'
import { pressTab, registerTabDropZone, tabMergeTargetKey } from './tab-drag'
import { tabsKey } from './tabs'
import { resolveTruncatedTitle } from './truncated-title'
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
// The panels may have been put in a new order, e.g. after a `move`, or a
// tab's label may have changed width.
onUpdated(() => {
  sync()
  updateOverflow()
})

const pinnedPanels = computed(() => panels.value.filter((entry) => !!entry.props.pinned))
const regularPanels = computed(() => panels.value.filter((entry) => !entry.props.pinned))
const orderedPanels = computed(() => [...pinnedPanels.value, ...regularPanels.value])

const firstEnabled = computed(() => orderedPanels.value.find((entry) => !entry.props.disabled))
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
  await selectValue(entry.props.value, selected.value)
}
async function selectValue(next: TabsValue, current: TabsValue | undefined): Promise<boolean> {
  if (next === current) return true
  if (props.beforeLeave && !(await props.beforeLeave(next, current))) return false
  model.value = next
  emit('change', next)
  return true
}

const isClosable = (entry: TabPanelEntry) =>
  !entry.props.disabled && (entry.props.closable ?? (entry.props.pinned ? false : props.closable))

function remove(entry: TabPanelEntry) {
  if (isClosable(entry)) emit('remove', entry.props.value)
}

type TabDropZoneKind = 'pinned' | 'regular'

const listRef = useTemplateRef<HTMLElement>('list')
const pinnedRef = useTemplateRef<HTMLElement>('pinned')
const headerRef = useTemplateRef<HTMLElement>('header')
// Kept separate by zone so toggling a panel's `pinned` state mounts its new
// button before the old one unmounts without the unmount clearing the new ref.
const pinnedTabElements = new Map<number, HTMLElement>()
const regularTabElements = new Map<number, HTMLElement>()

function setTabElement(zone: TabDropZoneKind, uid: number, el: unknown) {
  const map = zone === 'pinned' ? pinnedTabElements : regularTabElements
  if (el instanceof HTMLElement) map.set(uid, el)
  else map.delete(uid)
}
function tabElement(entry: TabPanelEntry) {
  return (entry.props.pinned ? pinnedTabElements : regularTabElements).get(entry.uid)
}

/** The label slot of a panel, rendered inside its overflow list item. */
const TabLabel: FunctionalComponent<{ entry: TabPanelEntry; selected: boolean }> = ({
  entry,
  selected: isSelected,
}) => (entry.slots.label?.({ selected: isSelected }) as VNode[] | undefined) ?? labelText(entry)

const labelText = (entry: TabPanelEntry) => entry.props.label ?? String(entry.props.value)

/**
 * Whether the tab shows its icon alone (with label in a tooltip):
 * pinned tabs with an icon always do; with `iconOnly`, every tab with an icon does.
 */
function iconAlone(entry: TabPanelEntry) {
  if (entry.props.pinned) return !!entry.props.icon
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

// With `iconOnly` or pinned icon tabs, the label shows in a tooltip: beside a column, above a row.
const tipPlacement = computed<'top' | 'right' | 'left'>(() =>
  props.placement === 'start' ? 'right' : props.placement === 'end' ? 'left' : 'top',
)

function onKeydown(event: KeyboardEvent, entry: TabPanelEntry) {
  if (event.altKey && isDraggable(entry) && moveByKey(event, entry)) return
  const enabled = orderedPanels.value.filter((panel) => !panel.props.disabled)
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
    root: headerRef.value,
    drag: () => ({
      value: entry.props.value,
      label: labelText(entry),
      group: props.group,
      name: props.name,
      index: panels.value.indexOf(entry),
      source: self,
      pinned: !!entry.props.pinned,
    }),
    onStart: () => (draggingUid.value = entry.uid),
    onEnd: () => {
      draggingUid.value = null
      clickBlocked = true
      setTimeout(() => (clickBlocked = false))
    },
  })
}

interface TabDropMarker {
  /** Which logical zone the dragged tab lands in. */
  zone: TabDropZoneKind
  /** Insertion slot inside `zone`. */
  slot: number
  at: number
}

/** Where a tab dropped now would go: before the tab at `slot` of its zone, or after the last. */
const marker = ref<TabDropMarker | null>(null)
/** Existing tab that a dragged tab will merge into on drop, when inside a `DouDock`. */
const mergeTarget = ref<TabsValue | null>(null)
let mergeFallbackIndex = 0
const mergeBridge = inject(tabMergeTargetKey, undefined)
const activeMergeTarget = computed(() => mergeTarget.value ?? mergeBridge?.active.value ?? null)

function zoneEntries(zone: TabDropZoneKind) {
  return zone === 'pinned' ? pinnedPanels.value : regularPanels.value
}

function insertionAt(zone: TabDropZoneKind, x: number, y: number) {
  const entries = zoneEntries(zone)
  const index = entries.findIndex((entry) => {
    const rect = tabElement(entry)?.getBoundingClientRect()
    if (!rect) return false
    return vertical.value ? y < rect.top + rect.height / 2 : x < rect.left + rect.width / 2
  })
  return index < 0 ? entries.length : index
}

/**
 * Whether the tab comes from these tabs: dragged from them, or from
 * elsewhere (a list outside a dock) when these tabs hold it already.
 */
const fromHere = (drag: TabDrag) =>
  drag.source === self ||
  (drag.name !== undefined && drag.name === props.name && drag.group === props.group)

/** Whether dropping there leaves the tab where it is. */
function stays(drag: TabDrag, zone: TabDropZoneKind, slot: number) {
  if (!fromHere(drag)) return false
  const entries = zoneEntries(zone)
  const currentIndex = entries.findIndex((entry) => entry.props.value === drag.value)
  return currentIndex >= 0 && (slot === currentIndex || slot === currentIndex + 1)
}

/** Map a visual zone slot back to an insertion index in `panels.value`. */
function rawInsertIndex(zone: TabDropZoneKind, slot: number) {
  const entries = zoneEntries(zone)
  if (!entries.length) return zone === 'pinned' ? 0 : panels.value.length
  const before = entries[slot]
  if (before) return panels.value.indexOf(before)
  const last = entries.at(-1)!
  return panels.value.indexOf(last) + 1
}

function markerOffset(zone: TabDropZoneKind, slot: number, container: HTMLElement) {
  const entries = zoneEntries(zone)
  const style = getComputedStyle(container)
  const gap = Number.parseFloat(vertical.value ? style.rowGap : style.columnGap) || 0
  const before = entries[slot] && tabElement(entries[slot])
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
    const zone: TabDropZoneKind = drag.pinned ? 'pinned' : 'regular'
    const merge = mergeBridge?.resolve(drag)
    if (merge !== undefined) {
      marker.value = null
      mergeTarget.value = merge
      mergeFallbackIndex = rawInsertIndex(zone, insertionAt(zone, x, y))
      return
    }
    mergeTarget.value = null
    if (zone === 'regular') scrollNearEdge(x, y)
    const slot = insertionAt(zone, x, y)
    if (stays(drag, zone, slot)) {
      marker.value = null
      return
    }
    let at = 1
    if (zone === 'regular' || pinnedPanels.value.length > 0) {
      const container = zone === 'pinned' ? pinnedRef.value : listRef.value
      if (container) {
        // kept inside the row, which cuts off what sticks out
        const end = Math.max(
          1,
          (vertical.value ? container.scrollHeight : container.scrollWidth) - 2,
        )
        at = Math.min(Math.max(markerOffset(zone, slot, container), 1), end)
      }
    }
    if (marker.value?.zone !== zone || marker.value.slot !== slot || marker.value.at !== at) {
      marker.value = { zone, slot, at }
    }
  },
  leave() {
    marker.value = null
    mergeTarget.value = null
  },
  drop(drag) {
    const merge = mergeTarget.value
    const current = marker.value
    marker.value = null
    mergeTarget.value = null
    if (merge !== null) {
      emit('move', {
        value: drag.value,
        from: { name: drag.name, index: drag.index },
        to: { name: props.name, index: mergeFallbackIndex },
      })
      return
    }
    if (!current) return
    const within = fromHere(drag)
    const raw = rawInsertIndex(current.zone, current.slot)
    const prevModel = model.value
    const prevSelected = selected.value
    const prevIndex = panels.value.findIndex((panel) => panel.props.value === drag.value)
    emit('move', {
      value: drag.value,
      from: { name: drag.name, index: drag.index },
      to: { name: props.name, index: within && raw > drag.index ? raw - 1 : raw },
    })
    // Dragging a tab is using it, unless the move listener rejected or merged
    // the tab (so it did not land here) or already updated `modelValue`.
    void nextTick(() => {
      if (model.value !== prevModel) return
      const nextIndex = panels.value.findIndex((panel) => panel.props.value === drag.value)
      if (nextIndex < 0) return
      if (within && nextIndex === prevIndex) return
      if (drag.value === prevSelected) {
        if (selected.value !== drag.value) model.value = drag.value
        return
      }
      void selectValue(drag.value, prevSelected)
    })
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
  if (marker.value?.zone !== 'regular') return { display: 'none' }
  return {
    transform: vertical.value
      ? `translateY(${marker.value.at}px)`
      : `translateX(${marker.value.at}px)`,
  }
})

const pinnedMarkerStyle = computed(() => {
  if (marker.value?.zone !== 'pinned') return { display: 'none' }
  return {
    transform: vertical.value
      ? `translateY(${marker.value.at}px)`
      : `translateX(${marker.value.at}px)`,
  }
})

/** A tab moved with the keyboard keeps the focus once it is in its new place. */
let focusAfterMove: TabsValue | undefined

function moveByKey(event: KeyboardEvent, entry: TabPanelEntry) {
  const [prev, next] = vertical.value ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
  const zone: TabDropZoneKind = entry.props.pinned ? 'pinned' : 'regular'
  const entries = zoneEntries(zone)
  const zoneIndex = entries.indexOf(entry)
  const last = entries.length - 1
  const targetSlot =
    event.key === prev
      ? zoneIndex - 1
      : event.key === next
        ? zoneIndex + 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : null
  if (targetSlot === null) return false
  event.preventDefault()
  if (targetSlot < 0 || targetSlot > last || targetSlot === zoneIndex) return true
  const fromIndex = panels.value.indexOf(entry)
  const anchor = entries[targetSlot]!
  const toIndex = panels.value.indexOf(anchor)
  focusAfterMove = entry.props.value
  emit('move', {
    value: entry.props.value,
    from: { name: props.name, index: fromIndex },
    to: { name: props.name, index: toIndex },
  })
  const position = (zone === 'pinned' ? 0 : pinnedPanels.value.length) + targetSlot + 1
  announce(
    t('tabs.moved', {
      label: labelText(entry),
      position,
      total: orderedPanels.value.length,
    }),
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
interface IndicatorBox {
  left: number
  top: number
  width: number
  height: number
}
const indicator = ref<IndicatorBox | null>(null)
const pinnedIndicator = ref<IndicatorBox | null>(null)
const settled = ref(false)

function measure() {
  const entry = orderedPanels.value.find((panel) => panel.props.value === selected.value)
  const tab = entry && tabElement(entry)
  watchTab(tab)
  if (!entry || !tab) {
    indicator.value = null
    pinnedIndicator.value = null
    return
  }
  const box: IndicatorBox = {
    left: tab.offsetLeft,
    top: tab.offsetTop,
    width: tab.offsetWidth,
    height: tab.offsetHeight,
  }
  if (entry.props.pinned) {
    pinnedIndicator.value = box
    indicator.value = null
  } else {
    indicator.value = box
    pinnedIndicator.value = null
  }
}

// When the tabs do not fit, the list scrolls sideways: the edges fade,
// the wheel scrolls it horizontally, a button at the end opens the full list
// in a popover, and the selected tab is kept in view.
const overflow = ref({ start: false, end: false, any: false })
const hasOverflow = computed(() => !vertical.value && overflow.value.any)
const overflowOpen = ref(false)
const reduced = useReducedMotion()

function setOverflow(start: boolean, end: boolean, any: boolean) {
  const prev = overflow.value
  if (prev.start === start && prev.end === end && prev.any === any) return
  overflow.value = { start, end, any }
}

function updateOverflow() {
  const list = listRef.value
  if (!list) {
    setOverflow(false, false, false)
    return
  }
  if (vertical.value) {
    // a column only overflows with a fixed `height`; there it fades without a popover
    const max = list.scrollHeight - list.clientHeight
    // kept in range while the column bounces
    const top = scrollPositionOf(list).top
    setOverflow(top > 1, top < max - 1, false)
    return
  }
  const max = list.scrollWidth - list.clientWidth
  // from the start, also right to left, and kept in range while the row bounces
  const left = Math.abs(scrollPositionOf(list).left)
  // a sub-pixel remainder is not something to scroll to
  setOverflow(left > 1, left < max - 1, max > 1)
}

watch(hasOverflow, (value) => {
  if (!value) overflowOpen.value = false
})

function onWheel(event: WheelEvent) {
  if (vertical.value || event.ctrlKey || event.metaKey) return
  const list = listRef.value
  if (!list) return
  const max = list.scrollWidth - list.clientWidth
  if (max <= 1) return
  // Let native horizontal scrolling (trackpad or tilt wheel) pass through.
  if (event.deltaX !== 0 || event.deltaY === 0) return
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientWidth : 1
  const delta = event.deltaY * scale
  const rtl = getComputedStyle(list).direction === 'rtl'
  const next = rtl
    ? Math.min(0, Math.max(-max, list.scrollLeft - delta))
    : Math.min(max, Math.max(0, list.scrollLeft + delta))
  event.preventDefault()
  if (next !== list.scrollLeft) {
    list.scrollLeft = next
    updateOverflow()
  }
}

const overflowItems = new Map<number, HTMLButtonElement>()
function setOverflowItem(uid: number, el: unknown) {
  if (el instanceof HTMLButtonElement) overflowItems.set(uid, el)
  else overflowItems.delete(uid)
}

let pendingOverflowFocus: 'selected' | 'first' | 'last' = 'selected'
let focusOverflowAfterRemove: TabsValue | undefined

function focusOverflowItem(target: 'selected' | 'first' | 'last' | TabsValue = 'selected') {
  const enabled = orderedPanels.value.filter((panel) => !panel.props.disabled)
  if (!enabled.length) return
  let entry: TabPanelEntry | undefined
  if (target === 'first') entry = enabled[0]
  else if (target === 'last') entry = enabled.at(-1)
  else if (target === 'selected') {
    entry = enabled.find((panel) => panel.props.value === selected.value) ?? enabled[0]
  } else {
    entry = enabled.find((panel) => panel.props.value === target) ?? enabled[0]
  }
  const el = entry && overflowItems.get(entry.uid)
  if (!el) return
  el.scrollIntoView?.({ block: 'nearest' })
  el.focus({ preventScroll: true })
}

watch(overflowOpen, (open) => {
  if (!open) return
  const target = pendingOverflowFocus
  pendingOverflowFocus = 'selected'
  void nextTick(() => focusOverflowItem(target))
})

watch(
  panels,
  () => {
    if (focusOverflowAfterRemove === undefined) return
    const target = focusOverflowAfterRemove
    focusOverflowAfterRemove = undefined
    if (!overflowOpen.value) return
    focusOverflowItem(target)
  },
  { flush: 'post' },
)

function onOverflowTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const target = event.key === 'ArrowUp' ? 'last' : 'selected'
  if (overflowOpen.value) {
    focusOverflowItem(target)
    return
  }
  pendingOverflowFocus = target
  overflowOpen.value = true
}

function onOverflowItemKeydown(event: KeyboardEvent, entry: TabPanelEntry) {
  const enabled = orderedPanels.value.filter((panel) => !panel.props.disabled)
  const index = enabled.indexOf(entry)
  let target: TabPanelEntry | undefined
  switch (event.key) {
    case 'ArrowDown':
      target = enabled[(index + 1) % enabled.length]
      break
    case 'ArrowUp':
      target = enabled[(index - 1 + enabled.length) % enabled.length]
      break
    case 'Home':
      target = enabled[0]
      break
    case 'End':
      target = enabled.at(-1)
      break
    case 'Delete':
    case 'Backspace': {
      if (!isClosable(entry)) return
      event.preventDefault()
      const neighbor = enabled[index + 1] ?? enabled[index - 1]
      focusOverflowAfterRemove = neighbor?.props.value
      remove(entry)
      return
    }
    default:
      return
  }
  if (!target) return
  event.preventDefault()
  const el = overflowItems.get(target.uid)
  el?.scrollIntoView?.({ block: 'nearest' })
  el?.focus({ preventScroll: true })
}

function onOverflowItemEnter(event: PointerEvent, entry: TabPanelEntry) {
  const button = event.currentTarget as HTMLElement | null
  const labelEl = button?.querySelector<HTMLElement>(`.${ns.e('overflow-label')}`)
  const title = resolveTruncatedTitle(labelEl, entry.props.label)
  if (!button) return
  if (title) button.title = title
  else button.removeAttribute('title')
}

async function selectFromOverflow(entry: TabPanelEntry, event: MouseEvent) {
  if (entry.props.disabled) return
  const moved = await selectValue(entry.props.value, selected.value)
  if (!moved) return
  overflowOpen.value = false
  await nextTick()
  reveal(settled.value)
  if (event.detail === 0) tabElement(entry)?.focus({ preventScroll: true })
}

function reveal(smooth: boolean) {
  const list = listRef.value
  const entry = orderedPanels.value.find((panel) => panel.props.value === selected.value)
  const tab = entry && tabElement(entry)
  if (!list || !tab || entry.props.pinned) return
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

let observer: ResizeObserver | undefined
// the selected tab is watched too: its label can grow while the row keeps its size
let watchedTab: HTMLElement | undefined
let watchedPinned: HTMLElement | undefined
function watchTab(tab: HTMLElement | undefined) {
  if (tab === watchedTab) return
  if (watchedTab) observer?.unobserve(watchedTab)
  watchedTab = tab
  if (tab) observer?.observe(tab)
}
watch(pinnedRef, (el) => {
  if (watchedPinned) observer?.unobserve(watchedPinned)
  watchedPinned = el ?? undefined
  if (watchedPinned) observer?.observe(watchedPinned)
})
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
    if (pinnedRef.value) {
      watchedPinned = pinnedRef.value
      observer.observe(watchedPinned)
    }
    if (watchedTab) observer.observe(watchedTab)
  }
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  [
    selected,
    panels,
    pinnedPanels,
    size,
    () => props.placement,
    () => props.iconOnly,
    () => props.height,
  ],
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

function styleForIndicator(box: IndicatorBox | null) {
  if (!box) return { display: 'none' }
  return vertical.value
    ? { transform: `translateY(${box.top}px)`, height: `${box.height}px` }
    : { transform: `translateX(${box.left}px)`, width: `${box.width}px` }
}
const indicatorStyle = computed(() => styleForIndicator(indicator.value))
const pinnedIndicatorStyle = computed(() => styleForIndicator(pinnedIndicator.value))
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
      ns.is('drop-target', !!marker || mergeTarget !== null),
    ]"
    :style="rootStyle"
  >
    <div ref="header" :class="ns.e('header')">
      <div
        :class="ns.e('tablist')"
        role="tablist"
        :aria-orientation="vertical ? 'vertical' : 'horizontal'"
      >
        <div
          v-if="pinnedPanels.length || marker?.zone === 'pinned'"
          ref="pinned"
          :class="[
            ns.e('pinned'),
            ns.is(
              'divided',
              pinnedPanels.length > 0 && (regularPanels.length > 0 || marker?.zone === 'regular'),
            ),
          ]"
        >
          <TabButton
            v-for="entry in pinnedPanels"
            :key="entry.uid"
            :entry="entry"
            :tab-id="tabId(entry.props.value)"
            :panel-id="panelId(entry.props.value)"
            :label-text="labelText(entry)"
            :selected="entry.props.value === selected"
            :closable="isClosable(entry)"
            :icon-alone="iconAlone(entry)"
            :draggable="isDraggable(entry)"
            :dragging="draggingUid === entry.uid"
            :merge-target="entry.props.value === activeMergeTarget"
            :tip-placement="tipPlacement"
            :key-shortcuts="keyShortcuts(entry)"
            :set-el="(el) => setTabElement('pinned', entry.uid, el)"
            @click="onClick(entry)"
            @pointerdown="onPointerdown($event, entry)"
            @keydown="onKeydown($event, entry)"
            @remove="remove(entry)"
          />
          <span :class="ns.e('indicator')" :style="pinnedIndicatorStyle" aria-hidden="true" />
          <span
            v-if="draggable"
            :class="ns.e('marker')"
            :style="pinnedMarkerStyle"
            aria-hidden="true"
          />
        </div>
        <div
          ref="list"
          :class="[
            ns.e('list'),
            ns.is('fade-start', overflow.start),
            ns.is('fade-end', overflow.end),
          ]"
          @scroll.passive="updateOverflow"
          @wheel="onWheel"
        >
          <TabButton
            v-for="entry in regularPanels"
            :key="entry.uid"
            :entry="entry"
            :tab-id="tabId(entry.props.value)"
            :panel-id="panelId(entry.props.value)"
            :label-text="labelText(entry)"
            :selected="entry.props.value === selected"
            :closable="isClosable(entry)"
            :icon-alone="iconAlone(entry)"
            :draggable="isDraggable(entry)"
            :dragging="draggingUid === entry.uid"
            :merge-target="entry.props.value === activeMergeTarget"
            :tip-placement="tipPlacement"
            :key-shortcuts="keyShortcuts(entry)"
            :set-el="(el) => setTabElement('regular', entry.uid, el)"
            @click="onClick(entry)"
            @pointerdown="onPointerdown($event, entry)"
            @keydown="onKeydown($event, entry)"
            @remove="remove(entry)"
          />
          <span :class="ns.e('indicator')" :style="indicatorStyle" aria-hidden="true" />
          <span v-if="draggable" :class="ns.e('marker')" :style="markerStyle" aria-hidden="true" />
        </div>
      </div>
      <DouPopover
        v-if="hasOverflow"
        v-model:open="overflowOpen"
        placement="bottom-end"
        trigger="click"
        :offset="6"
        :class="[ns.e('overflow-popover'), ns.m(size)]"
      >
        <button
          type="button"
          :class="[ns.e('overflow'), ns.is('open', overflowOpen)]"
          :aria-label="t('tabs.more')"
          @keydown="onOverflowTriggerKeydown"
        >
          <ChevronDownIcon aria-hidden="true" />
        </button>
        <template #content>
          <div :class="ns.e('overflow-list')" role="list" :aria-label="t('tabs.more')">
            <template v-for="(entry, index) in orderedPanels" :key="entry.uid">
              <div
                v-if="index === pinnedPanels.length && pinnedPanels.length > 0"
                role="separator"
                :class="ns.e('overflow-divider')"
              />
              <div
                role="listitem"
                :class="[
                  ns.e('overflow-item'),
                  ns.is('selected', entry.props.value === selected),
                  ns.is('disabled', !!entry.props.disabled),
                  ns.is('closable', isClosable(entry)),
                  ns.is('pinned', !!entry.props.pinned),
                ]"
              >
                <button
                  :ref="(el) => setOverflowItem(entry.uid, el)"
                  type="button"
                  :class="ns.e('overflow-select')"
                  :disabled="entry.props.disabled"
                  :aria-current="entry.props.value === selected ? 'true' : undefined"
                  :aria-keyshortcuts="isClosable(entry) ? 'Delete' : undefined"
                  @pointerenter="onOverflowItemEnter($event, entry)"
                  @click="selectFromOverflow(entry, $event)"
                  @keydown="onOverflowItemKeydown($event, entry)"
                >
                  <component
                    :is="entry.props.icon"
                    v-if="entry.props.icon"
                    :class="ns.e('overflow-icon')"
                    aria-hidden="true"
                  />
                  <span :class="ns.e('overflow-label')">
                    <TabLabel :entry="entry" :selected="entry.props.value === selected" />
                  </span>
                  <PinIcon
                    v-if="entry.props.pinned"
                    :class="ns.e('overflow-pin')"
                    aria-hidden="true"
                  />
                  <CheckIcon
                    v-if="entry.props.value === selected"
                    :class="ns.e('overflow-check')"
                    aria-hidden="true"
                  />
                </button>
                <button
                  v-if="isClosable(entry)"
                  type="button"
                  tabindex="-1"
                  :class="ns.e('overflow-close')"
                  :aria-label="`${t('tabs.close')} ${labelText(entry)}`"
                  :title="t('tabs.close')"
                  @click.stop="remove(entry)"
                >
                  <CloseIcon aria-hidden="true" />
                </button>
              </div>
            </template>
          </div>
        </template>
      </DouPopover>
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
