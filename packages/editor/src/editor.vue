<script setup lang="ts">
import { useGlobalConfig, useNamespace } from 'dou-ui'
import { keymap } from 'prosemirror-keymap'
import { Plugin, type EditorState, type Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  toRaw,
  useTemplateRef,
  watch,
  type Component,
} from 'vue'
import BlockHandle from './components/block-handle.vue'
import BubbleToolbar from './components/bubble-toolbar.vue'
import SlashMenu from './components/slash-menu.vue'
import { setFallbackHighlighter, type CodeHighlighter } from './core/highlight'
import {
  createEditorView,
  getBlocks,
  historyCommands,
  originKey,
  replaceBlocks,
  runCommand,
  setEditable,
} from './core/editor'
import { diffBlocks } from './core/changes'
import { isRemote } from './core/plugins'
import { selectionOf, sameSelection } from './core/selection'
import { selectBlocks } from './core/block-selection'
import { applyEditorTransaction, EditorTransaction } from './core/transaction'
import type { Block, PartialBlock } from './core/model'
import { resolveEditorExtensions } from './core/extension'
import { slashPlugin, type SlashState } from './core/slash'
import { writeHTML } from './core/output'
import { parseHTML } from './core/prepare'
import { componentMounter, vueNodeView } from './define-block'
import { editorKit } from './extensions/editor-kit'
import {
  editorKey,
  type EditorEmits,
  type EditorExpose,
  type EditorProps,
  type EditorOrigin,
  type EditorSelection,
  type EditorTransactionResult,
} from './editor'
import { useEditorMessages } from './locale'

defineOptions({ name: 'DouEditor' })

const props = withDefaults(defineProps<EditorProps>(), {
  modelValue: undefined,
  extensions: undefined,
  readonly: false,
  placeholder: undefined,
  messages: undefined,
  ariaLabel: undefined,
  autofocus: false,
  plugins: undefined,
  history: true,
  undo: undefined,
  redo: undefined,
  selection: undefined,
})
const emit = defineEmits<EditorEmits>()

// read once: changing the schema of a live editor would invalidate its document
const kit = resolveEditorExtensions(props.extensions ?? [editorKit()])
// say so once, instead of silently keeping the old extensions
const stopWatchingExtensions = watch(
  () => props.extensions,
  () => {
    console.warn(
      '[@dou-ui/editor] `extensions` changed after mount and is ignored: it is read once. Create the list once outside the template, or give the editor a new `key` to rebuild it.',
    )
    stopWatchingExtensions()
  },
)

const ns = useNamespace('editor')
const messages = useEditorMessages(() => props.messages)
const config = useGlobalConfig()
const root = useTemplateRef<HTMLElement>('root')
const mount = useTemplateRef<HTMLElement>('mount')
const view = shallowRef<EditorView | null>(null)
const state = shallowRef<EditorState | null>(null)
const focused = shallowRef(false)
const dragging = shallowRef(false)
const editable = computed(() => !props.readonly)

const context = { view, state, focused, dragging, editable, messages, root, kit }
provide(editorKey, context)

// block components render outside this component's tree: hand them the context
const appContext = getCurrentInstance()?.appContext ?? null
const mountComponent = componentMounter(appContext, [[editorKey, context]])
const componentViews = {
  ...Object.fromEntries(
    Object.entries(kit.schema.nodes)
      .filter(([, type]) => type.spec.component)
      .map(([name, type]) => [
        name,
        vueNodeView(type.spec.component as Component, appContext, [[editorKey, context]]),
      ]),
  ),
  ...Object.fromEntries(
    Object.entries(kit.componentViews).map(([name, create]) => [name, create(mountComponent)]),
  ),
}

const slash = shallowRef<SlashState | null>(null)
const slashMenu = useTemplateRef<InstanceType<typeof SlashMenu>>('slashMenu')
const bubble = useTemplateRef<InstanceType<typeof BubbleToolbar>>('bubble')

// The blocks last sent through `v-model`: when the same array comes back,
// it is not loaded again (that would move the cursor).
let emitted: Block[] | undefined

// the result of the last change, for `transact` to hand back
let lastResult: EditorTransactionResult | null = null

