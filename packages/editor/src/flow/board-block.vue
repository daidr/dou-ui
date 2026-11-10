<script setup lang="ts">
import {
  DouFlowControls,
  DouFlowEditor,
  defineFlowExtension,
  type FlowExtension,
  type FlowHistoryHandler,
  type FlowTransaction,
} from '@dou-ui/flow'
import { EyeIcon, PencilIcon } from '@dou-ui/icons'
import { DouButton, DouDialog } from 'dou-ui'
import { NodeSelection } from 'prosemirror-state'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { findBlockById } from '../core/blocks'
import { historyCommands } from '../core/editor'
import { labelOf } from '../core/extension'
import type { BlockProps } from '../core/model'
import { ownStepKey } from '../core/transaction'
import { useEditor } from '../editor'
import {
  BOARD_HEIGHT,
  BOARD_OPEN_EVENT,
  boardOf,
  clampHeight,
  onlyBoardChanged,
  type BoardBlockSettings,
} from './board'

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
  settings: BoardBlockSettings
}>()

const { view, messages } = useEditor()
const text = computed(() => messages.value.board)
const label = computed(() => labelOf(props.settings.label, messages.value))
const board = computed(() => boardOf(props.block.props.board))
const empty = computed(() => !board.value.nodes.length)

const root = useTemplateRef<HTMLElement>('root')
const canvas = useTemplateRef<HTMLElement>('canvas')
const preview = useTemplateRef<InstanceType<typeof DouFlowEditor>>('preview')

/* the height, followed live while the bar is dragged */
const dragged = shallowRef<number | null>(null)
const height = computed(
  () => dragged.value ?? clampHeight(Number(props.block.props.height) || props.settings.height),
)

/* the preview is drawn once the block comes near the screen */
const seen = shallowRef(typeof IntersectionObserver === 'undefined')
let observer: IntersectionObserver | null = null
let resized: ResizeObserver | null = null
let frame = 0
/** Fits the preview to its box again, once the nodes have been laid out. */
function refit() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => preview.value?.fit())
}
onMounted(() => {
  const element = root.value!
  element.addEventListener(BOARD_OPEN_EVENT, openEditor)
  if (!seen.value) {
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        seen.value = true
        observer?.disconnect()
        observer = null
      },
      { rootMargin: '200px' },
    )
    observer.observe(element)
  }
  if (typeof ResizeObserver !== 'undefined') {
    let width = element.clientWidth
    resized = new ResizeObserver(() => {
      if (element.clientWidth === width) return
      width = element.clientWidth
      refit()
    })
    resized.observe(element)
  }
})
onBeforeUnmount(() => {
  root.value?.removeEventListener(BOARD_OPEN_EVENT, openEditor)
  observer?.disconnect()
  resized?.disconnect()
  cancelAnimationFrame(frame)
})
watch(board, () => void nextTick(refit))
watch(height, () => void nextTick(refit))

/* the fullscreen editor */
const open = shallowRef(false)
function openEditor() {
  if (!props.editable && empty.value) return
  steps.undo = 0
  steps.redo = 0
  lastGroup = undefined
  open.value = true
}

const contentPos = () => {
  const state = view.value?.state
  return state ? (findBlockById(state.doc, props.block.id)?.contentPos ?? null) : null
}

/** The keys go to the canvas from the start: a tool's letter, `Esc` letting go of a selection. */
function onOpened() {
  canvas.value?.querySelector<HTMLElement>('.dou-flow-editor')?.focus({ preventScroll: true })
}

/** Back in the document: the block selected, the editor focused. */
function onClosed() {
  const editor = view.value
  const pos = contentPos()
  if (!editor || pos === null) return
  if (props.editable)
    editor.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)))
  editor.focus()
}

/*
 * Changes on the board go into the document as they are made, so `v-model`,
 * collaboration and the other blocks see them, and into the editor's undo
 * history: undo in the fullscreen editor is the document's, one step per
 * change on the board. A drag's frames are one step, as in the flow editor.
 */
const GROUP_WINDOW = 1000
let lastGroup: string | undefined
let lastTime = 0
/** The steps taken on the board since it was opened, and those undone. */
const steps = { undo: 0, redo: 0 }

function forward(tr: FlowTransaction) {
  const editor = view.value
  const pos = contentPos()
  if (!editor || pos === null || !props.editable) return
  const change = editor.state.tr.setNodeAttribute(pos, 'board', tr.doc)
  if (tr.meta.history === false) change.setMeta('addToHistory', false)
  else {
    const group = tr.meta.group
    const now = Date.now()
    if (group && group === lastGroup && now - lastTime < GROUP_WINDOW)
      // joins the step before, like the next frame of a drag
      change.setMeta('appendedTransaction', editor.state.tr)
    else {
      if (!group) change.setMeta(ownStepKey, true)
      steps.undo++
      steps.redo = 0
    }
    lastGroup = group
    lastTime = now
  }
  editor.dispatch(change)
}

