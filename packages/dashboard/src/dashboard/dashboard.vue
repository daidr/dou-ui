<script setup lang="ts">
import { LayoutGridPlusIcon } from '@dou-ui/icons'
import { DouDialog, DouDrawer, DouEmpty, DouInput, matchesHotkey } from 'dou-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  toRaw,
  watch,
} from 'vue'
import { DashboardHistory } from '../core/history'
import { applySteps, cloneJson, DashboardTransaction, sameValue } from '../core/transaction'
import type { DashboardStep, DashboardTransactionMeta } from '../core/transaction'
import type { DashboardDocument, DashboardPlace, DashboardWidget } from '../core/types'
import { dataContextKey } from '../data/context'
import { filterText, isEmptyFilter } from '../data/filters'
import { createSourceStore, sameSource } from '../data/store'
import type {
  DashboardFilters,
  DashboardLinkedFilter,
  DashboardSetFilterOptions,
} from '../data/types'
import GridLayout from '../grid/grid-layout.vue'
import { DEFAULT_BREAKPOINTS, DEFAULT_COLUMNS, gridTiers } from '../grid/tiers'
import type { GridDropEvent, GridLayoutExpose, GridLayouts } from '../grid/types'
import { findPlace, fitItem, moveItem } from '../layout/engine'
import type { GridItem, GridLayoutOptions } from '../layout/types'
import { format, useDashboardMessages } from '../locale'
import { DEFAULT_WIDGET_SIZE, defaultPropsOf } from '../widget/define'
import type { DashboardWidgetType } from '../widget/define'
import type { DashboardAddOptions, DashboardEmits, DashboardExpose, DashboardProps } from './types'
import { createObservers, observersKey } from './observers'
import WidgetBody from './widget-body.vue'
import WidgetFrame from './widget-frame.vue'
import WidgetSettings from './widget-settings.vue'
import { frameContextKey } from './frame-context'
import type { WidgetAction } from './frame-context'

defineOptions({ name: 'DouDashboard' })

const props = withDefaults(defineProps<Omit<DashboardProps, 'modelValue' | 'filters'>>(), {
  widgets: () => [],
  columns: () => DEFAULT_COLUMNS,
  breakpoints: () => DEFAULT_BREAKPOINTS,
  rowHeight: 80,
  gap: 16,
  compact: 'vertical',
})
const emit = defineEmits<Omit<DashboardEmits, 'update:modelValue' | 'update:filters'>>()
const model = defineModel<DashboardDocument>({ default: () => ({ version: 1, widgets: [] }) })
const filters = defineModel<DashboardFilters>('filters', { default: () => ({}) })
const messages = useDashboardMessages(() => props.messages)

const grid = ref<GridLayoutExpose>()
const observers = createObservers()
provide(observersKey, observers)
onBeforeUnmount(() => observers.dispose())
/** This many widgets are drawn in full at once, the rest when they come near the view. */
const EAGER = 16
const root = ref<HTMLElement>()

const typeMap = computed(() => new Map(props.widgets.map((type) => [type.type, type])))
const typeOf = (widget: DashboardWidget) => typeMap.value.get(widget.type)
const widgetMap = computed(() => new Map(model.value.widgets.map((widget) => [widget.id, widget])))
/** The first widgets of the document, drawn in full without waiting to be seen. */
const eagerIds = computed(() => new Set(model.value.widgets.slice(0, EAGER).map((w) => w.id)))
/** Widgets added once the dashboard is up are drawn in full straight away (not reactive on purpose). */
let mounted = false
onMounted(() => (mounted = true))
const isEager = (id: string) => mounted || eagerIds.value.has(id)
const titleOf = (widget: DashboardWidget) => widget.title || typeOf(widget)?.label || widget.type

const tiers = computed(() => gridTiers(props.columns, props.breakpoints))
/** The widest breakpoint: its places are the main ones. */
const main = computed(() => tiers.value[0]!)
const mainOptions = computed<GridLayoutOptions>(() => ({
  columns: Math.max(1, Math.round(main.value.columns)),
  compact: props.compact,
}))

