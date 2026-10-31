import {
  computed,
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  reactive,
  shallowRef,
  watch,
} from 'vue'
import type { InjectionKey, PropType, VNode } from 'vue'
import { DouButton, DouForm } from 'dou-ui'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  CornerLeftUpIcon,
  PlusIcon,
  TrashIcon,
} from '@dou-ui/icons'
import { getPath, isContainer, isList, isPage, setPath } from '../core/document'
import type {
  FormContainerNode,
  FormFieldNode,
  FormListNode,
  FormNode,
  FormPageNode,
  FormSectionNode,
} from '../core/types'
import { startValue } from '../core/values'
import type { FormFieldType } from '../fields/define'
import { formatMessage, useFormBuilderMessages } from '../locale'
import type { FormBuilderMessages } from '../locale'
import { rendererKey, rootScope, scopeKey } from '../renderer/context'
import type { NodeScope, RendererContext } from '../renderer/context'
import { FormNodeView, nodeKey, spanStyle } from '../renderer/node-view'
import { canvasOrder, useBuilderState } from './context'
import type { BuilderState, BuilderView } from './context'
import { placesOf } from './core/transaction'
import { iconOf, labelOf, nodeTitle } from './settings'

/**
 * A field as the canvas draws it: always shown, enabled and editable in
 * look, with no options to load. Kept per node, so an untouched field is
 * not drawn again.
 */
const designed = new WeakMap<FormFieldNode, FormFieldNode>()
function designNode(node: FormFieldNode): FormFieldNode {
  if (
    !node.visibleWhen &&
    !node.disabledWhen &&
    !node.formula &&
    !node.source &&
    !node.requiredWhen
  )
    return node
  let result = designed.get(node)
  if (!result) {
    const rest: FormFieldNode = { ...node }
    for (const key of ['visibleWhen', 'disabledWhen', 'formula', 'source', 'requiredWhen'] as const)
      delete rest[key]
    result = node.requiredWhen ? { ...rest, required: true } : rest
    designed.set(node, result)
  }
  return result
}

/**
 * The values the canvas shows: each field's default, and one item in
 * every list. Only fields whose node changed are written again.
 */
function useScratch(state: BuilderState) {
  const model = reactive<Record<string, unknown>>({})
  const written = new WeakMap<FormNode, string>()
  function sync(
    nodes: readonly FormNode[],
    prefix: string,
    types: ReadonlyMap<string, FormFieldType>,
  ) {
    for (const node of nodes) {
      if (isList(node)) {
        const path = prefix + node.name
        const items = getPath(model, path)
        if (!Array.isArray(items) || !items.length || typeof items[0] !== 'object')
          setPath(model, path, [{}])
        sync(node.children, `${path}.0.`, types)
      } else if (isContainer(node)) sync(node.children, prefix, types)
      else if (node.name) {
        const path = prefix + node.name
        if (written.get(node) === path) continue
        const type = types.get(node.type)
        if (!type || type.kind === 'display') continue
        written.set(node, path)
        setPath(model, path, startValue(type, node))
      }
    }
  }
  watch(
    () => [state.document, state.fields] as const,
    ([document, types]) => sync(document.nodes, '', types),
    { immediate: true },
  )
  return model
}

const noop = () => {}

/** How many fields the canvas draws right away when it opens. */
const EAGER_FIELDS = 16

interface CanvasLazy {
  /** Whether a field being set up is drawn right away. */
  eager: () => boolean
  /** Call `show` once the element comes near the visible part of the canvas; returns a stop. */
  observe: (el: Element, show: () => void) => (() => void) | void
  /** The last selection came from a press, so the node is in view already. */
  pressed: boolean
}
const lazyKey: InjectionKey<CanvasLazy> = Symbol('DouFormBuilderCanvasLazy')