/** Undo or redo in the document; refused when it would change something besides this board. */
function travel(kind: 'undo' | 'redo') {
  const editor = view.value
  if (!editor || !steps[kind]) return false
  const before = editor.state.doc
  const commands = historyCommands(editor.state)
  if (!commands[kind](editor.state, editor.dispatch, editor)) return false
  lastGroup = undefined
  if (!onlyBoardChanged(before, editor.state.doc, props.block.id)) {
    // the board's own steps are used up: put back what was taken
    historyCommands(editor.state)[kind === 'undo' ? 'redo' : 'undo'](
      editor.state,
      editor.dispatch,
      editor,
    )
    steps[kind] = 0
    return false
  }
  steps[kind]--
  steps[kind === 'undo' ? 'redo' : 'undo']++
  return true
}

const history: FlowHistoryHandler = {
  undo: () => travel('undo'),
  redo: () => travel('redo'),
  canUndo: () => steps.undo > 0,
  canRedo: () => steps.redo > 0,
}
const bridge: FlowExtension = defineFlowExtension({
  name: 'editor-board-history',
  history: () => history,
})
const extensions = [...props.settings.extensions, bridge]

/* changing the height: drag the bar under the block, or the arrow keys on it */
function onResizeStart(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const bar = event.currentTarget as HTMLElement
  bar.setPointerCapture(event.pointerId)
  const startY = event.clientY
  const start = height.value
  const move = (e: PointerEvent) => (dragged.value = clampHeight(start + e.clientY - startY))
  const finish = (commit: boolean) => {
    bar.removeEventListener('pointermove', move)
    bar.removeEventListener('pointerup', up)
    bar.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', escape, true)
    const value = dragged.value
    dragged.value = null
    if (commit && value !== null && value !== start) props.updateProps({ height: value })
  }
  const up = () => finish(true)
  const cancel = () => finish(false)
  const escape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    finish(false)
  }
  bar.addEventListener('pointermove', move)
  bar.addEventListener('pointerup', up)
  bar.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', escape, true)
}

function onResizeKey(event: KeyboardEvent) {
  const by = { ArrowUp: -BOARD_HEIGHT.step, ArrowDown: BOARD_HEIGHT.step }[event.key]
  if (by) {
    event.preventDefault()
    props.updateProps({ height: clampHeight(height.value + by) })
  } else if (event.key === 'Escape') {
    event.preventDefault()
    onClosed()
  }
}

function resetHeight() {
  props.updateProps({ height: props.settings.height })
}
</script>

<template>
  <div
    ref="root"
    class="dou-editor-board"
    :class="{ 'is-selected': selected, 'is-empty': empty }"
    :style="{ height: `${height}px` }"
    role="img"
    :aria-label="label"
    @dblclick="openEditor"
  >
    <div v-if="!empty" class="dou-editor-board__preview" inert>
      <DouFlowEditor
        v-if="seen"
        ref="preview"
        :model-value="board"
        v-bind="settings.editorProps"
        :extensions="settings.extensions"
        readonly
        fit-view
        :fit-min-zoom="0.05"
        :simple-zoom="0"
        :min-zoom="0.05"
        :max-zoom="1"
        :bordered="false"
        :searchable="false"
        :commentable="false"
        :pan-on-scroll="false"
        :aria-label="label"
      />
    </div>
    <div v-else class="dou-editor-board__empty">
      <span class="dou-editor-board__empty-text">{{
        editable ? text.empty : text.emptyReadonly
      }}</span>
      <DouButton v-if="editable" size="sm" variant="outline" @click="openEditor">
        <template #leading><PencilIcon /></template>
        {{ text.start }}
      </DouButton>
    </div>

    <div v-if="!empty" class="dou-editor-board__actions">
      <DouButton size="sm" variant="outline" class="dou-editor-board__open" @click="openEditor">
        <template #leading><PencilIcon v-if="editable" /><EyeIcon v-else /></template>
        {{ editable ? text.edit : text.view }}
      </DouButton>
    </div>

    <div
      v-if="editable"
      class="dou-editor-board__resize"
      role="separator"
      aria-orientation="horizontal"
      tabindex="0"
      :aria-label="text.resize"
      :aria-valuemin="BOARD_HEIGHT.min"
      :aria-valuemax="BOARD_HEIGHT.max"
      :aria-valuenow="height"
      data-editor-control
      @pointerdown="onResizeStart"
      @keydown="onResizeKey"
      @dblclick.stop="resetHeight"
    />

    <DouDialog
      v-model:open="open"
      :title="label"
      fullscreen
      destroy-on-close
      @opened="onOpened"
      @closed="onClosed"
    >
      <div ref="canvas" class="dou-editor-board__editor" data-editor-control>
        <DouFlowEditor
          :model-value="board"
          v-bind="settings.editorProps"
          :extensions="extensions"
          :readonly="!editable"
          fit-view
          :commentable="false"
          :aria-label="label"
          @transaction="forward"
        >
          <DouFlowControls />
        </DouFlowEditor>
      </div>
    </DouDialog>
  </div>
</template>
