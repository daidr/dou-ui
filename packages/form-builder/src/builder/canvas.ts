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
import type { InjectionKey, PropType, Ref, VNode } from 'vue'
import { DouButton, DouContextMenu, DouDropdown, DouForm, DouTooltip, holdPointer } from 'dou-ui'
import type { ContextMenuExpose, DropdownExpose } from 'dou-ui'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  CornerLeftUpIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SigmaIcon,
  TrashIcon,
  WorkflowIcon,
} from '@dou-ui/icons'
import { getPath, isContainer, isList, isPage, setPath } from '../core/document'
import type {
  FormContainerNode,
  FormFieldNode,
  FormListNode,
  FormNode,
  FormPageNode,
  FormResponsive,
  FormSectionNode,
} from '../core/types'
import { startValue } from '../core/values'
import type { FormFieldType } from '../fields/define'
import { formatMessage, useFormRendererMessages } from '../locale'
import type { FormRendererMessages } from '../locale'
import { rendererKey, rootScope, scopeKey } from '../renderer/context'
import { menuItems, nodeMenu } from './menu'
import type { FormBuilderNodeMark } from './extension'
import type { NodeScope, RendererContext } from '../renderer/context'
import { FormNodeView, nodeKey, spanStyle } from '../renderer/node-view'
import { canvasOrder, useBuilderState } from './context'
import type { BuilderState, BuilderView } from './context'
import { formNodePlaces } from './core/transaction'
import { nodeTitle } from './settings'
import { createDragController } from './drag'
import type { DragLayer } from './drag'

/**
 * The key a node's value has on the canvas: made from its id, not its
 * name, so a name being typed, left empty or used twice does not bind
 * the field to another field's value.
 */
const previewKey = (node: FormNode) => `n_${node.id.replace(/\W/g, '_')}`

/**
 * A field as the canvas draws it: always shown, enabled and editable in
 * look, with no options to load, and its value under `previewKey`. Kept
 * per node, so an untouched field is not drawn again.
 */
const designed = new WeakMap<FormFieldNode, FormFieldNode>()
function designNode(node: FormFieldNode): FormFieldNode {
  let result = designed.get(node)
  if (!result) {
    const rest: FormFieldNode = { ...node }
    for (const key of ['visibleWhen', 'disabledWhen', 'formula', 'source', 'requiredWhen'] as const)
      delete rest[key]
    if ('name' in node) rest.name = previewKey(node)
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
        const path = prefix + previewKey(node)
        const items = getPath(model, path)
        if (!Array.isArray(items) || !items.length || typeof items[0] !== 'object')
          setPath(model, path, [{}])
        sync(node.children, `${path}.0.`, types)
      } else if (isContainer(node)) sync(node.children, prefix, types)
      else if ('name' in node) {
        const path = prefix + previewKey(node)
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

const canvasView = (state: BuilderState): BuilderView => ({
  name: 'canvas',
  order: () => canvasOrder(state),
})

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
    const rendererMessages = useFormRendererMessages()
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
      validators: () => undefined,
      readonly: () => false,
      blockedFormulas: () => new Set(),
      settled: () => scratch,
      controlsReadonly: () => false,
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
      resets: () => 0,
    }
    provide(rendererKey, renderer)
    provide(scopeKey, rootScope)

    const view = canvasView(state)

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

    // Drags: the line, the tinted container and the card under the pointer are
    // moved by the controller directly, without rendering the canvas.
    const layer: DragLayer = { indicator: null, holder: null, ghost: null }
    const dragger = createDragController(state, () => scroller.value, layer)
    state.dragger.value = dragger
    onBeforeUnmount(() => {
      dragger.stop()
      if (state.dragger.value === dragger) state.dragger.value = null
    })

    const active = computed(() => {
      const last = state.selection[state.selection.length - 1]
      return last ? state.domId(last, 'canvas') : undefined
    })

    // The menu of the selected nodes, opened by a right click or the menu key.
    const contextMenu = shallowRef<ContextMenuExpose | null>(null)
    const openMenu = (x: number, y: number) => {
      if (nodeMenu(state, state.selection).length) contextMenu.value?.open(x, y)
    }
    state.openMenu.value = openMenu
    onBeforeUnmount(() => {
      if (state.openMenu.value === openMenu) state.openMenu.value = null
    })
    function onTreeKeydown(event: KeyboardEvent) {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault()
        const id = state.selection[state.selection.length - 1]
        const rect = id
          ? globalThis.document?.getElementById(state.domId(id, 'canvas'))?.getBoundingClientRect()
          : undefined
        if (rect) openMenu(rect.left + 16, rect.top + 16)
        return
      }
      state.keydown(event, view)
    }

    return () => {
      const doc = document.value
      return h(
        'div',
        {
          ref: scroller,
          class: 'dou-form-builder__canvas',
          // A press beside the form selects the form itself.
          onClick: (event: MouseEvent) => {
            if (dragger.swallowClick()) return
            if (!(event.target as HTMLElement).closest('.dou-form-builder__node'))
              state.select(null)
          },
        },
        [
          h('div', { class: 'dou-form-builder__drop-layer', 'aria-hidden': true }, [
            h('div', {
              ref: (el) => (layer.holder = el as HTMLElement | null),
              class: 'dou-form-builder__drop-holder',
              hidden: true,
            }),
            h('div', {
              ref: (el) => (layer.indicator = el as HTMLElement | null),
              class: 'dou-form-builder__drop-line',
              hidden: true,
            }),
            h('div', {
              ref: (el) => (layer.ghost = el as HTMLElement | null),
              class: 'dou-form-builder__drag-ghost',
              hidden: true,
            }),
          ]),
          h(
            DouContextMenu,
            {
              ref: (instance: unknown) =>
                (contextMenu.value = instance as ContextMenuExpose | null),
            },
            {
              default: () => h('span', { class: 'dou-form-builder__menu-anchor' }),
              menu: () => menuItems(nodeMenu(state, state.selection)),
            },
          ),
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
                    'data-holder': '',
                    style: { '--dou-form-columns': columns.value },
                    role: 'tree',
                    tabindex: 0,
                    'aria-label': state.messages.canvas.label,
                    'aria-multiselectable': true,
                    'aria-activedescendant': active.value,
                    onKeydown: onTreeKeydown,
                  },
                  doc.nodes.length
                    ? designNodes(doc.nodes, columns.value, 0, 1)
                    : [emptyHint(state)],
                ),
            ),
          ]),
        ],
      )
    }
  },
})

