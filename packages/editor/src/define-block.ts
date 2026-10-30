import type { NodeSpec } from 'prosemirror-model'
import type { NodeView, NodeViewConstructor } from 'prosemirror-view'
import {
  defineComponent,
  h,
  inject,
  onMounted,
  provide,
  render,
  shallowReactive,
  shallowRef,
  type AppContext,
  type Component,
  type InjectionKey,
  type PropType,
} from 'vue'
import type { BlockOption, EditorExtension, Label } from './core/extension'
import type { BlockProps } from './core/model'

/** What a block's Vue component receives. */
export interface BlockViewProps {
  /** The block's id, type and current props. */
  block: { id: string; type: string; props: BlockProps }
  /** Change props; the change goes into the document, the undo history and collaboration. */
  updateProps: (props: BlockProps) => void
  /** The block is selected as a whole (a block without text was clicked). */
  selected: boolean
  editable: boolean
}

export interface DefineBlockOptions {
  type: string
  /** The props and their defaults. They are stored in the document, as `Block.props`. */
  props?: Record<string, unknown>
  /** `inline` holds formatted text; `none` has no text (an image, an embed). Defaults to `inline`. */
  content?: 'inline' | 'none'
  /** Renders the block. Put `<EditorContent />` where the text goes. */
  component?: Component
  /** `Enter` at the end continues with the same type, like a list. */
  continues?: boolean
  /** Entries for the slash menu and the “turn into” menus; one is made from `menu` when given. */
  menu?: Omit<BlockOption, 'key' | 'type'> & { key?: string }
  /** Override the ProseMirror spec, e.g. `parseDOM` for pasting HTML from elsewhere. */
  spec?: Partial<NodeSpec>
}

const contentKey: InjectionKey<HTMLElement | null> = Symbol('DouEditorContent')

/** Where a block component's text goes. */
export const EditorContent = defineComponent({
  name: 'DouEditorContent',
  props: { as: { type: String as PropType<string>, default: 'div' } },
  setup(props) {
    const content = inject(contentKey, null)
    const host = shallowRef<HTMLElement | null>(null)
    onMounted(() => {
      if (content && host.value) host.value.append(content)
    })
    return () => h(props.as, { ref: host, class: 'dou-editor__text' })
  },
})

/** Store props as `data-prop-*` attributes, so copy and paste keep them. */
const dataAttrs = (props: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(props).map(([name, value]) => [`data-prop-${name}`, JSON.stringify(value)]),
  )

function readDataAttrs(dom: HTMLElement, names: string[]) {
  const attrs: Record<string, unknown> = {}
  for (const name of names) {
    const raw = dom.getAttribute(`data-prop-${name}`)
    if (raw === null) continue
    try {
      attrs[name] = JSON.parse(raw)
    } catch {
      // ignore attributes that are not ours
    }
  }
  return attrs
}

/**
 * A node view that renders a Vue component. Everything the component shows
 * besides the text is outside the editable content, so its buttons and
 * inputs work as usual.
 */
export function vueNodeView(
  component: Component,
  appContext: AppContext | null,
  provides: [InjectionKey<unknown>, unknown][] = [],
): NodeViewConstructor {
  return (node, view, getPos) => {
    // the id lives on the block around the content node
    const idOf = () => {
      const pos = getPos()
      if (pos === undefined) return ''
      return (view.state.doc.resolve(pos).parent.attrs.id as string | null) ?? ''
    }
    const type = node.type.name
    const dom = document.createElement('div')
    dom.className = `dou-editor__content dou-editor__content--${type} dou-editor__content--custom`
    dom.dataset.contentType = type
    const contentElement = node.isTextblock ? document.createElement('div') : null
    const state = shallowReactive<BlockViewProps>({
      block: { id: idOf(), type, props: { ...node.attrs } },
      selected: false,
      editable: view.editable,
      updateProps(props) {
        const pos = getPos()
        if (pos === undefined) return
        const current = view.state.doc.nodeAt(pos)
        if (!current) return
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...props }))
      },
    })
    const Root = defineComponent({
      setup() {
        provide(contentKey, contentElement)
        for (const [key, value] of provides) provide(key, value)
        return () => h(component, { ...state })
      },
    })
    const vnode = h(Root)
    vnode.appContext = appContext
    render(vnode, dom)
    let current = node
    const nodeView: NodeView = {
      dom,
      contentDOM: contentElement,
      update(next) {
        if (next.type !== current.type) return false
        current = next
        state.block = { id: idOf(), type, props: { ...next.attrs } }
        state.editable = view.editable
        return true
      },
      selectNode() {
        state.selected = true
      },
      deselectNode() {
        state.selected = false
      },
      // the component's own controls (and anything marked `data-editor-control`)
      // handle their events; the editor gets the rest, so a click on a block
      // without text still selects it
      stopEvent: (event) => {
        const target = event.target as HTMLElement
        if (contentElement?.contains(target)) return false
        return !!target.closest?.(
          'input, textarea, select, button, a, [contenteditable="true"], [data-editor-control]',
        )
      },
      ignoreMutation: (mutation) => !contentElement || !contentElement.contains(mutation.target),
      destroy() {
        render(null, dom)
      },
    }
    return nodeView
  }
}

/**
 * Declare a block type rendered by a Vue component (or by plain DOM), with
 * its props stored in the document. Returns an extension for `extensions`.
 */
export function defineBlock(options: DefineBlockOptions): EditorExtension {
  const { type } = options
  const props = options.props ?? {}
  const names = Object.keys(props)
  const inline = (options.content ?? 'inline') === 'inline'
  const spec: NodeSpec = {
    attrs: Object.fromEntries(names.map((name) => [name, { default: props[name] }])),
    ...(inline ? { content: 'inline*', defining: true } : { atom: true, selectable: true }),
    continues: options.continues,
    component: options.component,
    parseDOM: [
      {
        tag: `div[data-content-type="${type}"]`,
        getAttrs: (dom) => readDataAttrs(dom as HTMLElement, names),
      },
    ],
    toDOM: (node) => {
      const attrs = {
        class: `dou-editor__content dou-editor__content--${type}`,
        'data-content-type': type,
        ...dataAttrs(node.attrs),
      }
      return inline ? ['div', attrs, 0] : ['div', attrs]
    },
    ...options.spec,
  }
  const menu = options.menu
  return {
    name: `block:${type}`,
    blocks: { [type]: spec },
    blockOptions: menu ? [{ ...menu, key: menu.key ?? type, type }] : [],
  }
}

export type { Label }