// ---------------------------------------------------------------------------
// Changes and history

const history = new DashboardHistory()
/** Bumped whenever the history changes, so `canUndo` and `canRedo` update. */
const historyVersion = ref(0)
/** The document last emitted, to tell our own changes from the app's. */
let emitted: DashboardDocument | undefined
watch(model, (doc) => {
  // the app may hand back a reactive copy of what was emitted
  // a document the app put in itself: the old steps no longer fit it
  if (toRaw(doc) === emitted) return
  history.clear()
  historyVersion.value++
})

function commit(tr: DashboardTransaction) {
  emitted = toRaw(tr.doc)
  model.value = tr.doc
  emit('change', tr)
}

/** A transaction on the document as it is now, to `dispatch`. */
function transaction() {
  return new DashboardTransaction(model.value)
}

/** Makes the changes of a transaction, as one undo step (or part of one, by `meta.group`). */
function dispatch(tr: DashboardTransaction) {
  if (toRaw(tr.before) !== toRaw(model.value))
    throw new Error('[dou-ui] the transaction was made on another version of the dashboard')
  if (!tr.changed) return
  history.record(tr)
  historyVersion.value++
  commit(tr)
}

/** Steps made into a transaction and dispatched, for the dashboard's own changes. */
function run(steps: DashboardStep[], meta: DashboardTransactionMeta) {
  const tr = applySteps(model.value, steps, meta)
  dispatch(tr)
  return tr
}

function undo() {
  const tr = history.undo(model.value)
  historyVersion.value++
  if (!tr) return false
  if (tr.changed) commit(tr)
  return true
}

function redo() {
  const tr = history.redo(model.value)
  historyVersion.value++
  if (!tr) return false
  if (tr.changed) commit(tr)
  return true
}

const canUndo = computed(() => (historyVersion.value, history.canUndo))
const canRedo = computed(() => (historyVersion.value, history.canRedo))

// ---------------------------------------------------------------------------
// The grid: widgets as items, places by breakpoint

function limitsOf(type: DashboardWidgetType<any> | undefined) {
  const size = type?.size ?? DEFAULT_WIDGET_SIZE
  return {
    w: size.w,
    h: size.h,
    minW: size.minW,
    maxW: size.maxW,
    minH: size.minH,
    maxH: size.maxH,
  }
}

/** The widgets on the widest breakpoint; those without a place there get the first spot they fit. */
const placeOf = (item: DashboardPlace): DashboardPlace => ({
  x: item.x,
  y: item.y,
  w: item.w,
  h: item.h,
})

// The item of a widget that didn't change is the same object as before, so
// the grid and its other items have nothing to draw again.
let itemCache = new WeakMap<DashboardWidget, GridItem>()
watch([typeMap, main], () => (itemCache = new WeakMap()), { flush: 'sync' })
const items = computed<GridItem[]>(() => {
  const name = main.value.name
  const options = mainOptions.value
  const placed: GridItem[] = []
  const result = new Map<string, GridItem>()
  const missing: DashboardWidget[] = []
  for (const widget of model.value.widgets) {
    const raw = toRaw(widget)
    const place = raw.place[name]
    if (!place) {
      missing.push(raw)
      continue
    }
    let item = itemCache.get(raw)
    if (!item) {
      const { minW, maxW, minH, maxH } = limitsOf(typeOf(raw))
      item = { id: raw.id, ...placeOf(place), minW, maxW, minH, maxH }
      itemCache.set(raw, item)
    }
    placed.push(item)
    result.set(raw.id, item)
  }
  for (const widget of missing) {
    const fitted = fitItem(
      { id: widget.id, x: 0, y: 0, ...limitsOf(typeOf(widget)) },
      options.columns,
    )
    const item = { ...fitted, ...findPlace(placed, fitted, options) }
    placed.push(item)
    result.set(widget.id, item)
  }
  return model.value.widgets.map((widget) => result.get(widget.id)!)
})