/** The canvas: the form as the renderer draws it, each node selectable. */
export const FormBuilderCanvas = defineComponent({
  name: 'DouFormBuilderCanvas',
  setup() {
    const state = useBuilderState()
    const scratch = useScratch(state)
    const rendererMessages = useFormBuilderMessages()
    const document = computed(() => state.document)
    const layout = computed(() => document.value.layout ?? 'vertical')
    const columns = computed(() => Math.max(1, Math.round(document.value.columns ?? 12)))

    const renderer: RendererContext = {
      model: () => scratch,
      fields: () => state.fields as Map<string, FormFieldType>,
      labelWidth: () =>
        layout.value === 'horizontal' ? (document.value.labelWidth ?? 96) : undefined,
      changed: noop,
      functions: () => undefined,
      load: () => Promise.resolve([]),
      sourceVersion: () => 0,
      messages: () => rendererMessages.value,
      validate: async () => ({ valid: true, errors: {} }),
      scrollToField: noop,
      addRevealer: () => noop,
      trackError: () => noop,
      errorPaths: () => [],
      footer: () => null,
      footerOwner: () => undefined,
    }
    provide(rendererKey, renderer)
    provide(scopeKey, rootScope)

    const view: BuilderView = { name: 'canvas', order: () => canvasOrder(state) }

    // Fields off screen are drawn once they come near it; the first ones
    // right away, so the canvas does not open on placeholders.
    const scroller = shallowRef<HTMLElement | null>(null)
    let budget = EAGER_FIELDS
    const waiting = new Map<Element, () => void>()
    let observer: IntersectionObserver | undefined
    const lazy: CanvasLazy = {
      eager: () => budget-- > 0,
      pressed: false,
      observe(el, show) {
        if (typeof IntersectionObserver === 'undefined') return show()
        observer ??= new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue
              observer!.unobserve(entry.target)
              waiting.get(entry.target)?.()
              waiting.delete(entry.target)
            }
          },
          { root: scroller.value, rootMargin: '800px 0px' },
        )
        waiting.set(el, show)
        observer.observe(el)
        return () => {
          observer?.unobserve(el)
          waiting.delete(el)
        }
      },
    }
    provide(lazyKey, lazy)
    onMounted(() => (budget = Infinity))
    onBeforeUnmount(() => observer?.disconnect())

    // Keep the selected node in view after the arrow keys; a press already sees it.
    watch(
      () => state.selection[state.selection.length - 1],
      (id) => {
        if (lazy.pressed) return void (lazy.pressed = false)
        if (!id) return
        requestAnimationFrame(() => {
          const el = globalThis.document?.getElementById(state.domId(id, 'canvas'))
          el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
        })
      },
    )

    const active = computed(() => {
      const last = state.selection[state.selection.length - 1]
      return last ? state.domId(last, 'canvas') : undefined
    })

    return () => {
      const doc = document.value
      return h(
        'div',
        {
          ref: scroller,
          class: 'dou-form-builder__canvas',
          // A press beside the form selects the form itself.
          onClick: (event: MouseEvent) => {
            if (!(event.target as HTMLElement).closest('.dou-form-builder__node'))
              state.select(null)
          },
        },
        h('div', { class: 'dou-form-builder__paper' }, [
          h(
            DouForm,
            {
              class: [
                'dou-form-renderer',
                `dou-form-renderer--${layout.value}`,
                (doc.requiredMark ?? true) === true && 'dou-form-renderer--marked',
              ],
              model: scratch,
              layout: layout.value,
              labelAlign: doc.labelAlign,
              size: doc.size,
              requiredMark: doc.requiredMark ?? true,
              scrollToError: false,
              onSubmit: noop,
            },
            () =>
              h(
                'div',
                {
                  ref: (el) => (state.canvas.value = el as HTMLElement | null),
                  class: ['dou-form-renderer__grid', 'dou-form-builder__tree'],
                  style: { '--dou-form-columns': columns.value },
                  role: 'tree',
                  tabindex: 0,
                  'aria-label': state.messages.canvas.label,
                  'aria-multiselectable': true,
                  'aria-activedescendant': active.value,
                  onKeydown: (event: KeyboardEvent) => state.keydown(event, view),
                },
                doc.nodes.length ? designNodes(doc.nodes, columns.value, 0, 1) : [emptyHint(state)],
              ),
          ),
        ]),
      )
    }
  },
})

function emptyHint(state: BuilderState) {
  return h('div', { class: 'dou-form-builder__empty' }, state.messages.canvas.empty)
}

function designNodes(nodes: readonly FormNode[], columns: number, inset: number, level: number) {
  return nodes.map((node, index) =>
    h(DesignNode, {
      key: nodeKey(node),
      node,
      columns,
      inset,
      level,
      position: index + 1,
      size: nodes.length,
    }),
  )
}

/** A grid of child nodes, or a hint where there are none. */
function childGrid(
  state: BuilderState,
  nodes: readonly FormNode[],
  columns: number,
  inset: number,
  level: number,
) {
  return h(
    'div',
    {
      class: 'dou-form-renderer__grid',
      style: { '--dou-form-columns': columns },
      role: 'group',
    },
    nodes.length ? designNodes(nodes, columns, inset, level) : [emptyHint(state)],
  )
}

