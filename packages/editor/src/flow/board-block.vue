<script setup lang="ts">
import {
  defaultNode,
  defineNodeType,
  DouFlowControls,
  DouFlowEditor,
  defineFlowExtension,
  type NodeTypeSpec,
  type FlowDocument,
  type FlowExtension,
  type FlowHistoryHandler,
  type FlowNode,
  type FlowTransaction,
} from '@dou-ui/flow'
import type { CommentAction, CommentThread } from 'dou-ui'
import { EyeIcon, PencilIcon, PlusIcon, SquareIcon } from '@dou-ui/icons'
import { DouButton, DouCommand, DouDialog, DouPopover, type CommandItem } from 'dou-ui'
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
import { joinStepKey, ownStepKey } from '../core/transaction'
import { useEditor } from '../editor'
import {
  BOARD_HEIGHT,
  BOARD_OPEN_EVENT,
  boardComments,
  boardOf,
  clampHeight,
  onlyBoardChanged,
  type BoardBlockSettings,
} from './board'

/** The board with the groups this reader folded or unfolded. */
function withFolded(board: FlowDocument, folded: Map<string, boolean>): FlowDocument {
  if (!folded.size) return board
  const nodes = board.nodes.map((node) => {
    if (!folded.has(node.id)) return node
    const { collapsed: _, ...data } = node.data ?? {}
    return { ...node, data: folded.get(node.id) ? { ...data, collapsed: true } : data }
  })
  return { ...board, nodes }
}

const props = defineProps<{
  block: { id: string; type: string; props: BlockProps }
  updateProps: (props: BlockProps) => void
  selected: boolean
  editable: boolean
  settings: BoardBlockSettings
}>()

const { view, messages, comments } = useEditor()
const text = computed(() => messages.value.board)
const label = computed(() => labelOf(props.settings.label, messages.value))
const stored = computed(() => boardOf(props.block.props.board))
/*
 * Whether a group is folded is each reader's own view, as with toggles: it
 * stays out of the document (what it holds there is kept), and is shown
 * from here.
 */
const folded = shallowRef(new Map<string, boolean>())
const board = computed(() => withFolded(stored.value, folded.value))
const empty = computed(() => !board.value.nodes.length)

/* the fullscreen editor */
const open = shallowRef(false)
/** The fullscreen editor is in place (its dialog done opening). */
const opened = shallowRef(false)
watch(open, (value) => {
  if (!value) shown.value = board.value
})

/*
 * Comment threads on the nodes and edges: the document's threads, author
 * and open thread, shown by the flow editors. The ids are kept on the nodes
 * and edges (see `boardComments`); a thread opened from outside, e.g. a
 * list of the document's comments, opens the fullscreen editor at it.
 */
const flowComments = computed(() =>
  props.settings.commentable && comments.enabled.value
    ? (comments.threads.value as CommentThread[])
    : undefined,
)
const threadsHere = computed(
  () =>
    new Set(
      props.settings.commentable ? Object.keys(boardComments.anchors(props.block.props)) : [],
    ),
)
const here = (id: string | null): id is string => !!id && threadsHere.value.has(id)
/** The open thread, when it is on this board and the fullscreen editor shows it. */
const boardActive = computed(() =>
  opened.value && here(comments.active.value) ? comments.active.value : null,
)
watch(
  () => comments.active.value,
  (id) => {
    if (here(id) && !open.value) openEditor()
  },
)
/*
 * The preview can't be pressed (it is inert and lets the pointer through to
 * the block), but its comment markers look like buttons: a click or tap on
 * one opens the board at its thread.
 */
const markerCursor = shallowRef(false)
function markerAt(event: MouseEvent): string | null {
  if (!flowComments.value) return null
  const markers = root.value?.querySelectorAll<HTMLElement>(
    '.dou-editor-board__preview [data-thread]',
  )
  for (const marker of markers ?? []) {
    const box = marker.getBoundingClientRect()
    if (
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom
    )
      return marker.dataset.thread ?? null
  }
  return null
}
function onPreviewClick(event: MouseEvent) {
  const id = markerAt(event)
  if (id) comments.open(id)
}
function onPreviewMove(event: PointerEvent) {
  if (event.pointerType === 'mouse') markerCursor.value = !!markerAt(event)
}