/** The places on the narrower breakpoints. */
const layouts = computed<GridLayouts>(() => {
  const result: GridLayouts = {}
  for (const tier of tiers.value.slice(1)) {
    const list = []
    for (const widget of model.value.widgets) {
      const place = widget.place[tier.name]
      if (place) list.push({ id: widget.id, ...place })
    }
    if (list.length) result[tier.name] = list
  }
  return result
})

// The grid tells a move with `update:modelValue`, `update:layouts` and
// `drop` one after another; they are gathered into one change.
let pending: { items?: GridItem[]; layouts?: GridLayouts; drop?: { id: string; type: string } } = {}
let flushing = false
function gather(part: typeof pending) {
  Object.assign(pending, part)
  if (flushing) return
  flushing = true
  queueMicrotask(flush)
}

function flush() {
  flushing = false
  const { items: list, layouts: saved, drop } = pending
  pending = {}
  const doc = model.value
  const places = new Map<string, DashboardWidget['place']>()
  const setPlace = (id: string, name: string, item: DashboardPlace) => {
    let place = places.get(id)
    if (!place) places.set(id, (place = { ...widgetMap.value.get(id)?.place }))
    place[name] = placeOf(item)
  }
  for (const item of list ?? []) setPlace(item.id, main.value.name, item)
  for (const [name, others] of Object.entries(saved ?? {}))
    for (const item of others ?? []) setPlace(item.id, name, item)
  const steps: DashboardStep[] = []
  for (const [id, place] of places) {
    if (widgetMap.value.has(id)) {
      steps.push({ type: 'update', id, patch: { place } })
    } else if (drop?.id === id) {
      const type = typeMap.value.get(drop.type)
      if (type)
        steps.push({ type: 'add', widget: newWidget(id, type, place), index: doc.widgets.length })
    }
  }
  const tr = run(steps, { origin: drop ? 'drop' : 'layout' })
  if (drop && tr.changed) {
    const widget = widgetMap.value.get(drop.id)
    if (widget) say(format(messages.value.added, { item: titleOf(widget) }))
  }
}

function onDrop(event: GridDropEvent) {
  const data = event.data as { type?: string } | undefined
  if (data?.type) gather({ drop: { id: event.item.id, type: data.type } })
}

const dragging = ref(false)

// ---------------------------------------------------------------------------
// Adding, copying and removing

function newId(type: string) {
  const used = widgetMap.value
  for (;;) {
    const id = props.createId?.(type) ?? `${type}-${Math.random().toString(36).slice(2, 8)}`
    if (!used.has(id)) return id
    if (props.createId) throw new Error(`createId gave "${id}", which is already in use`)
  }
}

function newWidget(
  id: string,
  type: DashboardWidgetType<any>,
  place: DashboardWidget['place'],
  options: Pick<DashboardAddOptions, 'title' | 'props'> = {},
): DashboardWidget {
  const widget: DashboardWidget = { id, type: type.type, place }
  if (options.title) widget.title = options.title
  const initial = defaultPropsOf(type)
  if (initial || options.props) widget.props = { ...initial, ...options.props }
  return widget
}

/**
 * Puts a new item on the widest breakpoint, at `at` (pushing the others
 * away) or in the first spot it fits; the steps also move any widget it
 * pushed.
 */
function placeNew(item: GridItem, at: Pick<DashboardPlace, 'x' | 'y'> | undefined) {
  const options = mainOptions.value
  const fitted = fitItem(item, options.columns)
  const spot = at ?? findPlace(items.value, fitted, options)
  const layout = moveItem([...items.value, { ...fitted, ...spot }], item.id, spot, options)
  const steps: DashboardStep[] = []
  let place: DashboardPlace = { ...fitted, ...spot }
  for (const next of layout) {
    if (next.id === item.id) {
      place = placeOf(next)
      continue
    }
    const widget = widgetMap.value.get(next.id)
    const old = widget && items.value.find((other) => other.id === next.id)
    if (widget && old && (old.x !== next.x || old.y !== next.y))
      steps.push({
        type: 'update',
        id: next.id,
        patch: { place: { ...widget.place, [main.value.name]: placeOf(next) } },
      })
  }
  return { place, steps }
}

