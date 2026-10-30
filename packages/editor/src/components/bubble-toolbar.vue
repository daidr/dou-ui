<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, LinkIcon, UnlinkIcon } from '@dou-ui/icons'
import {
  DouButton,
  DouDropdown,
  DouDropdownItem,
  DouInput,
  DouKbd,
  DouToggle,
  DouToggleGroup,
  DouToolbar,
  DouToolbarSeparator,
  DouTooltip,
  useFloating,
  useZIndex,
  type ToggleValue,
  type VirtualElement,
} from 'dou-ui'
import { toggleMark } from 'prosemirror-commands'
import { TextSelection } from 'prosemirror-state'
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { isCurrent } from '../catalog'
import { labelOf, type BlockOption } from '../core/extension'
import { getBlockSelection } from '../core/block-selection'
import { blockAround } from '../core/blocks'
import { setBlockType } from '../core/commands'
import { blockFromNode } from '../core/model'
import { isSafeHref } from '../core/schema'
import { editorKey } from '../editor'

const { view, state, focused, dragging, messages, kit } = inject(editorKey)!
const panel = useTemplateRef<HTMLElement>('panel')

// while the pointer is down the selection is still being made
const pressing = shallowRef(false)
const menuOpen = shallowRef(false)
const linking = shallowRef<{ from: number; to: number } | null>(null)
const href = shallowRef('')
const linkInput = useTemplateRef<InstanceType<typeof DouInput>>('linkInput')

const formattable = computed(() => {
  const current = state.value
  if (!current || getBlockSelection(current)) return false
  const { selection } = current
  if (!(selection instanceof TextSelection) || selection.empty) return false
  // nothing to format in code, or across a divider only
  let text = false
  current.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (node.isTextblock && !node.type.spec.code) text = true
    return !text
  })
  return text
})

const open = computed(
  () =>
    !!linking.value ||
    menuOpen.value ||
    (focused.value && formattable.value && !pressing.value && !dragging.value),
)

const anchor: VirtualElement = {
  getBoundingClientRect() {
    const current = view.value
    const range = linking.value ?? current?.state.selection
    if (!current || !range) return new DOMRect()
    const start = current.coordsAtPos(range.from, 1)
    const end = current.coordsAtPos(range.to, -1)
    // a selection over several lines: centre on the first one
    const sameLine = Math.abs(start.top - end.top) < 4
    const left = sameLine ? start.left : start.left
    const right = sameLine
      ? end.right
      : Math.max(start.left + 1, current.dom.getBoundingClientRect().right)
    return new DOMRect(left, start.top, Math.max(1, right - left), start.bottom - start.top)
  },
}
const { style, placement, update } = useFloating(() => (open.value ? anchor : null), panel, {
  open,
  placement: 'top',
  offset: 8,
})
// stacked like DouUI's own popups, above whatever opened before
const { next } = useZIndex()
const zIndex = shallowRef(0)
watch(open, (value) => value && (zIndex.value = next()), { immediate: true })
watch(state, () => open.value && void nextTick(update))

function onPointerDown(event: PointerEvent) {
  if (event.button === 0 && view.value?.dom.contains(event.target as Node)) pressing.value = true
}
function onPointerUp() {
  if (pressing.value) pressing.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointerup', onPointerUp, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('pointerup', onPointerUp, true)
})

/* marks */

const schema = kit.schema
const marks = kit.formats.filter((format) => schema.marks[format.mark])

const active = computed<ToggleValue[]>(() => {
  const current = state.value
  if (!current) return []
  const { from, to } = current.selection
  return marks
    .filter((mark) => current.doc.rangeHasMark(from, to, schema.marks[mark.mark]!))
    .map((mark) => mark.mark)
})

function onMarks(value: ToggleValue | ToggleValue[] | null) {
  const pressed = Array.isArray(value) ? value : []
  const changed = marks.find(
    (mark) => pressed.includes(mark.mark) !== active.value.includes(mark.mark),
  )
  const current = view.value
  if (!changed || !current) return
  toggleMark(schema.marks[changed.mark]!)(current.state, current.dispatch)
}

/* turning the block into another type */

const turnOptions = kit.blockOptions.filter(
  (option) => !!kit.schema.nodes[option.type]?.isTextblock,
)
const currentBlock = computed(() => {
  const current = state.value
  const info = current && blockAround(current.selection.$from)
  return info ? blockFromNode(info.node) : null
})
// text inside a table cell keeps its cell; only whole blocks change type
const turnable = computed(() => {
  const $from = state.value?.selection.$from
  return !!$from && $from.depth > 0 && $from.node($from.depth - 1).type.name === 'block'
})
const currentOption = computed(() => {
  const block = currentBlock.value
  return block
    ? turnOptions.find((option) => isCurrent(option, block.type, block.props))
    : undefined
})

function turnInto(option: BlockOption) {
  const current = view.value
  if (!current) return
  setBlockType(option.type, option.props)(current.state, current.dispatch)
  requestAnimationFrame(() => current.focus())
}

/* links */