function onActive(id: string | null) {
  if (id !== boardActive.value) comments.open(id)
}
function onCommentAction(action: CommentAction) {
  comments.apply(action, { anchored: true })
}
function onClose() {
  settle()
  opened.value = false
  if (here(comments.active.value)) comments.open(null)
}

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
  settle()
  root.value?.removeEventListener(BOARD_OPEN_EVENT, openEditor)
  observer?.disconnect()
  resized?.disconnect()
  cancelAnimationFrame(frame)
})
/* what the preview shows: held while the fullscreen editor covers it, so it isn't redrawn each frame */
const shown = shallowRef(board.value)
watch(board, (value) => {
  if (!open.value) shown.value = value
})
watch(shown, () => void nextTick(refit))
watch(height, () => void nextTick(refit))

function openEditor() {
  if (!props.editable && empty.value) return
  steps.undo = 0
  steps.redo = 0
  pending = null
  open.value = true
}

const contentPos = () => {
  const state = view.value?.state
  return state ? (findBlockById(state.doc, props.block.id)?.contentPos ?? null) : null
}

/** The keys go to the canvas from the start: a tool's letter, `Esc` letting go of a selection. */
function onOpened() {
  opened.value = true
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
 * change on the board. The frames of a drag (or nudges with the arrow keys,
 * or typing in one node) join the step of the first one; only the fields
 * they change are written, so what others change meanwhile stays theirs. A
 * cancelled drag takes its step back.
 */
const GROUP_WINDOW = 1000
/** A drag going on: its group, and when its last frame came. */
let pending: { group: string; time: number } | null = null
/** The steps taken on the board since it was opened, and those undone. */
const steps = { undo: 0, redo: 0 }

/** The board as the document keeps it: groups folded as they are there; and what this reader folded. */
function toDocument(next: FlowDocument): FlowDocument {
  const before = new Map(stored.value.nodes.map((node) => [node.id, node]))
  let changed: Map<string, boolean> | null = null
  const nodes = next.nodes.map((node) => {
    const mine = !!node.data?.collapsed
    const theirs = before.get(node.id)?.data?.collapsed
    if (mine === !!theirs) {
      if (folded.value.has(node.id)) (changed ??= new Map(folded.value)).delete(node.id)
      return node
    }
    if (folded.value.get(node.id) !== mine) (changed ??= new Map(folded.value)).set(node.id, mine)
    const { collapsed: _, ...data } = node.data ?? {}
    if (theirs !== undefined) return { ...node, data: { ...data, collapsed: theirs } }
    // a node with no data before has none after
    if (Object.keys(data).length || before.get(node.id)?.data) return { ...node, data }
    const { data: __, ...rest } = node
    return rest as FlowNode
  })
  if (changed) folded.value = changed
  warnDataImages(next, before)
  return { ...next, nodes }
}

let warned = false
/** Pictures kept in the document as data URLs make it large: say so once, while developing. */
function warnDataImages(next: FlowDocument, before: Map<string, FlowNode>) {
  if (warned || process.env.NODE_ENV === 'production') return
  const added = next.nodes.find(
    (node) =>
      typeof node.data?.src === 'string' &&
      node.data.src.startsWith('data:') &&
      before.get(node.id)?.data?.src !== node.data.src,
  )
  if (!added) return
  warned = true
  console.warn(
    `[@dou-ui/editor] a picture on the "${props.block.type}" block is kept in the document as a data URL; pass \`upload\` to whiteboardBlock() to keep only its address`,
  )
}

const currentBoard = () => {
  const pos = contentPos()
  return pos === null ? null : (view.value?.state.doc.nodeAt(pos)?.attrs.board ?? null)
}

/** Writes the board as one undo step of its own. */
function record(next: unknown) {
  const editor = view.value
  const pos = contentPos()
  if (!editor || pos === null) return
  editor.dispatch(editor.state.tr.setNodeAttribute(pos, 'board', next).setMeta(ownStepKey, true))
  steps.undo++
  steps.redo = 0
}

/** Writes the board into the undo step before, the drag's. */
function join(next: unknown) {
  const editor = view.value
  const pos = contentPos()
  if (!editor || pos === null) return
  const tr = editor.state.tr.setNodeAttribute(pos, 'board', next).setMeta(joinStepKey, true)
  // for the built-in history: part of the step before, however long after
  editor.dispatch(tr.setMeta('appendedTransaction', editor.state.tr))
}

/** Ends the drag going on: the next change is a step of its own. */
function settle() {
  pending = null
}

function forward(tr: FlowTransaction) {
  const editor = view.value
  const pos = contentPos()
  // a thread put on or taken off a node is written in a read-only document too, as on text
  const comment = tr.meta.origin === 'comment'
  if (!editor || pos === null || (!props.editable && !comment)) return
  const group = tr.meta.group
  const next = toDocument(tr.doc)
  // only folded or unfolded: nothing for the document
  if (JSON.stringify(next) === JSON.stringify(currentBoard())) return
  // not a step of the undo history, nor part of a drag going on
  if (comment) {
    editor.dispatch(
      editor.state.tr.setNodeAttribute(pos, 'board', next).setMeta('addToHistory', false),
    )
    return
  }
  const now = Date.now()
  if (pending && (pending.group !== group || now - pending.time >= GROUP_WINDOW)) {
    // a cancelled drag putting the board back: part of its step
    if (tr.meta.history === false) return join(next)
    settle()
  }
  if (tr.meta.history === false) {
    editor.dispatch(
      editor.state.tr.setNodeAttribute(pos, 'board', next).setMeta('addToHistory', false),
    )
    return
  }
  if (!group) return record(next)
  if (pending) {
    pending.time = now
    return join(next)
  }
  pending = { group, time: now }
  record(next)
}

/** Undo or redo in the document; refused when it would change something besides this board. */
function travel(kind: 'undo' | 'redo') {
  settle()
  const editor = view.value
  if (!editor || !steps[kind]) return false
  const before = editor.state.doc
  const commands = historyCommands(editor.state)
  if (!commands[kind](editor.state, editor.dispatch, editor)) return false
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

/** A cancelled drag: the board is back where it started, and its step is taken back. */
function drop(group: string) {
  if (pending?.group !== group) return
  pending = null
  const editor = view.value
  if (!editor || !steps.undo) return
  if (historyCommands(editor.state).undo(editor.state, editor.dispatch, editor)) steps.undo--
}

const history: FlowHistoryHandler = {
  undo: () => travel('undo'),
  redo: () => travel('redo'),
  canUndo: () => steps.undo > 0,
  canRedo: () => steps.redo > 0 && !pending,
  drop,
  close: settle,
}
const bridge: FlowExtension = defineFlowExtension({
  name: 'editor-board-history',
  history: () => history,
})
const extensions = [...props.settings.extensions, bridge]

/*
 * Adding nodes: the types the extensions offer (`palette`), from a button
 * at the top left. When none is offered (`flowKit()` alone), a node of its
 * own with an input and an output, so what is added can be connected right
 * away.
 */
const offered = [
  ...props.settings.extensions.flat(),
  { nodeTypes: props.settings.editorProps.nodeTypes ?? [] },
].some((extension) => extension.nodeTypes?.some((spec) => spec.palette))
const nodeTypes = computed(() => {
  const given = (props.settings.editorProps.nodeTypes ?? []) as NodeTypeSpec[]
  if (offered || !props.settings.fallbackNode) return given
  const name = text.value.node
  const step = defineNodeType({
    ...defaultNode,
    defaults: () => ({ label: name, inputs: [{ id: 'in' }], outputs: [{ id: 'out' }] }),
    palette: { label: name, icon: SquareIcon },
  }) as unknown as NodeTypeSpec
  return [step, ...given]
})
const full = useTemplateRef<InstanceType<typeof DouFlowEditor>>('full')
const palette = computed(() => (props.editable ? (full.value?.paletteTypes ?? []) : []))
/* several types: the same searchable list as when an edge is dropped on the canvas */
const adding = shallowRef(false)
const query = shallowRef('')
const addTrigger = useTemplateRef<InstanceType<typeof DouButton>>('addTrigger')
const command = useTemplateRef<InstanceType<typeof DouCommand>>('command')
const items = computed<CommandItem[]>(() =>
  palette.value.map((spec) => ({
    value: spec.type,
    label: spec.palette!.label,
    group: spec.palette!.group,
    description: spec.palette!.description,
    keywords: spec.palette!.keywords,
    icon: spec.palette!.icon,
  })),
)
watch(adding, (value) => {
  if (!value) return
  query.value = ''
  // a phone's keyboard would cover the list: search only with a mouse
  if (!matchMedia('(pointer: coarse)').matches) void nextTick(() => command.value?.focus())
})

function addNode(type: string) {
  adding.value = false
  full.value?.insertNode(type)
}
function dragNode(type: string, event: PointerEvent) {
  if (event.button !== 0) return
  full.value?.startInsertDrag(type, event)
  // the list goes once the node is dropped, or the drag ends otherwise
  window.addEventListener(
    'pointerup',
    () => {
      if (!adding.value) return
      adding.value = false
      // a drag let go of (or cancelled) off the canvas: back to the button
      void nextTick(() => {
        // the list may not be hidden yet: focus still in its search field
        const active = document.activeElement
        const list = command.value?.$el as HTMLElement | undefined
        if (!active || active === document.body || list?.contains(active))
          (addTrigger.value?.$el as HTMLElement | undefined)?.focus({ preventScroll: true })
      })
    },
    { once: true },
  )
}

/** A label cut into the letters the search matched and the rest. */
function parts(name: string, indices: number[]) {
  const hit = new Set(indices)
  const out: { text: string; match: boolean }[] = []
  for (let i = 0; i < name.length; i++) {
    const match = hit.has(i)
    const last = out[out.length - 1]
    if (last && last.match === match) last.text += name[i]
    else out.push({ text: name[i]!, match })
  }
  return out
}

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
    :style="{ height: `${height}px`, cursor: markerCursor ? 'pointer' : undefined }"
    @dblclick="openEditor"
    @click="onPreviewClick"
    @pointermove="onPreviewMove"
    @pointerleave="markerCursor = false"
  >
    <div v-if="!empty" class="dou-editor-board__preview" role="img" :aria-label="label">
      <DouFlowEditor
        class="dou-editor-board__canvas"
        inert
        v-if="seen"
        ref="preview"
        :model-value="shown"
        v-bind="settings.editorProps"
        :extensions="settings.extensions"
        :node-types="nodeTypes"
        readonly
        fit-view
        :fit-min-zoom="0.05"
        :simple-zoom="0"
        :min-zoom="0.05"
        :max-zoom="1"
        :bordered="false"
        :searchable="false"
        :comments="flowComments"
        :commentable="false"
        :pan-on-scroll="false"
      />
    </div>
    <div v-else class="dou-editor-board__empty">
      <span class="dou-editor-board__empty-text">{{ text.empty }}</span>
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
      @close="onClose"
      @closed="onClosed"
    >
      <div ref="canvas" class="dou-editor-board__editor" data-editor-control>
        <DouFlowEditor
          ref="full"
          :model-value="board"
          v-bind="settings.editorProps"
          :extensions="extensions"
          :node-types="nodeTypes"
          :readonly="!editable"
          fit-view
          :fit-min-zoom="0.1"
          :simple-zoom="0.1"
          :comments="flowComments"
          :author="comments.author.value"
          :commentable="comments.writable.value"
          :active-comment="boardActive"
          :aria-label="label"
          @transaction="forward"
          @update:active-comment="onActive"
          @comment-action="onCommentAction"
        >
          <DouFlowControls />
          <div v-if="palette.length" class="dou-editor-board__add">
            <DouButton
              v-if="palette.length === 1"
              size="sm"
              variant="outline"
              @pointerdown="dragNode(palette[0]!.type, $event)"
              @click="addNode(palette[0]!.type)"
            >
              <template #leading><PlusIcon /></template>
              {{ text.addNode }}
            </DouButton>
            <DouPopover v-else v-model:open="adding" placement="bottom-start">
              <DouButton ref="addTrigger" size="sm" variant="outline">
                <template #leading><PlusIcon /></template>
                {{ text.addNode }}
              </DouButton>
              <template #content>
                <DouCommand
                  ref="command"
                  v-model:query="query"
                  class="dou-editor-board__types"
                  :items="items"
                  :placeholder="text.searchNodes"
                  :aria-label="text.addNode"
                  :empty-text="text.noNodes"
                  :max-height="280"
                  @select="addNode(String($event.value))"
                >
                  <template #item="{ item, indices }">
                    <span
                      class="dou-editor-board__type"
                      @pointerdown="dragNode(String(item.value), $event)"
                    >
                      <span class="dou-editor-board__type-icon">
                        <component :is="item.icon" v-if="item.icon" />
                      </span>
                      <span class="dou-command__label">
                        <template v-for="(part, at) in parts(item.label, indices)" :key="at">
                          <mark v-if="part.match" class="dou-command__match">{{ part.text }}</mark>
                          <template v-else>{{ part.text }}</template>
                        </template>
                      </span>
                      <span v-if="item.description" class="dou-command__description">
                        {{ item.description }}
                      </span>
                    </span>
                  </template>
                </DouCommand>
              </template>
            </DouPopover>
          </div>
          <p v-if="palette.length && !board.nodes.length" class="dou-editor-board__hint">
            {{ text.emptyFlow }}
          </p>
        </DouFlowEditor>
      </div>
    </DouDialog>
  </div>
</template>