function addWidget(typeName: string, options: DashboardAddOptions = {}) {
  const type = typeMap.value.get(typeName)
  if (!type) return undefined
  const id = newId(typeName)
  const { place, steps } = placeNew({ id, x: 0, y: 0, ...limitsOf(type) }, options.at)
  const widget = newWidget(id, type, { [main.value.name]: place }, options)
  run([{ type: 'add', widget, index: model.value.widgets.length }, ...steps], {
    origin: 'api',
  })
  say(format(messages.value.added, { item: titleOf(widget) }))
  if (options.focus !== false) void nextTick(() => focusWidget(id))
  return id
}

/** Adds a copy of a widget (from this dashboard or the clipboard) beside `near`, or in the first free spot. */
function addCopy(source: DashboardWidget, near?: GridItem) {
  const type = typeOf(source)
  const id = newId(source.type)
  const columns = mainOptions.value.columns
  const size = near ?? { ...limitsOf(type), ...source.place[main.value.name] }
  const at = near
    ? near.x + near.w * 2 <= columns
      ? { x: near.x + near.w, y: near.y }
      : { x: near.x, y: near.y + near.h }
    : undefined
  const { place, steps } = placeNew({ ...limitsOf(type), id, x: 0, y: 0, w: size.w, h: size.h }, at)
  const widget: DashboardWidget = {
    ...cloneJson(source),
    id,
    place: { [main.value.name]: place },
  }
  const index = near
    ? model.value.widgets.findIndex((other) => other.id === near.id) + 1
    : model.value.widgets.length
  run([{ type: 'add', widget, index }, ...steps], { origin: 'copy' })
  say(format(messages.value.added, { item: titleOf(widget) }))
  void nextTick(() => focusWidget(id))
  return id
}

function duplicateWidget(id: string) {
  const widget = widgetMap.value.get(id)
  const item = items.value.find((other) => other.id === id)
  return widget && item ? addCopy(widget, item) : undefined
}

function removeWidget(id: string) {
  const list = model.value.widgets
  const index = list.findIndex((widget) => widget.id === id)
  if (index < 0) return
  const widget = list[index]!
  const hadFocus = root.value?.contains(document.activeElement)
  const neighbour = list[index + 1] ?? list[index - 1]
  if (settingsId.value === id) settingsId.value = undefined
  if (fullscreenId.value === id) fullscreenId.value = undefined
  run([{ type: 'remove', id }], { origin: 'api' })
  say(format(messages.value.removed, { item: titleOf(widget) }))
  if (hadFocus) void nextTick(() => (neighbour ? focusWidget(neighbour.id) : root.value?.focus()))
}

function focusWidget(id: string) {
  grid.value?.focusItem(id)
}

/** The widget being dragged in, which has no widget yet: its name is its type's. */
let adding: { id: string; label: string } | undefined

function startAdd(event: PointerEvent, typeName: string) {
  const type = typeMap.value.get(typeName)
  if (!type || !props.editable) return
  adding = { id: newId(typeName), label: type.label }
  grid.value?.startDrop(event, { id: adding.id, ...limitsOf(type) }, { type: typeName })
}

function labelOf(item: GridItem) {
  const widget = widgetMap.value.get(item.id)
  return widget ? titleOf(widget) : item.id === adding?.id ? adding.label : item.id
}

