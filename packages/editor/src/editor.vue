<script setup lang="ts">
import { useGlobalConfig, useNamespace } from 'dou-ui'
import { keymap } from 'prosemirror-keymap'
import { Plugin, type EditorState } from 'prosemirror-state'
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
  h,
  useId,
  type Component,
} from 'vue'
import BlockHandle from './components/block-handle.vue'
import BubbleToolbar from './components/bubble-toolbar.vue'
import CommentButton from './components/comment-button.vue'
import CommentCard from './components/comment-card.vue'
import SlashMenu from './components/slash-menu.vue'
import { setFallbackHighlighter, type CodeHighlighter } from './core/highlight'
import { createEditorView, getBlocks, replaceBlocks, runCommand, setEditable } from './core/editor'
import type { Block, PartialBlock } from './core/model'
import { resolveEditorExtensions } from './core/extension'
import { slashPlugin, type SlashState } from './core/slash'
import { writeHTML } from './core/output'
import { parseHTML } from './core/prepare'
import { componentMounter, vueNodeView } from './define-block'
import { editorKit } from './extensions/editor-kit'
import { editorKey, type EditorEmits, type EditorExpose, type EditorProps } from './editor'
import { useEditorMessages } from './locale'
import { useEditorComments } from './use-comments'

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
  comments: undefined,
  author: undefined,
  activeComment: undefined,
  commentable: true,
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
  comment: () => comments.start(),
  getCommentAnchors: anchors,
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
    :class="[ns.b(), { 'is-readonly': readonly, 'is-focused': focused, 'is-dragging': dragging }]"
    :data-dou-editor="scope"
  >
    <HighlightStyle />
    <div ref="mount" :class="ns.e('mount')" />
    <template v-if="!readonly && view">
      <BlockHandle />
      <SlashMenu ref="slashMenu" :slash="slash" />
      <BubbleToolbar ref="bubble" />
      <component :is="overlay" v-for="(overlay, index) in kit.overlays" :key="index" />
    </template>
    <template v-if="view && comments.enabled.value">
      <CommentButton v-if="readonly" />
      <CommentCard />
    </template>
  </div>
</template>
