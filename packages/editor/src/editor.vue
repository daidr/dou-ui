<script setup lang="ts">
import { isApplePlatform, useGlobalConfig, useNamespace } from 'dou-ui'
import { keymap } from 'prosemirror-keymap'
import { Plugin, type EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  nextTick,
  provide,
  ref,
  shallowRef,
  toRaw,
  useTemplateRef,
  watch,
  type Component,
} from 'vue'
import BlockHandle from './components/block-handle.vue'
import BubbleToolbar from './components/bubble-toolbar.vue'
import SearchBar from './components/search-bar.vue'
import SlashMenu from './components/slash-menu.vue'
import { setFallbackHighlighter, type CodeHighlighter } from './core/highlight'
import { createEditorView, getBlocks, replaceBlocks, runCommand, setEditable } from './core/editor'
import type { Block, PartialBlock } from './core/model'
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
import { editorKey, type EditorEmits, type EditorExpose, type EditorProps } from './editor'
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

// find and replace: the panel over the text, the matches marked in it
const searchOpen = ref(false)
const searchReplacing = ref(false)
const searchBar = useTemplateRef<InstanceType<typeof SearchBar>>('searchBar')
/** Blocks that draw their own text, such as a code block in the code editor, are not searched. */
const searchSkip = (node: { type: { name: string } }) => node.type.name in kit.componentViews

/** Opens the panel, with the replace box for `replace`. A selection on one line becomes the search. */
function openSearch(replace = false, given?: Partial<EditorSearchQuery>) {
  const v = view.value
  if (!v) return false
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
    if (!v || !searchKey.getState(v.state)?.query.search) return false
    openSearch()
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

// The blocks last sent through `v-model`: when the same array comes back,
// it is not loaded again (that would move the cursor).
let emitted: Block[] | undefined

function onChange(current: EditorView) {
  const blocks = getBlocks(current)
  emitted = blocks
  emit('update:modelValue', blocks)
  emit('change', blocks)
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
      searchPlugin({ skip: searchSkip }),
    ],
    keymaps: [searchKeys],
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
    onUpdate: (current) => (state.value = current.state),
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
})

function onFocus(event: FocusEvent) {
  focused.value = true
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
})
</script>

<template>
  <div
    ref="root"
    :class="[ns.b(), { 'is-readonly': readonly, 'is-focused': focused, 'is-dragging': dragging }]"
  >
    <div v-if="searchOpen && view" :class="ns.e('search')">
      <SearchBar
        ref="searchBar"
        v-model:replacing="searchReplacing"
        :readonly="readonly"
        :skip="searchSkip"
        @close="closeSearch"
      />
    </div>
    <div ref="mount" :class="ns.e('mount')" />
    <template v-if="!readonly && view">
      <BlockHandle />
      <SlashMenu ref="slashMenu" :slash="slash" />
      <BubbleToolbar ref="bubble" />
      <component :is="overlay" v-for="(overlay, index) in kit.overlays" :key="index" />
    </template>
  </div>
</template>
