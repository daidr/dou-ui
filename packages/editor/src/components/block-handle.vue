<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  GripVerticalIcon,
  PlusIcon,
  TrashIcon,
} from '@dou-ui/icons'
import { DouDropdown, DouDropdownItem, DouDropdownSub } from 'dou-ui'
import { TextSelection } from 'prosemirror-state'
import { computed, inject, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { isCurrent } from '../catalog'
import { labelOf, type BlockOption } from '../core/extension'
import {
  blockSelectionKey,
  blockSelectionRange,
  getBlockSelection,
  selectBlocks,
} from '../core/block-selection'
import {
  blockAround,
  blocksIn,
  findBlockById,
  siblingRangeBetween,
  type SiblingRange,
} from '../core/blocks'
import {
  duplicateBlocks,
  insertBlockAfter,
  swapBlocks,
  moveRangeTo,
  deleteBlocks,
  setBlockType,
} from '../core/commands'
import { blockFromNode } from '../core/model'
import { slashKey } from '../core/slash'
import { blockElementOf, contentAt, contentSpan, firstLine, scrollParent } from '../dom'
import { editorKey } from '../editor'
import { useMenuEscape } from './menu-escape'

const { view, state, focused, messages, root, dragging, kit } = inject(editorKey)!

/**
 * Touch screens have no hover: there the handle shows only the grip, next
 * to the block with the cursor (or the selected blocks) while the editor
 * has focus. A tap on it opens the menu, a press and drag moves the block.
 */
const touch = shallowRef(false)
let media: MediaQueryList | null = null
const onMedia = () => (touch.value = !!media?.matches)

/** The block the handle is next to, by id. */
const hovered = shallowRef<string | null>(null)
const position = shallowRef<{ top: number; left: number; height: number } | null>(null)
const menuOpen = shallowRef(false)
useMenuEscape(menuOpen, () => (menuOpen.value = false))

const drop = shallowRef<{ pos: number; top: number; left: number; width: number } | null>(null)
// typing hides the handle until the pointer moves again
const resting = shallowRef(false)

const visible = computed(() => {
  if (!position.value) return false
  if (menuOpen.value || dragging.value) return true
  if (touch.value) return focused.value || (!!state.value && !!getBlockSelection(state.value))
  return !resting.value
})

function place(content: HTMLElement) {
  const block = blockElementOf(content)
  const id = block?.dataset.blockId
  const host = root.value
  if (!id || !host) return
  const box = host.getBoundingClientRect()
  const line = firstLine(content)
  hovered.value = id
  position.value = {
    top: line.top - box.top,
    left: contentSpan(content).left - box.left,
    height: line.height,
  }
}

let frame = 0
let lastY = 0
let lastX = 0

function track(event: PointerEvent) {
  // a finger only moves the handle by moving the cursor; a drag reports itself
  if (event.pointerType === 'touch') return
  lastY = event.clientY
  lastX = event.clientX
  resting.value = false
  if (menuOpen.value || frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    if (dragging.value) return updateDrop()
    const current = view.value
    if (!current || menuOpen.value) return
    const content = contentAt(current, lastY)
    if (content) place(content)
  })
}

function leave(event: PointerEvent) {
  if (menuOpen.value || dragging.value || event.pointerType === 'touch') return
  position.value = null
  hovered.value = null
}

/** On touch screens: put the handle next to the block with the cursor. */
function follow() {
  const current = view.value
  if (!current || dragging.value) return
  const selected = blockSelectionRange(current.state)
  const info = selected ? blocksIn(selected)[0] : blockAround(current.state.selection.$from)
  const element = info
    ? (current.nodeDOM(info.pos) as HTMLElement | null)?.querySelector<HTMLElement>(
        ':scope > .dou-editor__content',
      )
    : null
  if (element) place(element)
  else {
    position.value = null
    hovered.value = null
  }
}

let followFrame = 0
function scheduleFollow() {
  if (!touch.value || followFrame) return
  followFrame = requestAnimationFrame(() => {
    followFrame = 0
    if (touch.value && !menuOpen.value) follow()
  })
}

watch([state, focused, touch], scheduleFollow)

