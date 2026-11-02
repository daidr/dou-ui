<script setup lang="ts">
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CopyPlusIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@dou-ui/icons'
import { DouButton, isComposing, matchesHotkey, useSortable } from 'dou-ui'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { useSheet } from '../context'
import { sheetKey } from '../core/transaction'
import { format } from '../locale'
import type { SheetMenuItem } from '../types'
import SheetMenu from './sheet-menu.vue'

defineOptions({ name: 'DouSheetTabs' })

withDefaults(
  defineProps<{
    /** Whether to show the button that adds a sheet; `true` by default. */
    addable?: boolean
  }>(),
  { addable: true },
)

const sheet = useSheet()
const { doc, sheetIndex, messages } = sheet
const uid = useId()
const hint = `${uid}-keys`

const editable = computed(() => !sheet.readonly.value)
/** Whether sheets can be added, removed, moved and renamed: not while the workbook is protected. */
const structural = computed(() => editable.value && !doc.value.protect)
const isProtected = (key: string) => !!doc.value.sheets.find((s) => sheetKey(s) === key)?.protect
const keys = computed(() => doc.value.sheets.map(sheetKey))

// Dragging tabs into another order --------------------------------------------------------

const order = computed({
  get: () => keys.value,
  set: () => {},
})
const { container, list, listAttrs, itemAttrs, dragging } = useSortable<string>({
  items: order,
  key: (key) => key,
  direction: () => 'horizontal',
  disabled: () => !structural.value || renaming.value != null,
  label: (key) => nameOf(key),
  messages: () => ({
    item: messages.value.sheets,
    lifted: (label) => label,
    moved: (label, index, count) =>
      format(messages.value.sheetMoved, { name: label, index, count }),
    dropped: (label, index, count) =>
      format(messages.value.sheetMoved, { name: label, index, count }),
    canceled: (label) => label,
  }),
  // the copy that follows the pointer sits outside the grid: it takes the tab's font along
  ghost: (el) => {
    const copy = el.cloneNode(true) as HTMLElement
    const style = getComputedStyle(el)
    for (const name of ['font-family', 'font-size', 'font-weight', 'line-height', 'color'])
      copy.style.setProperty(name, style.getPropertyValue(name))
    copy.style.backgroundColor = 'var(--dou-color-bg-surface)'
    copy.style.borderColor = 'var(--dou-color-border)'
    return copy
  },
  onSort: ({ item, newIndex }) => {
    sheet.transact((tr) => tr.moveSheet(item, newIndex), { action: 'sheet' })
  },
})

const nameOf = (key: string) => doc.value.sheets.find((s) => sheetKey(s) === key)?.name ?? key
const indexOf = (key: string) => keys.value.indexOf(key)

/**
 * What sortable puts on each tab, but its keys: the tabs keep their own, and
 * the press goes through `onPointerDown`.
 */
function dragAttrs(key: string, index: number) {
  const {
    onKeydown: _keys,
    onPointerdown: _press,
    tabindex: _tabindex,
    'aria-roledescription': _role,
    ...rest
  } = itemAttrs(key, index)
  return rest
}

// Tabs past either side fade out there, so it shows that the strip scrolls

const more = ref({ start: false, end: false })
function measureMore() {
  const el = container.value
  if (!el) return
  const start = el.scrollLeft > 1
  const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  if (start !== more.value.start || end !== more.value.end) more.value = { start, end }
}
let resize: ResizeObserver | undefined
onMounted(() => {
  measureMore()
  if (typeof ResizeObserver === 'undefined' || !container.value) return
  resize = new ResizeObserver(measureMore)
  resize.observe(container.value)
})
onBeforeUnmount(() => resize?.disconnect())
watch(keys, () => void nextTick(measureMore))

// Switching ------------------------------------------------------------------------------

const tabs = useTemplateRef<HTMLElement[]>('tab')
const tabOf = (index: number) =>
  tabs.value?.find((el) => el.dataset.index === String(index)) ?? null