function emptyHint(state: BuilderState) {
  const messages = state.messages.canvas
  return h(
    'div',
    { class: 'dou-form-builder__empty' },
    state.readonly ? messages.readonlyEmpty : messages.empty,
  )
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
  holder: string,
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
      'data-holder': holder,
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
      const prefix = () => `${outer.prefix()}${previewKey(props.node)}.0.`
      const scope: NodeScope = {
        prefix,
        item: () => null,
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

    const moreOpen = shallowRef(false)

    function press(event: MouseEvent, id = props.node.id) {
      event.stopPropagation()
      if (state.dragger.value?.swallowClick()) return
      lazy.pressed = true
      state.pick(id, event, canvasView(state))
      state.canvas.value?.focus({ preventScroll: true })
    }

    return () => {
      const node = props.node
      const title = nodeTitle(node, state.fields as Map<string, FormFieldType>, state.messages)
      const logic = logicOf(state, node)
      const marks = state.extensions().marks.flatMap((marksOf) => marksOf(state, node))
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
            marks.length > 0 && 'is-marked',
          ],
          ref: el,
          style: [
            spanStyle(node.span, props.columns),
            marks.length ? { '--dou-form-builder-mark': marks[0]!.color ?? 'currentColor' } : null,
          ],
          id: state.domId(node.id, 'canvas'),
          role: 'treeitem',
          'aria-level': props.level,
          'aria-posinset': props.position,
          'aria-setsize': props.size,
          'aria-selected': selected.value,
          'aria-expanded': isContainer(node) ? true : undefined,
          'aria-label': title,
          'aria-description': logic?.text,
          'data-node': node.id,
          onClick: press,
          onContextmenu: (event: MouseEvent) => {
            event.stopPropagation()
            event.preventDefault()
            // On touch screens a long press drags; the action bar has the menu.
            if ((event as PointerEvent).pointerType === 'touch') return
            if (!selected.value) state.select(node.id)
            state.openMenu.value?.(event.clientX, event.clientY)
          },
          onPointerdown: (event: PointerEvent) => {
            // The innermost node takes the press; the buttons and the width handle keep theirs.
            event.stopPropagation()
            const target = event.target as HTMLElement
            if (
              target.closest(
                '.dou-form-builder__actions, .dou-form-builder__resize, .dou-form-builder__strip',
              )
            )
              return
            state.dragger.value?.pressNode(event, node.id)
          },
        },
        [
          body,
          logic && !primary.value ? logicMark(logic) : null,
          marks.length ? markTags(marks) : null,
          primary.value && !state.readonly ? actionBar(state, node, title, moreOpen) : null,
          primary.value && !state.readonly && !isPage(node) ? resizeHandle(state, node, el) : null,
        ],
      )
    }
  },
})