onMounted(() => {
  media = window.matchMedia('(pointer: coarse)')
  onMedia()
  media.addEventListener('change', onMedia)
  window.addEventListener('resize', scheduleFollow)
  root.value?.addEventListener('pointermove', track)
  root.value?.addEventListener('pointerleave', leave)
})
onBeforeUnmount(() => {
  media?.removeEventListener('change', onMedia)
  window.removeEventListener('resize', scheduleFollow)
  if (followFrame) cancelAnimationFrame(followFrame)
  root.value?.removeEventListener('pointermove', track)
  root.value?.removeEventListener('pointerleave', leave)
  if (frame) cancelAnimationFrame(frame)
  stopDrag()
})

// follow edits: keep the handle on its block, or hide it while typing
watch(state, (next, previous) => {
  if (touch.value || !next || !previous || next.doc === previous.doc || dragging.value) return
  if (!menuOpen.value) resting.value = true
  requestAnimationFrame(() => {
    const current = view.value
    if (!current || !hovered.value) return
    const element = current.dom.querySelector<HTMLElement>(
      `[data-block-id="${CSS.escape(hovered.value)}"] > .dou-editor__content`,
    )
    if (element) place(element)
    else position.value = null
  })
})

const target = computed(() => {
  const doc = state.value?.doc
  return doc && hovered.value ? findBlockById(doc, hovered.value) : null
})

/** The hovered block, or every selected block when it is one of them. */
function rangeForHovered(): SiblingRange | null {
  const current = view.value
  const info = target.value
  if (!current || !info) return null
  const selected = blockSelectionRange(current.state)
  if (selected && info.pos >= selected.start && info.pos < selected.end) return selected
  return siblingRangeBetween(current.state.doc, info.pos + 1, info.pos + 1)
}

/** Select the blocks the menu or a drag acts on. */
function selectTarget(): SiblingRange | null {
  const current = view.value
  const range = rangeForHovered()
  if (!current || !range) return null
  const blocks = blocksIn(range)
  selectBlocks(blocks[0]!.node.attrs.id, blocks.at(-1)!.node.attrs.id)(
    current.state,
    current.dispatch,
  )
  return blockSelectionRange(current.state)
}

/* the + button */

function add(event: MouseEvent) {
  const current = view.value
  const info = target.value
  if (!current || !info) return
  const empty = info.content.isTextblock && info.content.content.size === 0
  if (!empty || info.content.type.name !== 'paragraph') {
    insertBlockAfter(info.pos)(current.state, current.dispatch)
    // Alt+click adds the block above instead
    if (event.altKey) swapBlocks(-1)(current.state, current.dispatch)
  } else {
    const tr = current.state.tr.setSelection(
      TextSelection.create(current.state.doc, info.contentPos + 1),
    )
    current.dispatch(tr)
  }
  const from = current.state.selection.from
  current.dispatch(current.state.tr.insertText('/').setMeta(slashKey, { from, query: '' }))
  current.focus()
}

/* the block menu */

const turnOptions = kit.blockOptions.filter(
  (option) => !!kit.schema.nodes[option.type]?.isTextblock,
)
const current = computed(() => {
  const info = target.value
  return info ? blockFromNode(info.node) : null
})

function after(action: () => void) {
  action()
  // the menu gives focus back to the handle; the editor takes it after
  requestAnimationFrame(() => view.value?.focus())
}

function keep(run: (current: NonNullable<typeof view.value>) => void) {
  after(() => {
    const instance = view.value
    if (!instance) return
    const selection = getBlockSelection(instance.state)
    run(instance)
    if (selection) selectBlocks(selection.anchor, selection.head)(instance.state, instance.dispatch)
  })
}

const turnInto = (option: BlockOption) =>
  keep((instance) => setBlockType(option.type, option.props)(instance.state, instance.dispatch))
const duplicate = () => keep((instance) => duplicateBlocks(instance.state, instance.dispatch))
const move = (direction: -1 | 1) =>
  keep((instance) => swapBlocks(direction)(instance.state, instance.dispatch))

function remove() {
  after(() => {
    const instance = view.value
    const range = instance && blockSelectionRange(instance.state)
    if (!instance || !range) return
    const tr = deleteBlocks(instance.state.tr, blocksIn(range)).setMeta(blockSelectionKey, null)
    instance.dispatch(tr.scrollIntoView())
    position.value = null
  })
}

const canMove = (direction: -1 | 1) => {
  const instance = view.value
  return !!instance && !!state.value && swapBlocks(direction)(instance.state)
}