const DesignNode = defineComponent({
  name: 'DouFormBuilderNode',
  props: {
    node: { type: Object as PropType<FormNode>, required: true },
    columns: { type: Number, required: true },
    inset: { type: Number, default: 0 },
    level: { type: Number, required: true },
    position: { type: Number, required: true },
    size: { type: Number, required: true },
  },
  setup(props) {
    const state = useBuilderState()
    const renderer = inject(rendererKey)!
    const lazy = inject(lazyKey)!
    const selected = computed(() => state.selected.value.has(props.node.id))
    const primary = computed(() => state.focused.value?.id === props.node.id)

    // Fields inside a list read and write its one item on the canvas.
    if (isList(props.node)) {
      const outer = inject(scopeKey, rootScope)
      const prefix = () => `${outer.prefix()}${(props.node as FormListNode).name}.0.`
      const scope: NodeScope = {
        prefix,
        item: () => null,
        blocked: () => new Set(),
      }
      provide(scopeKey, scope)
    }

    // A field off screen waits with a placeholder of about its height.
    const shown = shallowRef(isContainer(props.node) || lazy.eager())
    const el = shallowRef<HTMLElement | null>(null)
    let stop: (() => void) | void
    onMounted(() => {
      if (!shown.value && el.value) stop = lazy.observe(el.value, () => (shown.value = true))
    })
    onBeforeUnmount(() => stop?.())

    function press(event: MouseEvent, id = props.node.id) {
      event.stopPropagation()
      lazy.pressed = true
      const many = event.shiftKey || event.metaKey || event.ctrlKey
      state.select(id, many ? 'toggle' : 'replace')
      state.canvas.value?.focus({ preventScroll: true })
    }

    return () => {
      const node = props.node
      const title = nodeTitle(node, state.fields as Map<string, FormFieldType>, state.messages)
      let body: VNode
      if (isList(node)) body = listBody(state, node, props, renderer.messages())
      else if (node.type === 'tabs' || node.type === 'steps')
        body = pagesBody(state, node as FormContainerNode, props, press)
      else if (isContainer(node)) body = sectionBody(state, node as FormSectionNode, props)
      else if (!shown.value)
        body = h('div', { class: 'dou-form-builder__placeholder', 'data-type': node.type }, [
          h('span', { class: 'dou-form-builder__placeholder-label' }),
          h('span', { class: 'dou-form-builder__placeholder-box' }),
        ])
      else
        body = h(
          'div',
          { class: 'dou-form-builder__content', inert: true },
          h(FormNodeView, {
            node: designNode(node as FormFieldNode),
            columns: props.columns,
            inset: props.inset,
          }),
        )
      return h(
        'div',
        {
          class: [
            'dou-form-renderer__cell',
            'dou-form-builder__node',
            isContainer(node) && 'is-container',
            selected.value && 'is-selected',
          ],
          ref: el,
          style: spanStyle(node.span, props.columns),
          id: state.domId(node.id, 'canvas'),
          role: 'treeitem',
          'aria-level': props.level,
          'aria-posinset': props.position,
          'aria-setsize': props.size,
          'aria-selected': selected.value,
          'aria-expanded': isContainer(node) ? true : undefined,
          'aria-label': title,
          'data-node': node.id,
          onClick: press,
        },
        [body, primary.value ? actionBar(state, node, title) : null],
      )
    }
  },
})

type BodyProps = { columns: number; inset: number; level: number }

function sectionBody(state: BuilderState, node: FormSectionNode | FormPageNode, props: BodyProps) {
  const columns = node.columns ?? props.columns
  const bordered = !isPage(node) && node.bordered
  return h('div', { class: ['dou-form-renderer__section', bordered && 'is-bordered'] }, [
    node.title || node.description
      ? h('div', { class: 'dou-form-renderer__section-header', inert: true }, [
          node.title && h('div', { class: 'dou-form-renderer__section-title' }, node.title),
          node.description &&
            h('div', { class: 'dou-form-renderer__section-description' }, node.description),
        ])
      : null,
    childGrid(state, node.children, columns, props.inset + (bordered ? 1 : 0), props.level + 1),
  ])
}

function listBody(
  state: BuilderState,
  node: FormListNode,
  props: BodyProps,
  messages: FormBuilderMessages,
) {
  const columns = node.columns ?? props.columns
  return h('div', { class: 'dou-form-renderer__list' }, [
    node.label || node.help
      ? h('div', { class: 'dou-form-renderer__section-header', inert: true }, [
          node.label &&
            h(
              'div',
              { class: ['dou-form-renderer__section-title', node.required && 'is-required'] },
              node.label,
            ),
          node.help && h('div', { class: 'dou-form-renderer__section-description' }, node.help),
        ])
      : null,
    h('div', { class: 'dou-form-renderer__list-item dou-form-builder__item' }, [
      h(
        'div',
        { class: 'dou-form-renderer__list-item-header', inert: true },
        h(
          'span',
          { class: 'dou-form-renderer__list-item-title' },
          formatMessage(messages.item, { index: 1 }),
        ),
      ),
      childGrid(state, node.children, columns, props.inset + 1, props.level + 1),
    ]),
    h(
      'div',
      { class: 'dou-form-builder__list-add', inert: true },
      h(
        DouButton,
        { variant: 'outline', tabindex: -1 },
        { leading: () => h(PlusIcon), default: () => node.addText ?? messages.add },
      ),
    ),
  ])
}