function setProps(id: string, patch: Record<string, unknown>, options: { group?: string } = {}) {
  const widget = widgetMap.value.get(id)
  if (!widget) return
  run([{ type: 'update', id, patch: { props: { ...widget.props, ...patch } } }], {
    origin: 'widget',
    group: options.group,
  })
}

function rename(id: string, title: string) {
  run([{ type: 'update', id, patch: { title: title.trim() || undefined } }], {
    origin: 'title',
  })
}

// ---------------------------------------------------------------------------
// Settings and full screen

const settingsId = ref<string>()
const settingsWidget = computed(() =>
  settingsId.value ? widgetMap.value.get(settingsId.value) : undefined,
)
const fullscreenId = ref<string>()
const fullscreenWidget = computed(() =>
  fullscreenId.value ? widgetMap.value.get(fullscreenId.value) : undefined,
)
/** The widget to give focus back to when a drawer or dialog closes. */
let returnTo: string | undefined

function openSettings(id: string) {
  if (!props.editable || !widgetMap.value.has(id)) return
  returnTo = id
  settingsId.value = id
}

function openFullscreen(id: string) {
  const widget = widgetMap.value.get(id)
  if (!widget || typeOf(widget)?.fullscreen === false) return
  returnTo = id
  fullscreenId.value = id
}

function restoreFocus() {
  const id = returnTo
  returnTo = undefined
  if (id && widgetMap.value.has(id)) focusWidget(id)
}

watch(
  () => props.editable,
  (editable) => {
    if (!editable) settingsId.value = undefined
  },
)

function onAction(id: string, action: WidgetAction) {
  if (action === 'settings') openSettings(id)
  else if (action === 'fullscreen') openFullscreen(id)
  else if (action === 'duplicate') duplicateWidget(id)
  else removeWidget(id)
}

provide(frameContextKey, {
  widget: (id) => widgetMap.value.get(id),
  type: typeOf,
  title: titleOf,
  editing: () => props.editable,
  messages: () => messages.value,
  eager: isEager,
  setProps,
  action: onAction,
  rename,
  linked: (id) => linksByWidget.value.get(id) ?? NO_LINKS,
  clearFilter: (key) => setFilter(undefined, key, undefined),
})

// ---------------------------------------------------------------------------
// Data and filters

const store = createSourceStore(() => props.sources)
onBeforeUnmount(() => store.dispose())
// a source replaced by one that loads differently loads again
watch(
  () => props.sources,
  (next, previous) => {
    const names = new Set([...Object.keys(previous ?? {}), ...Object.keys(next ?? {})])
    for (const name of names) if (!sameSource(previous?.[name], next?.[name])) store.reload(name)
  },
)

/** The filters set by widgets, by key: they apply to every widget but the one that set them. */
const links = shallowRef(new Map<string, DashboardLinkedFilter>())
const EMPTY_SET: ReadonlySet<string> = new Set()
const NO_LINKS: DashboardLinkedFilter[] = []
const linksByWidget = computed(() => {
  const result = new Map<string, DashboardLinkedFilter[]>()
  for (const link of links.value.values()) {
    const list = result.get(link.widget)
    if (list) list.push(link)
    else result.set(link.widget, [link])
  }
  return result
})
const emittedByWidget = computed(() => {
  const result = new Map<string, Set<string>>()
  for (const [id, list] of linksByWidget.value)
    result.set(id, new Set(list.map((link) => link.key)))
  return result
})

function setFilter(
  widget: string | undefined,
  key: string,
  value: unknown,
  options: DashboardSetFilterOptions = {},
) {
  const next = { ...filters.value }
  const nextLinks = new Map(links.value)
  if (isEmptyFilter(value)) delete next[key]
  else next[key] = value
  if (widget && !isEmptyFilter(value) && widgetMap.value.has(widget))
    nextLinks.set(key, { key, value, label: options.label ?? filterText(value), widget })
  else nextLinks.delete(key)
  links.value = nextLinks
  filters.value = next
}

function clearFilters() {
  links.value = new Map()
  filters.value = {}
}