const linkMark = schema.marks.link
const currentHref = computed(() => {
  const current = state.value
  if (!current) return ''
  const { from, to } = current.selection
  let found = ''
  current.doc.nodesBetween(from, to, (node) => {
    const mark = linkMark?.isInSet(node.marks)
    if (mark) found ||= mark.attrs.href as string
  })
  return found
})

/** `Mod+K` and the link button: edit the link of the selected text. */
function editLink(): boolean {
  const current = view.value
  if (!current || !linkMark || !formattable.value) return false
  const { from, to } = current.state.selection
  linking.value = { from, to }
  href.value = currentHref.value
  void nextTick(() => linkInput.value?.focus())
  return true
}

/** `example.com` becomes `https://example.com`; other relative links stay. */
function normalise(value: string): string {
  const text = value.trim()
  if (/^[\w-]+(\.[\w-]+)+(?:[/?#:]|$)/.test(text) && !text.includes(' ')) return `https://${text}`
  return text
}

function applyLink() {
  const current = view.value
  const range = linking.value
  if (!current || !range || !linkMark) return
  const value = normalise(href.value)
  const tr = current.state.tr.removeMark(range.from, range.to, linkMark)
  if (value && isSafeHref(value)) tr.addMark(range.from, range.to, linkMark.create({ href: value }))
  current.dispatch(tr)
  closeLink()
}

function removeLink() {
  href.value = ''
  applyLink()
}

function closeLink() {
  const current = view.value
  const range = linking.value
  linking.value = null
  if (!current) return
  if (range)
    current.dispatch(
      current.state.tr.setSelection(TextSelection.create(current.state.doc, range.from, range.to)),
    )
  current.focus()
}

function onLinkKey(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    applyLink()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeLink()
  }
}

function onLinkBlur(event: FocusEvent) {
  // leaving for anywhere but the toolbar ends editing without saving
  if (!panel.value?.contains(event.relatedTarget as Node)) linking.value = null
}

defineExpose({ editLink })
</script>

<template>
  <Transition name="dou-floating">
    <div
      v-if="open"
      ref="panel"
      class="dou-floating dou-editor-bubble"
      :style="[style, { zIndex }]"
      :data-placement="placement"
      @mousedown="!linking && $event.preventDefault()"
    >
      <div v-if="linking" class="dou-editor-bubble__link">
        <DouInput
          ref="linkInput"
          v-model="href"
          size="sm"
          :placeholder="messages.linkPlaceholder"
          :aria-label="messages.link"
          @keydown="onLinkKey"
          @blur="onLinkBlur"
        >
          <template #prefix><LinkIcon /></template>
        </DouInput>
        <DouButton
          size="sm"
          variant="ghost"
          :aria-label="messages.applyLink"
          @mousedown.prevent
          @click="applyLink"
        >
          <CheckIcon />
        </DouButton>
        <DouButton
          v-if="currentHref"
          size="sm"
          variant="ghost"
          :aria-label="messages.removeLink"
          @mousedown.prevent
          @click="removeLink"
        >
          <UnlinkIcon />
        </DouButton>
      </div>
      <DouToolbar v-else size="sm" :aria-label="messages.formatting">
        <DouDropdown
          v-if="turnable"
          v-model:open="menuOpen"
          placement="bottom-start"
          class="dou-editor-menu"
        >
          <DouButton size="sm" variant="ghost" class="dou-editor-bubble__type">
            {{ currentOption ? labelOf(currentOption.label, messages) : messages.turnInto }}
            <template #trailing><ChevronDownIcon /></template>
          </DouButton>
          <template #menu>
            <DouDropdownItem
              v-for="option in turnOptions"
              :key="option.key"
              @click="turnInto(option)"
            >
              <template #prefix><component :is="option.icon" /></template>
              {{ labelOf(option.label, messages) }}
              <template v-if="option === currentOption" #suffix><CheckIcon /></template>
            </DouDropdownItem>
          </template>
        </DouDropdown>
        <DouToolbarSeparator v-if="turnable && marks.length" />
        <DouToggleGroup
          v-if="marks.length"
          type="multiple"
          :model-value="active"
          :aria-label="messages.formatting"
          @update:model-value="onMarks"
        >
          <DouTooltip v-for="mark in marks" :key="mark.mark" placement="bottom">
            <DouToggle :value="mark.mark" :aria-label="labelOf(mark.label, messages)">
              <component :is="mark.icon" />
            </DouToggle>
            <template #content>
              <span class="dou-editor-bubble__tip"
                >{{ labelOf(mark.label, messages) }}
                <DouKbd v-if="mark.hotkey" size="sm" :keys="mark.hotkey"
              /></span>
            </template>
          </DouTooltip>
        </DouToggleGroup>
        <DouToolbarSeparator v-if="linkMark" />
        <DouTooltip v-if="linkMark" placement="bottom">
          <DouToggle
            :pressed="!!currentHref"
            :aria-label="messages.link"
            @update:pressed="editLink"
          >
            <LinkIcon />
          </DouToggle>
          <template #content>
            <span class="dou-editor-bubble__tip"
              >{{ messages.link }} <DouKbd size="sm" keys="mod+k"
            /></span>
          </template>
        </DouTooltip>
      </DouToolbar>
    </div>
  </Transition>
</template>
