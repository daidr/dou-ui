<script setup lang="ts">
import { isApplePlatform, useGlobalConfig, useNamespace } from 'dou-ui'
import { keymap } from 'prosemirror-keymap'
import { Plugin, type EditorState, type Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  toRaw,
  useTemplateRef,
  watch,
  h,
  useId,
  type Component,
} from 'vue'
import BlockHandle from './components/block-handle.vue'
import BubbleToolbar from './components/bubble-toolbar.vue'
import SearchBar from './components/search-bar.vue'
import CommentButton from './components/comment-button.vue'
import CommentCard from './components/comment-card.vue'
import SlashMenu from './components/slash-menu.vue'
import { setFallbackHighlighter, type CodeHighlighter } from './core/highlight'
import { comparePlugin, compareKey } from './core/compare'
import {
  createEditorView,
  getBlocks,
  historyCommands,
  originKey,
  replaceBlocks,
  restoreBlocks,
  runCommand,
  setEditable,
} from './core/editor'
import { diffBlocks } from './core/changes'
import { isRemote } from './core/plugins'
import { selectionOf, sameSelection } from './core/selection'
import { selectBlocks } from './core/block-selection'
import { applyEditorTransaction, EditorTransaction } from './core/transaction'
import {
  blocksToDoc,
  docToBlocks,
  type Block,
  type EditorDocument,
  type PartialBlock,
} from './core/model'
import { resolveEditorExtensions } from './core/extension'
import {
  previewMatch,
  searchKey,
  searchPlugin,
  setSearch,
  type EditorSearchQuery,
} from './core/search'
import { slashPlugin, type SlashState } from './core/slash'
import { writeHTML } from './core/output'
import { parseHTML } from './core/prepare'
import { componentMounter, vueNodeView } from './define-block'
import { editorKit } from './extensions/editor-kit'
import { readBlocks } from './document'
import {
  editorKey,
  type EditorEmits,
  type EditorExpose,
  type EditorProps,
  type EditorOrigin,
  type EditorLinkOpenEvent,
  type EditorSelection,
  type EditorTransactionResult,
} from './editor'
import { useEditorMessages } from './locale'
import { useEditorComments } from './use-comments'

defineOptions({ name: 'DouEditor' })