/** The labels of a node's marks, over its top edge, each in its color. */
function markTags(marks: FormBuilderNodeMark[]) {
  return h(
    'div',
    { class: 'dou-form-builder__marks', 'aria-hidden': 'true' },
    marks.map((mark) =>
      h(
        'span',
        {
          key: mark.key,
          class: 'dou-form-builder__mark',
          style: mark.color ? { '--dou-form-builder-mark': mark.color } : undefined,
        },
        mark.label,
      ),
    ),
  )
}

const LOGIC_KEYS = ['visibleWhen', 'disabledWhen', 'requiredWhen', 'formula'] as const

/** The conditions and the formula a node has, as lines for a tooltip; none without them. */
function logicOf(state: BuilderState, node: FormNode) {
  const settings = state.messages.settings as Record<string, string>
  const lines: string[] = []
  let conditions = false
  let formula = false
  for (const key of LOGIC_KEYS) {
    const text = (node as Partial<Record<(typeof LOGIC_KEYS)[number], string>>)[key]
    if (!text?.trim()) continue
    if (key === 'formula') formula = true
    else conditions = true
    lines.push(
      formatMessage(state.messages.condition.summary, { label: settings[key] ?? key, text }),
    )
  }
  return lines.length ? { lines, text: lines.join('; '), conditions, formula } : undefined
}

/** A mark in the node's corner when it has conditions or a formula, telling them on hover. */
function logicMark(logic: NonNullable<ReturnType<typeof logicOf>>) {
  return h(
    DouTooltip,
    { placement: 'top-end' },
    {
      default: () =>
        h('span', { class: 'dou-form-builder__logic-mark', 'aria-hidden': 'true' }, [
          logic.conditions ? h(WorkflowIcon) : null,
          logic.formula ? h(SigmaIcon) : null,
        ]),
      content: () =>
        h(
          'span',
          { class: 'dou-form-builder__logic-lines' },
          logic.lines.map((line) => h('span', { key: line }, line)),
        ),
    },
  )
}

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
    childGrid(
      state,
      node.id,
      node.children,
      columns,
      props.inset + (bordered ? 1 : 0),
      props.level + 1,
    ),
  ])
}