/* dragging */

let start: { x: number; y: number; pointer: number; touch: boolean } | null = null
let range: SiblingRange | null = null
let scroller: HTMLElement | null = null
let scrollFrame = 0
/** A copy of the dragged blocks that follows the pointer. */
let ghost: HTMLElement | null = null

function showGhost(moving: SiblingRange) {
  const instance = view.value
  const host = root.value
  if (!instance || !host) return
  ghost = document.createElement('div')
  ghost.className = 'dou-editor__surface dou-editor__ghost'
  ghost.setAttribute('aria-hidden', 'true')
  let width = 0
  for (const block of blocksIn(moving)) {
    const element = instance.nodeDOM(block.pos) as HTMLElement | null
    if (!element) continue
    width = Math.max(width, element.getBoundingClientRect().width)
    const copy = element.cloneNode(true) as HTMLElement
    copy.classList.remove('is-selected')
    for (const node of [copy, ...copy.querySelectorAll('[id], .is-selected')]) {
      node.removeAttribute('id')
      node.classList.remove('is-selected')
    }
    ghost.append(copy)
  }
  ghost.style.width = `${Math.min(width, 360)}px`
  host.append(ghost)
  moveGhost()
}

function moveGhost() {
  if (!ghost) return
  // above a finger, which would hide it; below and right of a mouse pointer
  const y = start?.touch ? lastY - ghost.offsetHeight - 24 : lastY + 12
  ghost.style.transform = `translate(${lastX + 12}px, ${y}px)`
}

function onGripDown(event: PointerEvent) {
  if (event.button !== 0) return
  start = {
    x: event.clientX,
    y: event.clientY,
    pointer: event.pointerId,
    touch: event.pointerType === 'touch',
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onGripMove(event: PointerEvent) {
  if (!start || event.pointerId !== start.pointer) return
  lastX = event.clientX
  lastY = event.clientY
  if (!dragging.value) {
    // a finger wobbles more than a mouse while tapping
    const slop = start.touch ? 8 : 4
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < slop) return
    range = selectTarget()
    if (!range) return stopDrag()
    dragging.value = true
    scroller = root.value && scrollParent(root.value)
    window.addEventListener('keydown', onDragKey, true)
    showGhost(range)
    autoScroll()
  }
  moveGhost()
  updateDrop()
}

function onGripUp(event: PointerEvent) {
  if (!start || event.pointerId !== start.pointer) return
  if (dragging.value) finishDrag()
  else if (menuOpen.value) menuOpen.value = false
  else {
    selectTarget()
    menuOpen.value = true
  }
  start = null
}

function onDragKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  stopDrag()
}

function updateDrop() {
  const instance = view.value
  const host = root.value
  if (!instance || !host || !range) return
  const content = contentAt(instance, lastY)
  const id = content && blockElementOf(content)?.dataset.blockId
  const info = id ? findBlockById(instance.state.doc, id) : null
  if (!content || !info) return (drop.value = null)
  const box = host.getBoundingClientRect()
  const rect = content.getBoundingClientRect()
  const span = contentSpan(content)
  const below = lastY > rect.top + rect.height / 2
  let pos: number
  let y: number
  let left = span.left
  if (!below) {
    pos = info.pos
    y = rect.top
  } else if (info.group) {
    // the lower half of a block with children: in front of its first child
    pos = info.contentPos + info.content.nodeSize + 1
    y = rect.bottom
    const child = blockElementOf(content)?.querySelector<HTMLElement>(
      ':scope > .dou-editor__group > .dou-editor__block > .dou-editor__content',
    )
    left = child ? contentSpan(child).left : span.left
  } else {
    pos = info.pos + info.node.nodeSize
    y = blockElementOf(content)!.getBoundingClientRect().bottom
  }
  if (!moveRangeTo(range, pos)(instance.state)) return (drop.value = null)
  // to the end of the text column, which a reading width can end before the editor
  drop.value = { pos, top: y - box.top, left: left - box.left, width: span.right - left }
}