// a filter changed from outside (the filter bar, the app) is no longer the widget's
watch(filters, (values) => {
  let next: Map<string, DashboardLinkedFilter> | undefined
  for (const [key, link] of links.value) {
    if (sameValue(values[key], link.value)) continue
    next ??= new Map(links.value)
    next.delete(key)
  }
  if (next) links.value = next
})

// the filters of a widget that is removed go with it
watch(widgetMap, (map) => {
  for (const link of links.value.values())
    if (!map.has(link.widget)) setFilter(undefined, link.key, undefined)
})

provide(dataContextKey, {
  store,
  filters: () => filters.value,
  emitted: (id) => emittedByWidget.value.get(id) ?? EMPTY_SET,
  linked: (id) => linksByWidget.value.get(id) ?? NO_LINKS,
  setFilter,
})

// ---------------------------------------------------------------------------
// Keyboard and clipboard

const CLIPBOARD_KIND = 'dou-dashboard/widget'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el?.tagName) return false
  return (
    el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' &&
      !['checkbox', 'radio', 'button', 'range', 'color'].includes((el as HTMLInputElement).type))
  )
}

/** The widget whose item itself has focus (not a control inside it). */
function focusedId(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return el?.dataset?.gridId && el.closest('.dou-dashboard') === root.value
    ? el.dataset.gridId
    : undefined
}

function onKeydown(event: KeyboardEvent) {
  if (!props.editable || event.defaultPrevented || isTyping(event.target)) return
  if (matchesHotkey(event, 'mod+z')) {
    event.preventDefault()
    undo()
    return
  }
  if (matchesHotkey(event, 'mod+shift+z') || matchesHotkey(event, 'mod+y')) {
    event.preventDefault()
    redo()
    return
  }
  const id = focusedId(event.target)
  if (!id || dragging.value) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    removeWidget(id)
  } else if (matchesHotkey(event, 'mod+d')) {
    event.preventDefault()
    duplicateWidget(id)
  }
}

function onCopy(event: ClipboardEvent, cut = false) {
  if (isTyping(event.target)) return
  const id = focusedId(event.target)
  const widget = id && widgetMap.value.get(id)
  if (!widget || !event.clipboardData) return
  event.clipboardData.setData('text/plain', JSON.stringify({ kind: CLIPBOARD_KIND, widget }))
  event.preventDefault()
  if (cut && props.editable) removeWidget(widget.id)
}

function onPaste(event: ClipboardEvent) {
  if (!props.editable || isTyping(event.target)) return
  let data: { kind?: string; widget?: DashboardWidget } | undefined
  try {
    data = JSON.parse(event.clipboardData?.getData('text/plain') ?? '')
  } catch {
    return
  }
  const widget = data?.kind === CLIPBOARD_KIND ? data.widget : undefined
  if (!widget?.type || !typeMap.value.has(widget.type)) return
  event.preventDefault()
  const id = focusedId(event.target)
  addCopy(widget, id ? items.value.find((item) => item.id === id) : undefined)
}

// ---------------------------------------------------------------------------
// Announcements

const live = ref('')
function say(text: string) {
  live.value = ''
  requestAnimationFrame(() => (live.value = text))
}

const breakpointName = shallowRef(main.value.name)
function onBreakpoint(name: string) {
  breakpointName.value = name
  emit('breakpoint-change', name)
}

const minHeight = computed(() => {
  const gap = Array.isArray(props.gap) ? props.gap[1] : props.gap
  return `${props.rowHeight * 3 + gap * 2}px`
})