function show(index: number, focusTab = false) {
  if (index < 0 || index >= keys.value.length) return
  if (index !== sheetIndex.value) {
    sheet.showSheet(index)
    sheet.announce(format(messages.value.sheetShown, { name: doc.value.sheets[index]!.name }))
  }
  if (focusTab) void nextTick(() => tabOf(index)?.focus())
}

// the tab shown is kept in view
watch(
  sheetIndex,
  (index) => {
    void nextTick(() => tabOf(index)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
  },
  { flush: 'post' },
)

let lastPointer = 'mouse'
/** When a finger last switched sheets: a tap right after is the same double tap. */
let switchedAt = 0
/** A finger held still on a tab opens its menu; the click that follows is then spent. */
let holdTimer: ReturnType<typeof setTimeout> | undefined
let held = false
const HOLD = 500

function onPointerDown(event: PointerEvent, key: string, index: number) {
  lastPointer = event.pointerType
  held = false
  itemAttrs(key, index).onPointerdown(event)
  if (event.pointerType !== 'touch' || !editable.value) return
  const el = event.currentTarget as HTMLElement
  const x0 = event.clientX
  const y0 = event.clientY
  const stop = () => {
    clearTimeout(holdTimer)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
  }
  const onMove = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) stop()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)
  holdTimer = setTimeout(() => {
    stop()
    if (dragging.value != null || renaming.value != null) return
    held = true
    navigator.vibrate?.(8)
    const rect = el.getBoundingClientRect()
    openMenu(indexOf(key), rect.left + rect.width / 2, rect.top)
  }, HOLD)
}

function onClick(index: number, event: MouseEvent) {
  if (renaming.value != null) return
  if (held) {
    held = false
    return
  }
  if (lastPointer === 'touch' && index === sheetIndex.value) {
    // a finger on the tab already shown opens its menu: phones have no right click
    if (!editable.value || Date.now() - switchedAt < 400) return
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return openMenu(index, rect.left + rect.width / 2, rect.top)
  }
  show(index)
  if (lastPointer === 'touch') switchedAt = Date.now()
  else sheet.focus()
}

/** A double click renames; a finger renames from the menu, as two taps also switch and open it. */
function onDblClick(index: number) {
  if (lastPointer !== 'touch') startRename(index)
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (isComposing(event)) return
  const count = keys.value.length
  const key = event.key
  let to = -1
  if (key === 'ArrowLeft') to = (index - 1 + count) % count
  else if (key === 'ArrowRight') to = (index + 1) % count
  else if (key === 'Home') to = 0
  else if (key === 'End') to = count - 1
  if (to !== -1) {
    event.preventDefault()
    return show(to, true)
  }
  if (key === 'F2' && editable.value) {
    event.preventDefault()
    return startRename(index)
  }
  if (key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) {
    event.preventDefault()
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return openMenu(index, rect.left + rect.width / 2, rect.top)
  }
  // what was just done to the tabs can be taken back from here too
  if (matchesHotkey(event, 'mod+z')) {
    event.preventDefault()
    sheet.undo()
    return keepFocus()
  }
  if (matchesHotkey(event, 'mod+shift+z') || matchesHotkey(event, 'mod+y')) {
    event.preventDefault()
    sheet.redo()
    return keepFocus()
  }
  if (key === 'Enter' || key === 'ArrowUp') {
    // into the grid of the sheet shown
    event.preventDefault()
    show(index)
    sheet.focus()
  }
}

/** Keeps the focus on the tabs, on the tab shown, after the tabs changed under it. */
function keepFocus() {
  void nextTick(() => tabOf(sheetIndex.value)?.focus())
}

// Adding ---------------------------------------------------------------------------------

/** The first free name like `工作表3`. */
function freeName() {
  const taken = new Set(doc.value.sheets.map((s) => s.name))
  let n = doc.value.sheets.length + 1
  while (taken.has(format(messages.value.sheetName, { n }))) n++
  return format(messages.value.sheetName, { n })
}