function pagesBody(
  state: BuilderState,
  node: FormContainerNode,
  props: BodyProps,
  press: (event: MouseEvent, id?: string) => void,
) {
  const pages = node.children as FormPageNode[]
  const shown = state.shownPage(node)
  const steps = node.type === 'steps'
  const level = props.level + 1
  return h('div', { class: ['dou-form-builder__pages', steps && 'is-steps'] }, [
    h('div', { class: 'dou-form-builder__strip', role: 'group' }, [
      ...pages.map((page, index) =>
        h(
          'div',
          {
            key: page.id,
            class: [
              'dou-form-builder__page-tab',
              page === shown && 'is-shown',
              state.selected.value.has(page.id) && 'is-selected',
            ],
            id: state.domId(page.id, 'canvas'),
            role: 'treeitem',
            'aria-level': level,
            'aria-posinset': index + 1,
            'aria-setsize': pages.length,
            'aria-selected': state.selected.value.has(page.id),
            'aria-expanded': page === shown,
            'data-node': page.id,
            onClick: (event: MouseEvent) => press(event, page.id),
          },
          [
            steps ? h('span', { class: 'dou-form-builder__step-number' }, String(index + 1)) : null,
            h('span', { class: 'dou-form-builder__page-title' }, page.title || ' '),
          ],
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'dou-form-builder__page-add',
          tabindex: -1,
          'aria-label': state.messages.actions.addPage,
          title: state.messages.actions.addPage,
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            state.addPage(node.id)
          },
        },
        h(PlusIcon),
      ),
    ]),
    shown
      ? h(
          'div',
          {
            class: ['dou-form-builder__page', state.selected.value.has(shown.id) && 'is-selected'],
            onClick: (event: MouseEvent) => press(event, shown.id),
          },
          [
            shown.description
              ? h(
                  'div',
                  { class: 'dou-form-renderer__page-description', inert: true },
                  shown.description,
                )
              : null,
            childGrid(
              state,
              shown.children,
              shown.columns ?? props.columns,
              props.inset,
              level + 1,
            ),
          ],
        )
      : null,
  ])
}

/** The buttons over the selected node, and its type. */
function actionBar(state: BuilderState, node: FormNode, title: string) {
  const messages = state.messages
  const place = placesOf(state.document).get(node.id)
  const siblings = place?.parent ? place.parent.children.length : state.document.nodes.length
  const fields = state.fields as Map<string, FormFieldType>
  const Icon = iconOf(node.type, fields.get(node.type))
  const button = (label: string, icon: VNode, run: () => void, disabled = false) =>
    h(
      'button',
      {
        type: 'button',
        class: 'dou-form-builder__action',
        tabindex: -1,
        disabled,
        'aria-label': label,
        title: label,
        onClick: (event: MouseEvent) => {
          event.stopPropagation()
          run()
          state.canvas.value?.focus({ preventScroll: true })
        },
      },
      icon,
    )
  const typeLabel = labelOf(node.type, fields.get(node.type), messages)
  return h('div', { class: 'dou-form-builder__actions', role: 'toolbar', 'aria-label': title }, [
    h('span', { class: 'dou-form-builder__badge', 'aria-hidden': true }, [
      h(Icon),
      h('span', typeLabel),
      title !== typeLabel && 'name' in node && node.name && node.name !== title
        ? h('span', { class: 'dou-form-builder__badge-name' }, node.name)
        : null,
    ]),
    place?.parent
      ? button(messages.actions.parent, h(CornerLeftUpIcon), () => state.selectParent())
      : null,
    button(messages.actions.up, h(ArrowUpIcon), () => state.move(-1, [node.id]), !place?.index),
    button(
      messages.actions.down,
      h(ArrowDownIcon),
      () => state.move(1, [node.id]),
      !place || place.index >= siblings - 1,
    ),
    button(messages.actions.duplicate, h(CopyIcon), () => state.duplicate([node.id])),
    button(messages.actions.remove, h(TrashIcon), () => state.remove([node.id])),
  ])
}