function listBody(
  state: BuilderState,
  node: FormListNode,
  props: BodyProps,
  messages: FormRendererMessages,
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
      childGrid(state, node.id, node.children, columns, props.inset + 1, props.level + 1),
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
      state.readonly
        ? null
        : h(
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
              shown.id,
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

/** One button of the selected node's action bar, its name and key in a tooltip. */
const actionButton = (
  label: string,
  shortcut: string | undefined,
  icon: VNode,
  onClick: (event: MouseEvent) => void,
  disabled = false,
) =>
  h(
    DouTooltip,
    { content: label, shortcut },
    {
      default: () =>
        h(
          'button',
          {
            type: 'button',
            class: 'dou-form-builder__action',
            tabindex: -1,
            disabled,
            'aria-label': label,
            onClick,
          },
          icon,
        ),
    },
  )

/** The buttons of the selected node; its type and name show in the inspector's header. */
function actionBar(state: BuilderState, node: FormNode, title: string, moreOpen: Ref<boolean>) {
  const messages = state.messages
  const place = formNodePlaces(state.document).get(node.id)
  const siblings = place?.parent ? place.parent.children.length : state.document.nodes.length
  const after = () => state.canvas.value?.focus({ preventScroll: true })
  const ids = state.selected.value.has(node.id) ? state.selection : [node.id]
  const actions = [
    place?.parent
      ? {
          label: messages.actions.parent,
          shortcut: 'escape',
          icon: CornerLeftUpIcon,
          run: () => state.selectParent(),
        }
      : null,
    {
      label: messages.actions.up,
      shortcut: 'mod+arrowup',
      icon: ArrowUpIcon,
      run: () => state.moveBy(-1, [node.id]),
      disabled: !place?.index,
    },
    {
      label: messages.actions.down,
      shortcut: 'mod+arrowdown',
      icon: ArrowDownIcon,
      run: () => state.moveBy(1, [node.id]),
      disabled: !place || place.index >= siblings - 1,
    },
    {
      label: messages.actions.duplicate,
      shortcut: 'mod+d',
      icon: CopyIcon,
      run: () => state.duplicate([node.id]),
    },
    {
      label: messages.actions.remove,
      shortcut: 'delete',
      icon: TrashIcon,
      run: () => state.remove([node.id]),
      danger: true,
    },
  ].filter((action) => action !== null)
  // A node too narrow for the row of buttons gets one button with a menu instead (see style.css).
  let menu: DropdownExpose | null = null
  const more = h(
    DouDropdown,
    {
      ref: (instance: unknown) => (menu = instance as DropdownExpose | null),
      placement: 'bottom-end',
      // Closed by a choice, Escape or a press outside: the keys go on working on the canvas.
      'onUpdate:open': (open: boolean) => {
        moreOpen.value = open
        if (!open) requestAnimationFrame(after)
      },
    },
    {
      default: () =>
        h(
          'button',
          {
            type: 'button',
            class: 'dou-form-builder__action',
            tabindex: -1,
            'aria-label': messages.actions.more,
            onClick: (event: MouseEvent) => event.stopPropagation(),
            // Escape closes the open menu only, rather than selecting the parent on the canvas.
            onKeydown: (event: KeyboardEvent) => {
              const target = event.currentTarget as HTMLElement
              if (event.key !== 'Escape' || target.getAttribute('aria-expanded') !== 'true') return
              event.stopPropagation()
              menu?.close()
            },
          },
          h(MoreHorizontalIcon),
        ),
      menu: () => menuItems(nodeMenu(state, ids)),
    },
  )
  // Items of extensions are only in the menu, so the menu button shows at any width.
  const extra = state.extensions().menus.length > 0
  return h(
    'div',
    {
      class: 'dou-form-builder__actions',
      role: 'toolbar',
      'aria-label': title,
      'data-extra': extra || undefined,
    },
    [
      ...actions.map((action) =>
        actionButton(
          action.label,
          action.shortcut,
          h(action.icon),
          (event) => {
            event.stopPropagation()
            action.run()
            after()
          },
          action.disabled,
        ),
      ),
      // The tip goes on a wrapper, since the menu takes the button itself; it stands aside while the menu is open.
      h(
        DouTooltip,
        { content: messages.actions.more, disabled: moreOpen.value },
        { default: () => h('span', { class: 'dou-form-builder__actions-more' }, more) },
      ),
    ],
  )
}

/** The form widths the breakpoints of a responsive width start at, as in the renderer's styles. */
const breakpointWidths = [
  ['xl', 960],
  ['lg', 800],
  ['md', 640],
  ['sm', 480],
] as const

/** The key of a responsive width that applies at the form's width now. */
function activeSpanKey(span: Exclude<FormResponsive<number>, number>, cell: HTMLElement) {
  const width = cell.closest('.dou-form-renderer')?.getBoundingClientRect().width ?? 0
  for (const [key, min] of breakpointWidths) if (width >= min && span[key] !== undefined) return key
  return 'base' as const
}

/** The handle on the selected node's end edge: drag it to change the width, snapping to columns. */
function resizeHandle(state: BuilderState, node: FormNode, cell: Ref<HTMLElement | null>) {
  return h('div', {
    class: 'dou-form-builder__resize',
    title: state.messages.drag.resize,
    'aria-hidden': true,
    onClick: (event: MouseEvent) => event.stopPropagation(),
    onPointerdown: (event: PointerEvent) => startResize(event, state, node.id, cell.value),
  })
}

function startResize(
  event: PointerEvent,
  state: BuilderState,
  id: string,
  cell: HTMLElement | null,
) {
  if (event.button !== 0 || !cell?.parentElement) return
  event.preventDefault()
  event.stopPropagation()
  const handle = event.currentTarget as HTMLElement
  // Read the grid once; moving the pointer then only does math.
  const grid = cell.parentElement
  const style = getComputedStyle(grid)
  const columns = Math.max(
    1,
    Math.round(Number(style.getPropertyValue('--dou-form-columns')) || 12),
  )
  const gap = Number.parseFloat(style.columnGap) || 0
  const unit = (grid.getBoundingClientRect().width + gap) / columns
  const left = cell.getBoundingClientRect().left
  const hold = holdPointer(event, handle)
  hold.grab()
  const node = formNodePlaces(state.document).get(id)?.node
  const span = node?.span
  const key = span !== undefined && typeof span === 'object' ? activeSpanKey(span, cell) : null
  const current = () => {
    const now = formNodePlaces(state.document).get(id)?.node.span
    if (now === undefined) return columns
    if (typeof now === 'number') return now
    return now[key ?? 'base'] ?? now.base ?? columns
  }
  let last = current()
  handle.dataset.value = `${last} / ${columns}`
  cell.classList.add('is-resizing')

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return
    const next = Math.min(columns, Math.max(1, Math.round((e.clientX - left + gap) / unit)))
    if (next === last) return
    last = next
    handle.dataset.value = `${next} / ${columns}`
    const now = formNodePlaces(state.document).get(id)?.node.span
    const value =
      key && now !== undefined && typeof now === 'object'
        ? { ...now, [key]: next }
        : next === columns
          ? undefined
          : next
    const tr = state.transaction().update(id, { span: value })
    tr.setMeta('group', `resize:${id}`)
    tr.setMeta('origin', 'resize')
    state.dispatch(tr)
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    hold.release()
    delete handle.dataset.value
    cell.classList.remove('is-resizing')
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