function addSheet() {
  const name = freeName()
  const at = sheetIndex.value + 1
  const done = sheet.transact((tr) => tr.addSheet({ name }, at), { action: 'sheet' })
  if (!done) return
  show(at)
  sheet.announce(format(messages.value.sheetAdded, { name }))
  sheet.focus()
}

// Renaming -------------------------------------------------------------------------------

/** The index of the tab being renamed, and what is typed. */
const renaming = ref<number | null>(null)
const draft = ref('')
const problem = ref('')
const input = useTemplateRef<HTMLInputElement[]>('input')

function startRename(index: number) {
  if (!structural.value) return
  show(index)
  renaming.value = index
  draft.value = doc.value.sheets[index]!.name
  problem.value = ''
  void nextTick(() => {
    const el = input.value?.[0]
    el?.focus()
    el?.select()
  })
}

function check(name: string, index: number) {
  if (!name) return messages.value.sheetNameEmpty
  const taken = doc.value.sheets.some((s, i) => i !== index && s.name === name)
  return taken ? format(messages.value.sheetNameTaken, { name }) : ''
}

/** Writes the new name; with `keep`, a name that won't do keeps the field open. */
function finishRename(keep: boolean) {
  const index = renaming.value
  if (index == null) return
  const name = draft.value.trim()
  const wrong = check(name, index)
  if (wrong && keep) {
    problem.value = wrong
    sheet.announce(wrong)
    return
  }
  renaming.value = null
  problem.value = ''
  if (!wrong && name !== doc.value.sheets[index]!.name)
    sheet.transact((tr) => tr.renameSheet(index, name), { action: 'sheet' })
  if (keep) void nextTick(() => tabOf(index)?.focus())
}

function cancelRename() {
  const index = renaming.value
  renaming.value = null
  problem.value = ''
  if (index != null) void nextTick(() => tabOf(index)?.focus())
}

function onInputKey(event: KeyboardEvent) {
  if (isComposing(event)) return
  if (event.key === 'Enter') {
    event.preventDefault()
    finishRename(true)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
  }
  // the tab's own keys are for the tabs, not the text
  event.stopPropagation()
}

watch(draft, () => (problem.value = ''))

// The menu -------------------------------------------------------------------------------

const menu = useTemplateRef<InstanceType<typeof SheetMenu>>('menu')
const menuOpen = ref(false)
const menuItems = shallowRef<SheetMenuItem[]>([])

function openMenu(index: number, x: number, y: number) {
  if (!editable.value) return
  show(index)
  const m = messages.value
  const count = keys.value.length
  const name = doc.value.sheets[index]!.name
  menuItems.value = [
    {
      key: 'rename',
      label: m.renameSheet,
      icon: PencilIcon,
      disabled: !structural.value,
      run: () => startRename(index),
    },
    {
      key: 'duplicate',
      label: m.duplicateSheet,
      icon: CopyPlusIcon,
      disabled: !structural.value,
      run: () => {
        const done = sheet.transact((tr) => tr.duplicateSheet(index), { action: 'sheet' })
        if (done) show(index + 1)
      },
    },
    {
      key: 'left',
      label: m.moveSheetLeft,
      icon: ArrowLeftIcon,
      divided: true,
      disabled: !structural.value || index === 0,
      run: () => moveTo(index, index - 1),
    },
    {
      key: 'right',
      label: m.moveSheetRight,
      icon: ArrowRightIcon,
      disabled: !structural.value || index === count - 1,
      run: () => moveTo(index, index + 1),
    },
    {
      key: 'delete',
      label: m.deleteSheet,
      icon: TrashIcon,
      tone: 'danger',
      divided: true,
      disabled: !structural.value || count < 2,
      run: () => {
        const done = sheet.transact((tr) => tr.removeSheet(index), { action: 'sheet' })
        if (done) sheet.announce(format(m.sheetDeleted, { name }))
      },
    },
    ...(['protect.sheet', 'protect.workbook'] as const).map((command, i): SheetMenuItem => {
      const info = sheet.commands.get(command)!
      return {
        key: command,
        label: info.label,
        icon: info.icon,
        divided: i === 0,
        disabled: !sheet.commands.can(command),
        run: () => void sheet.commands.run(command),
      }
    }),
  ]
  menu.value?.open(x, y)
}