function onChange(current: EditorView, tr: Transaction, before: EditorState) {
  const blocks = getBlocks(current)
  emitted = blocks
  const history = tr.getMeta('history$') as { redo: boolean } | undefined
  const origin =
    (tr.getMeta(originKey) as EditorOrigin | undefined) ??
    (history ? (history.redo ? 'redo' : 'undo') : isRemote(tr) ? 'remote' : undefined)
  const meta: EditorTransactionResult['meta'] = {
    history:
      tr.getMeta('addToHistory') !== false &&
      origin !== 'remote' &&
      origin !== 'undo' &&
      origin !== 'redo',
  }
  if (origin !== undefined) meta.origin = origin
  lastResult = { blocks, changes: diffBlocks(before.doc, current.state.doc), meta }
  emit('transaction', lastResult)
  emit('update:modelValue', blocks)
  emit('change', blocks)
}

let selection: EditorSelection = { block: null, blocks: [] }

const lacksId = (blocks: PartialBlock[]): boolean =>
  blocks.some((block) => !block.id || lacksId(block.children ?? []))
// until the editor is focused (or a block is, by the program) its selection is no cursor
let cursorKnown = false

function onUpdate(current: EditorView) {
  state.value = current.state
  if (!cursorKnown) {
    if (!focused.value) return
    cursorKnown = true
  }
  const next = selectionOf(current.state)
  if (sameSelection(next, selection)) return
  selection = next
  emit('update:selection', next)
}

// a click on a link places the cursor; with Ctrl or ⌘ held it opens the link
const openLinks = new Plugin({
  props: {
    handleClick(_view, _pos, event) {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a.dou-editor__link')
      if (!link?.href || !(event.metaKey || event.ctrlKey)) return false
      window.open(link.href, '_blank', 'noopener')
      return true
    },
  },
})

onMounted(() => {
  const instance = createEditorView({
    element: mount.value!,
    kit,
    nodeViews: componentViews,
    // with collaboration the document comes from the shared document
    blocks: kit.externalDocument ? [] : props.modelValue,
    editable: editable.value,
    placeholder: {
      text: () => props.placeholder ?? messages.value.placeholder,
      heading: () => messages.value.headingPlaceholder,
      empty: () => props.placeholder ?? messages.value.emptyPlaceholder,
    },
    plugins: [
      ...(props.plugins ?? []),
      slashPlugin({
        onChange: (value) => (slash.value = value),
        onKey: (event) => slashMenu.value?.onKey(event) ?? false,
      }),
      keymap({ 'Mod-k': () => bubble.value?.editLink() ?? false }),
      openLinks,
    ],
    history: props.history,
    undo: props.undo,
    redo: props.redo,
    attributes: () => {
      const attrs: Record<string, string> = {}
      if (props.ariaLabel) attrs['aria-label'] = props.ariaLabel
      if (props.readonly) attrs['aria-readonly'] = 'true'
      return attrs
    },
    onChange,
    onUpdate,
  })
  view.value = instance
  state.value = instance.state
  // code blocks without their own highlighter use the one DouCodeBlock uses
  watch(
    () =>
      (config.value.defaults as { DouCodeBlock?: { highlight?: CodeHighlighter } }).DouCodeBlock
        ?.highlight ?? null,
    (highlight) => setFallbackHighlighter(instance, highlight),
    { immediate: true },
  )
  instance.dom.addEventListener('focus', onFocus)
  instance.dom.addEventListener('blur', onBlur)
  if (props.autofocus) instance.focus()
  // blocks given without ids got them now: hand those back, so events' ids can be looked up
  if (!kit.externalDocument && props.modelValue && lacksId(props.modelValue)) {
    const blocks = getBlocks(instance)
    emitted = blocks
    emit('update:modelValue', blocks)
  }
})

function onFocus(event: FocusEvent) {
  focused.value = true
  if (!cursorKnown && view.value) {
    cursorKnown = true
    const next = selectionOf(view.value.state)
    if (!sameSelection(next, selection)) {
      selection = next
      emit('update:selection', next)
    }
  }
  emit('focus', event)
}