function autoScroll() {
  scrollFrame = requestAnimationFrame(() => {
    if (!dragging.value) return
    const edge = 48
    const top = scroller ? scroller.getBoundingClientRect().top : 0
    const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight
    let speed = 0
    if (lastY < top + edge) speed = -Math.ceil(((top + edge - lastY) / edge) * 16)
    else if (lastY > bottom - edge) speed = Math.ceil(((lastY - bottom + edge) / edge) * 16)
    if (speed) {
      if (scroller) scroller.scrollTop += speed
      else window.scrollBy(0, speed)
      updateDrop()
    }
    autoScroll()
  })
}

function finishDrag() {
  const instance = view.value
  const spot = drop.value
  const moving = range
  stopDrag()
  if (!instance || !spot || !moving) return
  const ids = blocksIn(moving).map((block) => block.node.attrs.id as string)
  if (!moveRangeTo(moving, spot.pos)(instance.state, instance.dispatch)) return
  selectBlocks(ids[0]!, ids.at(-1)!)(instance.state, instance.dispatch)
  instance.focus()
}

function stopDrag() {
  dragging.value = false
  drop.value = null
  range = null
  start = null
  ghost?.remove()
  ghost = null
  if (scrollFrame) cancelAnimationFrame(scrollFrame)
  scrollFrame = 0
  window.removeEventListener('keydown', onDragKey, true)
}

watch(menuOpen, (value) => {
  if (value) return
  if (touch.value) scheduleFollow()
  else if (!root.value?.matches(':hover')) position.value = null
})
</script>

<template>
  <div
    v-show="visible"
    class="dou-editor__handle"
    :style="
      position
        ? {
            top: `${position.top}px`,
            left: `${position.left}px`,
            '--dou-editor-line': `${position.height}px`,
          }
        : undefined
    "
    @mousedown.prevent
  >
    <button
      type="button"
      tabindex="-1"
      class="dou-editor__handle-button dou-editor__add"
      :aria-label="messages.addBlock"
      :title="messages.addBlock"
      @click="add"
    >
      <PlusIcon />
    </button>
    <DouDropdown
      v-model:open="menuOpen"
      trigger="manual"
      placement="bottom-start"
      class="dou-editor-menu"
    >
      <button
        type="button"
        tabindex="-1"
        class="dou-editor__handle-button dou-editor__grip"
        :aria-label="messages.dragHandle"
        :title="messages.dragHandle"
        @pointerdown="onGripDown"
        @pointermove="onGripMove"
        @pointerup="onGripUp"
        @pointercancel="stopDrag"
      >
        <GripVerticalIcon />
      </button>
      <template #menu>
        <DouDropdownSub :title="messages.turnInto">
          <DouDropdownItem
            v-for="option in turnOptions"
            :key="option.key"
            @click="turnInto(option)"
          >
            <template #prefix><component :is="option.icon" /></template>
            {{ labelOf(option.label, messages) }}
            <template v-if="current && isCurrent(option, current.type, current.props)" #suffix>
              <CheckIcon />
            </template>
          </DouDropdownItem>
        </DouDropdownSub>
        <template v-if="current">
          <component
            :is="entry"
            v-for="(entry, index) in kit.blockMenu"
            :key="index"
            :block="current"
          />
        </template>
        <DouDropdownItem :shortcut="touch ? undefined : 'mod+d'" @click="duplicate">
          <template #prefix><CopyIcon /></template>
          {{ messages.duplicate }}
        </DouDropdownItem>
        <DouDropdownItem
          :disabled="!canMove(-1)"
          :shortcut="touch ? undefined : 'mod+shift+up'"
          @click="move(-1)"
        >
          <template #prefix><ArrowUpIcon /></template>
          {{ messages.moveUp }}
        </DouDropdownItem>
        <DouDropdownItem
          :disabled="!canMove(1)"
          :shortcut="touch ? undefined : 'mod+shift+down'"
          @click="move(1)"
        >
          <template #prefix><ArrowDownIcon /></template>
          {{ messages.moveDown }}
        </DouDropdownItem>
        <DouDropdownItem
          divided
          tone="danger"
          :shortcut="touch ? undefined : 'delete'"
          @click="remove"
        >
          <template #prefix><TrashIcon /></template>
          {{ messages.delete }}
        </DouDropdownItem>
      </template>
    </DouDropdown>
  </div>
  <div
    v-if="drop"
    class="dou-editor__drop"
    :style="{ top: `${drop.top}px`, left: `${drop.left}px`, width: `${drop.width}px` }"
  />
</template>