function moveTo(index: number, to: number) {
  const name = doc.value.sheets[index]!.name
  const done = sheet.transact((tr) => tr.moveSheet(index, to), { action: 'sheet' })
  if (!done) return
  sheet.announce(
    format(messages.value.sheetMoved, { name, index: to + 1, count: keys.value.length }),
  )
  void nextTick(() => tabOf(to)?.focus())
}

function onMenuSelect(key: unknown) {
  menuItems.value.find((item) => item.key === key)?.run?.()
}

function onContextMenu(event: MouseEvent, index: number) {
  event.preventDefault()
  if (lastPointer === 'touch' || renaming.value != null) return
  openMenu(index, event.clientX, event.clientY)
}
</script>

<template>
  <div class="dou-sheet-tabs">
    <DouButton
      v-if="addable && structural"
      class="dou-sheet-tabs__add"
      variant="ghost"
      size="sm"
      :aria-label="messages.addSheet"
      :title="messages.addSheet"
      @click="addSheet"
    >
      <PlusIcon />
    </DouButton>
    <div
      ref="container"
      class="dou-sheet-tabs__list"
      :class="{ 'has-more-start': more.start, 'has-more-end': more.end }"
      role="tablist"
      :aria-label="messages.sheets"
      v-bind="listAttrs"
      @scroll.passive="measureMore"
    >
      <div
        v-for="(key, index) in list"
        :key="key"
        ref="tab"
        class="dou-sheet-tabs__tab"
        :class="{
          'is-active': indexOf(key) === sheetIndex,
          'is-renaming': renaming === indexOf(key),
        }"
        role="tab"
        :data-index="indexOf(key)"
        :aria-selected="indexOf(key) === sheetIndex"
        :tabindex="indexOf(key) === sheetIndex ? 0 : -1"
        :aria-describedby="hint"
        v-bind="dragAttrs(key, index)"
        @pointerdown="onPointerDown($event, key, index)"
        @click="onClick(indexOf(key), $event)"
        @dblclick="onDblClick(indexOf(key))"
        @keydown="onKeydown($event, indexOf(key))"
        @contextmenu="onContextMenu($event, indexOf(key))"
      >
        <template v-if="renaming === indexOf(key)">
          <!-- the hidden copy sizes the field to its text -->
          <span class="dou-sheet-tabs__size" aria-hidden="true">{{ draft || ' ' }}</span>
          <input
            ref="input"
            v-model="draft"
            class="dou-sheet-tabs__input"
            :aria-label="messages.renameSheet"
            :aria-invalid="problem ? true : undefined"
            :title="problem || undefined"
            maxlength="100"
            spellcheck="false"
            @keydown="onInputKey"
            @blur="finishRename(false)"
            @pointerdown.stop
            @click.stop
            @dblclick.stop
          />
        </template>
        <template v-else>
          <LockIcon v-if="isProtected(key)" class="dou-sheet-tabs__lock" aria-hidden="true" />
          <span class="dou-sheet-tabs__name">{{ nameOf(key) }}</span>
          <span v-if="isProtected(key)" class="dou-sheet__sr-only">
            {{ messages.protect.protectedSheet }}
          </span>
        </template>
      </div>
    </div>
    <span :id="hint" class="dou-sheet__sr-only">{{ messages.sheetTabKeys }}</span>
    <div v-if="problem" class="dou-sheet-tabs__problem" role="alert">{{ problem }}</div>
    <SheetMenu ref="menu" v-model:open="menuOpen" :items="menuItems" @select="onMenuSelect" />
  </div>
</template>