defineExpose<DashboardExpose>({
  transaction,
  dispatch,
  undo,
  redo,
  get canUndo() {
    return canUndo.value
  },
  get canRedo() {
    return canRedo.value
  },
  addWidget,
  removeWidget,
  duplicateWidget,
  focusWidget,
  openSettings,
  openFullscreen,
  startAdd,
  get types() {
    return props.widgets
  },
  get breakpoint() {
    return grid.value?.breakpoint ?? breakpointName.value
  },
  get editable() {
    return props.editable
  },
  get document() {
    return model.value
  },
  get filters() {
    return filters.value
  },
  get linkedFilters() {
    return [...links.value.values()]
  },
  setFilter: (key, value, options) => setFilter(undefined, key, value, options),
  clearFilters,
  refresh: (source) => store.reload(source),
})
</script>

<template>
  <div
    ref="root"
    :class="['dou-dashboard', editable && 'is-editable']"
    role="region"
    :aria-label="label || messages.dashboard"
    tabindex="-1"
    @keydown="onKeydown"
    @copy="onCopy($event)"
    @cut="onCopy($event, true)"
    @paste="onPaste"
  >
    <GridLayout
      ref="grid"
      :model-value="items"
      :layouts="layouts"
      :columns="columns"
      :breakpoints="breakpoints"
      :row-height="rowHeight"
      :gap="gap"
      :compact="compact"
      :editable="editable"
      :handle="true"
      :item-label="labelOf"
      :messages="messages"
      :style="editable && !model.widgets.length ? { minHeight } : undefined"
      @update:model-value="(list) => gather({ items: list })"
      @update:layouts="(next) => gather({ layouts: next })"
      @drop="onDrop"
      @drag-start="dragging = true"
      @drag-end="dragging = false"
      @breakpoint-change="onBreakpoint"
    >
      <template #item="{ item }">
        <WidgetFrame :id="item.id" />
      </template>
    </GridLayout>
    <div v-if="editable && !model.widgets.length" class="dou-dashboard__empty">
      <DouEmpty size="sm" :title="messages.emptyTitle" :description="messages.emptyHint">
        <template #icon><LayoutGridPlusIcon /></template>
      </DouEmpty>
    </div>
    <div class="dou-dashboard__live" aria-live="polite" aria-atomic="true">{{ live }}</div>
    <DouDrawer
      :open="!!settingsWidget"
      :title="
        settingsWidget ? format(messages.settingsTitle, { title: titleOf(settingsWidget) }) : ''
      "
      :size="360"
      @update:open="(open) => !open && (settingsId = undefined)"
      @closed="restoreFocus"
    >
      <div v-if="settingsWidget" class="dou-dashboard__settings">
        <label class="dou-dashboard__field">
          <span class="dou-dashboard__field-label">{{ messages.titleField }}</span>
          <DouInput
            :model-value="settingsWidget.title ?? ''"
            :placeholder="typeOf(settingsWidget)?.label ?? settingsWidget.type"
            @update:model-value="
              (value) =>
                run(
                  [
                    {
                      type: 'update',
                      id: settingsWidget!.id,
                      patch: { title: value || undefined },
                    },
                  ],
                  { origin: 'settings', group: `title:${settingsWidget!.id}` },
                )
            "
          />
        </label>
        <WidgetSettings
          v-if="typeOf(settingsWidget)?.settings"
          :widget="settingsWidget"
          :type="typeOf(settingsWidget)!"
          :set-props="setProps"
          @update:props="
            (value) =>
              run([{ type: 'update', id: settingsWidget!.id, patch: { props: value } }], {
                origin: 'settings',
                group: `props:${settingsWidget!.id}`,
              })
          "
        />
      </div>
    </DouDrawer>
    <DouDialog
      :open="!!fullscreenWidget"
      :title="fullscreenWidget ? titleOf(fullscreenWidget) : ''"
      fullscreen
      @update:open="(open) => !open && (fullscreenId = undefined)"
      @closed="restoreFocus"
    >
      <WidgetBody
        v-if="fullscreenWidget"
        class="is-fullscreen"
        :widget="fullscreenWidget"
        :type="typeOf(fullscreenWidget)"
        :editing="false"
        fullscreen
        :messages="messages"
        :set-props="setProps"
      />
    </DouDialog>
  </div>
</template>