const props = withDefaults(defineProps<EditorProps>(), {
  modelValue: undefined,
  extensions: undefined,
  readonly: false,
  searchable: true,
  placeholder: undefined,
  messages: undefined,
  ariaLabel: undefined,
  autofocus: false,
  plugins: undefined,
  history: true,
  undo: undefined,
  redo: undefined,
  selection: undefined,
  comments: undefined,
  author: undefined,
  activeComment: undefined,
  commentable: true,
  compare: undefined,
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
/** Showing what changed since an older version: read-only, without comments. */
const comparing = computed(() => !!props.compare)
/**
 * The older version as whole blocks, matched to the current ones by id. A
 * block saved without an id gets a new one, so it shows as removed.
 */
const compareBlocks = computed(() => {
  const blocks = props.compare?.blocks
  return Array.isArray(blocks) ? docToBlocks(blocksToDoc(kit.schema, blocks)) : null
})
const editable = computed(() => !props.readonly && !comparing.value)

const {
  comments,
  plugin: commentPlugin,
  anchors,
} = useEditorComments({
  props,
  emit,
  view,
  provider: kit.comments,
})

const context = { view, state, focused, dragging, editable, messages, root, kit, comments }
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

// find and replace: the panel over the text, the matches marked in it
const searchOpen = ref(false)
const searchReplacing = ref(false)
const searchBar = useTemplateRef<InstanceType<typeof SearchBar>>('searchBar')
/** Blocks that draw their own text, such as a code block in the code editor, are not searched. */
const searchSkip = (node: { type: { name: string } }) => node.type.name in kit.componentViews

/** Opens the panel, with the replace box for `replace`. A selection on one line becomes the search. */
function openSearch(replace = false, given?: Partial<EditorSearchQuery>) {
  const v = view.value
  if (!v || !props.searchable) return false
  const old = searchKey.getState(v.state)?.query ?? { search: '' }
  const query = { ...old, ...given }
  const { from, to, empty } = v.state.selection
  if (given?.search === undefined && !empty) {
    const text = v.state.doc.textBetween(from, to, '\n')
    if (text && !text.includes('\n')) query.search = text
  }
  if ((replace || given?.replace !== undefined) && editable.value) searchReplacing.value = true
  searchOpen.value = true
  v.dispatch(setSearch(v.state.tr, { query, active: true }))
  const preview = previewMatch(v.state)
  if (preview) v.dispatch(preview)
  void nextTick(() => searchBar.value?.focus(replace && editable.value ? 'replace' : 'find'))
  return true
}

function closeSearch() {
  const v = view.value
  if (!searchOpen.value || !v) return false
  searchOpen.value = false
  v.dispatch(setSearch(v.state.tr, { active: false }))
  v.focus()
  return true
}

/** Goes to the next (or previous) match; with the panel shut, opens it on the last search. */
function findAgain(step: 1 | -1) {
  if (!searchOpen.value) {
    const v = view.value
    if (!v || !searchKey.getState(v.state)?.query.search || !openSearch()) return false
  }
  void nextTick(() => (step > 0 ? searchBar.value?.next() : searchBar.value?.previous()))
  return true
}

const replaceKey = isApplePlatform() ? 'Mod-Alt-f' : 'Mod-h'
const searchKeys = keymap({
  'Mod-f': () => openSearch(),
  [replaceKey]: () => openSearch(true),
  F3: () => findAgain(1),
  'Mod-g': () => findAgain(1),
  'Shift-F3': () => findAgain(-1),
  'Mod-Shift-g': () => findAgain(-1),
  Escape: () => closeSearch(),
})

const slash = shallowRef<SlashState | null>(null)
const slashMenu = useTemplateRef<InstanceType<typeof SlashMenu>>('slashMenu')
const bubble = useTemplateRef<InstanceType<typeof BubbleToolbar>>('bubble')

// The document last sent through `v-model`: when the same object comes back,
// it is not loaded again (that would move the cursor).
let emitted: EditorDocument | undefined

// the result of the last change, for `transact` to hand back
let lastResult: EditorTransactionResult | null = null

function onChange(current: EditorView, tr: Transaction, before: EditorState) {
  const blocks = getBlocks(current)
  const doc: EditorDocument = { version: 1, blocks }
  emitted = doc
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
  emit('update:modelValue', doc)
  emit('change', doc)
}

let selection: EditorSelection = { block: null, blocks: [] }

const warn = (message: string) => {
  if (process.env.NODE_ENV !== 'production') console.warn(`[@dou-ui/editor] ${message}`)
}

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

// a click on a link places the cursor; with Ctrl or ⌘ held, or while read-only, it opens the link
const openLinks = new Plugin({
  props: {
    handleDOMEvents: {
      click(clicked, event) {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a.dou-editor__link')
        if (!link?.href || !(event.metaKey || event.ctrlKey || !clicked.editable)) return false
        event.preventDefault()
        const $pos = clicked.state.doc.resolve(clicked.posAtDOM(link, 0))
        let block = ''
        for (let depth = $pos.depth; depth > 0; depth--)
          if ($pos.node(depth).type.name === 'block') {
            block = $pos.node(depth).attrs.id as string
            break
          }
        const opening: EditorLinkOpenEvent = {
          link: link.getAttribute('href') ?? link.href,
          block,
          defaultPrevented: false,
          preventDefault() {
            this.defaultPrevented = true
          },
        }
        emit('linkOpen', opening)
        if (!opening.defaultPrevented) window.open(link.href, '_blank', 'noopener,noreferrer')
        return true
      },
    },
  },
})

onMounted(() => {
  const instance = createEditorView({
    element: mount.value!,
    kit,
    nodeViews: componentViews,
    // with collaboration the document comes from the shared document
    blocks: kit.externalDocument ? [] : readBlocks(props.modelValue),
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
      keymap({
        'Mod-k': () => bubble.value?.editLink() ?? false,
        'Mod-Alt-m': () => comments.start(),
        // with the thread card open, Escape in the text closes it, and only that
        Escape: () => {
          if (!comments.pending.value && !comments.active.value) return false
          comments.close()
          return true
        },
      }),
      commentPlugin,
      comparePlugin({
        before: () => compareBlocks.value,
        label: () => messages.value.removedBlock,
      }),
      openLinks,
      searchPlugin({ skip: searchSkip }),
    ],
    keymaps: [searchKeys],
    history: props.history,
    undo: props.undo,
    redo: props.redo,
    attributes: () => {
      const attrs: Record<string, string> = {}
      if (props.ariaLabel) attrs['aria-label'] = props.ariaLabel
      if (!editable.value) attrs['aria-readonly'] = 'true'
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
  const given = kit.externalDocument ? undefined : readBlocks(props.modelValue)
  if (given && lacksId(given)) {
    const doc: EditorDocument = { version: 1, blocks: getBlocks(instance) }
    emitted = doc
    emit('update:modelValue', doc)
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
    if (!current || value === undefined || kit.externalDocument || toRaw(value) === emitted) return
    replaceBlocks(current, readBlocks(value) ?? [])
  },
)

watch(editable, (value) => view.value && setEditable(view.value, value))
watch(compareBlocks, () => view.value?.dispatch(view.value.state.tr.setMeta(compareKey, true)))

/** The change last scrolled to, by its place among them. */
let changeIndex = -1
watch(
  () => props.compare,
  () => (changeIndex = -1),
)
function goToChange(step: 1 | -1) {
  const dom = view.value?.dom
  if (!dom || !props.compare) return false
  // a block's own mark, or the first piece of text changed in it
  const marks = [
    ...dom.querySelectorAll<HTMLElement>(
      '.dou-editor__diff-added, .dou-editor__diff-changed, .dou-editor__diff-removed-block, .dou-editor__diff-added-text, .dou-editor__diff-removed',
    ),
  ].filter((el, index, list) => {
    const block = el.closest('[data-block-id]')
    const previous = list[index - 1]
    return !previous || previous.closest('[data-block-id]') !== block || !block
  })
  const next = changeIndex + step
  const target = marks[next]
  if (!target) return false
  changeIndex = next
  target.scrollIntoView({ block: 'center' })
  const m = messages.value
  // a block added or removed, or one whose text or kind changed
  const kind = target.matches('.dou-editor__diff-added')
    ? m.changeAdded
    : target.matches('.dou-editor__diff-removed-block')
      ? m.changeRemoved
      : m.changeChanged
  announce(`${kind} ${changeText(target)}`)
  return true
}

/** The text of a change: what was removed, or its block as it is now. */
function changeText(target: HTMLElement) {
  if (target.matches('.dou-editor__diff-removed-block')) return target.textContent ?? ''
  const block = (target.closest('[data-block-id]') ?? target).cloneNode(true) as HTMLElement
  for (const el of block.querySelectorAll('[data-diff="removed"]')) el.remove()
  return block.textContent ?? ''
}

/** What the live region reads out: a version restored, the change gone to. */
const spoken = ref('')
function announce(text: string) {
  // the same words twice still get read
  spoken.value = ''
  void nextTick(() => (spoken.value = text))
}

function restore(doc: EditorDocument<PartialBlock>) {
  // like the other methods it works while `readonly`, and it is the change comparing allows
  if (!view.value || !restoreBlocks(view.value, readBlocks(doc) ?? [])) return false
  announce(messages.value.restored)
  return true
}

// a selection from outside: the cursor goes to the block, or the blocks are selected
watch(
  () => props.selection,
  (value) => {
    const current = view.value
    if (!current || !value || sameSelection(value, selection)) return
    const known = cursorKnown
    cursorKnown = true
    let applied = false
    if (value.blocks.length > 1) {
      applied = selectBlocks(value.blocks[0]!, value.blocks.at(-1)!)(
        current.state,
        current.dispatch,
      )
      if (!applied) warn('`selection.blocks` must be sibling blocks that exist in the document')
    } else {
      const id = value.block ?? value.blocks[0]
      const transaction = new EditorTransaction(current.state)
      if (id && transaction.focusBlock(id)) {
        current.dispatch(transaction.tr)
        applied = true
      } else if (!id) warn('a selection without blocks cannot be set; the cursor stays where it is')
    }
    if (applied) return
    cursorKnown = known
    // hand back where the selection really is, so the binding doesn't keep a value that never applied
    emit('update:selection', { ...selection, blocks: [...selection.blocks] })
  },
)

function transact(
  fn: (tr: EditorTransaction) => void,
  meta?: EditorTransaction['meta'],
): EditorTransactionResult | null {
  const current = view.value
  // comparing shows a version: nothing changes it but `restore`
  if (!current || props.compare) return null
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
  if (!current || props.compare) return false
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
  openSearch: (query) => openSearch(query?.replace !== undefined, query),
  closeSearch,
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
  comment: () => comments.start(),
  getCommentAnchors: anchors,
  restore,
  nextChange: () => goToChange(1),
  previousChange: () => goToChange(-1),
})

/*
 * Highlights for the threads that are open: by thread id, in one rule,
 * so a thread resolved or opened restyles its text without redrawing it.
 */
const scope = useId()
/** An id as a CSS identifier: no quotes or `<`, which server rendering would escape. */
const ident = (id: string) =>
  id.replace(/[^a-zA-Z0-9_]|^[\d-]/gu, (char) => `\\${char.codePointAt(0)!.toString(16)} `)
const highlighted = (id: string) => `[data-dou-editor=${ident(scope)}] [data-comment=${ident(id)}]`
const highlightCSS = computed(() => {
  if (!comments.enabled.value) return ''
  const open = comments.threads.value.filter((thread) => !thread.resolved)
  if (!open.length) return ''
  let css = `${open.map((thread) => highlighted(thread.id)).join(',')}{background-color:var(--dou-editor-comment-bg);border-bottom-color:var(--dou-editor-comment-line)}`
  const active = comments.active.value
  if (active && open.some((thread) => thread.id === active))
    css += `${highlighted(active)}{background-color:var(--dou-editor-comment-bg-active)}`
  return css
})
const HighlightStyle = () => (highlightCSS.value ? h('style', highlightCSS.value) : null)
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      {
        // comparing keeps the editor's own gutter, so the text doesn't move
        'is-readonly': readonly,
        'is-comparing': comparing,
        'is-focused': focused,
        'is-dragging': dragging,
      },
    ]"
    :data-dou-editor="scope"
  >
    <div v-if="searchOpen && view" :class="ns.e('search')">
      <SearchBar
        ref="searchBar"
        v-model:replacing="searchReplacing"
        :readonly="!editable"
        :skip="searchSkip"
        @close="closeSearch"
      />
    </div>
    <HighlightStyle />
    <div ref="mount" :class="ns.e('mount')" />
    <template v-if="editable && view">
      <BlockHandle />
      <SlashMenu ref="slashMenu" :slash="slash" />
      <BubbleToolbar ref="bubble" />
      <component :is="overlay" v-for="(overlay, index) in kit.overlays" :key="index" />
    </template>
    <div :class="ns.e('live')" aria-live="polite">{{ spoken }}</div>
    <template v-if="view && comments.enabled.value && !comparing">
      <CommentButton v-if="readonly" />
      <CommentCard />
    </template>
  </div>
</template>