function onBlur(event: FocusEvent) {
  focused.value = false
  emit('blur', event)
}

onBeforeUnmount(() => {
  view.value?.destroy()
  view.value = null
})

watch(
  () => props.modelValue,
  (value) => {
    const current = view.value
    if (!current || !value || kit.externalDocument || toRaw(value) === emitted) return
    replaceBlocks(current, value)
  },
)

watch(editable, (value) => view.value && setEditable(view.value, value))

// a selection from outside: the cursor goes to the block, or the blocks are selected
watch(
  () => props.selection,
  (value) => {
    const current = view.value
    if (!current || !value || sameSelection(value, selection)) return
    cursorKnown = true
    if (value.blocks.length > 1) {
      selectBlocks(value.blocks[0]!, value.blocks.at(-1)!)(current.state, current.dispatch)
      return
    }
    const id = value.block ?? value.blocks[0]
    if (!id) return
    const transaction = new EditorTransaction(current.state)
    if (transaction.focusBlock(id)) current.dispatch(transaction.tr)
  },
)

function transact(
  fn: (tr: EditorTransaction) => void,
  meta?: EditorTransaction['meta'],
): EditorTransactionResult | null {
  const current = view.value
  if (!current) return null
  const transaction = new EditorTransaction(current.state, meta, cursorKnown)
  fn(transaction)
  lastResult = null
  // `focusBlock` places the cursor
  if (transaction.focused) cursorKnown = true
  applyEditorTransaction(current, transaction)
  if (transaction.focused) current.focus()
  const result = lastResult
  lastResult = null
  return result
}

const history = (action: 'undo' | 'redo', dispatch: boolean) => {
  const current = view.value
  if (!current) return false
  const command = historyCommands(current.state)[action]
  return dispatch ? runCommand(current, command) : command(current.state)
}

defineExpose<EditorExpose>({
  get view() {
    return view.value
  },
  focus: () => view.value?.focus(),
  blur: () => (view.value?.dom as HTMLElement | undefined)?.blur(),
  getBlocks: () => (view.value ? getBlocks(view.value) : []),
  setBlocks: (blocks: PartialBlock[]) => view.value && replaceBlocks(view.value, blocks),
  getHTML: () => (view.value ? writeHTML(getBlocks(view.value), kit) : ''),
  setHTML: (html: string) => view.value && replaceBlocks(view.value, parseHTML(html, kit)),
  run: (command) => (view.value ? runCommand(view.value, command) : false),
  transact,
  getBlock: (id) => (view.value ? new EditorTransaction(view.value.state).getBlock(id) : null),
  insertBlocks: (blocks, placement) => {
    let ids: string[] = []
    transact((tr) => (ids = tr.insertBlocks(blocks, placement)))
    return ids
  },
  updateBlock: (id, patch) => {
    let ok = false
    transact((tr) => (ok = tr.updateBlock(id, patch)))
    return ok
  },
  removeBlocks: (ids) => {
    let ok = false
    transact((tr) => (ok = tr.removeBlocks(ids)))
    return ok
  },
  moveBlocks: (ids, placement) => {
    let ok = false
    transact((tr) => (ok = tr.moveBlocks(ids, placement)))
    return ok
  },
  focusBlock: (id, edge) => {
    let ok = false
    transact((tr) => (ok = tr.focusBlock(id, edge)))
    return ok
  },
  getSelection: () => ({ ...selection, blocks: [...selection.blocks] }),
  undo: () => history('undo', true),
  redo: () => history('redo', true),
  get canUndo() {
    return !!state.value && history('undo', false)
  },
  get canRedo() {
    return !!state.value && history('redo', false)
  },
})
</script>

<template>
  <div
    ref="root"
    :class="[ns.b(), { 'is-readonly': readonly, 'is-focused': focused, 'is-dragging': dragging }]"
  >
    <div ref="mount" :class="ns.e('mount')" />
    <template v-if="!readonly && view">
      <BlockHandle />
      <SlashMenu ref="slashMenu" :slash="slash" />
      <BubbleToolbar ref="bubble" />
      <component :is="overlay" v-for="(overlay, index) in kit.overlays" :key="index" />
    </template>
  </div>
</template>
