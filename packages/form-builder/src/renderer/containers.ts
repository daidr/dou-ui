import {
  computed,
  defineComponent,
  h,
  inject,
  nextTick,
  onScopeDispose,
  provide,
  shallowRef,
  toRaw,
  useId,
  watch,
} from 'vue'
import type { PropType, VNodeChild } from 'vue'
import {
  DouButton,
  DouFormItem,
  DouSortable,
  DouSortableHandle,
  DouSteps,
  DouTabPanel,
  DouTabs,
} from 'dou-ui'
import type { FormItemExpose, FormRule, StepItem } from 'dou-ui'
import { PlusIcon, TrashIcon } from '@dou-ui/icons'
import { getPath, isList, setPath, valueNodes } from '../core/document'
import { findItemFormulaCycles } from '../core/formulas'
import { rulesOf } from '../core/rules'
import type {
  FormListNode,
  FormNode,
  FormPageNode,
  FormStepsNode,
  FormTabsNode,
} from '../core/types'
import { emptyItem } from '../core/values'
import { formatMessage } from '../locale'
import { rendererKey, scopeKey } from './context'
import type { NodeScope, RendererContext } from './context'
import { disabledKey, pathIn } from './context'
import type { Condition, NodeKit, NodeProps } from './context'

type Flag = { readonly value: boolean }

/** Whether a field at `path` sits among `nodes`, inside a list item included. */
export function holdsPath(nodes: readonly FormNode[], path: string, prefix = ''): boolean {
  return valueNodes(nodes).some((node) => {
    const own = prefix + node.name!
    return own === path || (isList(node) && path.startsWith(`${own}.`))
  })
}

/** The paths of every field among `nodes`, the fields of each list item included. */
export function valuePaths(nodes: readonly FormNode[], model: unknown, prefix = ''): string[] {
  const paths: string[] = []
  for (const node of valueNodes(nodes)) {
    const own = prefix + node.name!
    paths.push(own)
    if (!isList(node)) continue
    const items = getPath(model, own)
    if (Array.isArray(items))
      items.forEach((_, index) =>
        paths.push(...valuePaths(node.children, model, `${own}.${index}.`)),
      )
  }
  return paths
}

/** The pages of tabs or steps that show, as the node's own view decides them. */
function shownPages(props: NodeProps, condition: Condition) {
  return computed(() =>
    (props.node as FormTabsNode | FormStepsNode).children.filter(
      (child) => !!child && condition(child.visibleWhen, true, child),
    ),
  )
}

/** One page of tabs or steps: its description and its own grid. */
const pageOf = (kit: NodeKit, node: FormPageNode, props: NodeProps) =>
  h(kit.view, {
    key: node.id,
    node,
    columns: props.columns,
    inset: props.inset,
    asPage: true,
  })

export function tabsView(
  kit: NodeKit,
  props: NodeProps,
  renderer: RendererContext,
  scope: NodeScope,
  disabled: Flag,
  condition: Condition,
) {
  provide(disabledKey, () => disabled.value)
  const pages = shownPages(props, condition)
  const chosen = shallowRef<string>()
  const selected = computed(() =>
    pages.value.some((shown) => shown.id === chosen.value) ? chosen.value : pages.value[0]?.id,
  )
  // A field with an error on another tab: switch to the tab.
  onScopeDispose(
    renderer.addRevealer((path) => {
      const found = pages.value.find((shown) => holdsPath(shown.children, path, scope.prefix()))
      if (found) chosen.value = found.id
      return !!found
    }),
  )
  return () =>
    h(
      DouTabs,
      {
        class: 'dou-form-renderer__tabs',
        modelValue: selected.value,
        'onUpdate:modelValue': (value: string | number | undefined) => {
          if (value !== undefined) chosen.value = String(value)
        },
      },
      () =>
        pages.value.map((node) =>
          h(
            DouTabPanel,
            { key: node.id, value: node.id, label: node.title, eager: true },
            {
              default: () => pageOf(kit, node, props),
              // A page with errors gets a dot, read out as "has errors". Worked
              // out in the slot, so the tab list follows the errors itself.
              label: () => {
                const failed = renderer
                  .errorPaths()
                  .some((path) => holdsPath(node.children, path, scope.prefix()))
                return h('span', { class: 'dou-form-renderer__tab-title' }, [
                  node.title,
                  failed
                    ? h('span', { class: 'dou-form-renderer__tab-error' }, [
                        h(
                          'span',
                          { class: 'dou-form-renderer__sr-only' },
                          `（${renderer.messages().invalid}）`,
                        ),
                      ])
                    : null,
                ])
              },
            },
          ),
        ),
    )
}

export function stepsView(
  kit: NodeKit,
  props: NodeProps,
  renderer: RendererContext,
  scope: NodeScope,
  disabled: Flag,
  condition: Condition,
) {
  provide(disabledKey, () => disabled.value)
  const pages = shownPages(props, condition)
  // Read-only, there is nothing to fill in step by step: every page shows, under its title.
  if (renderer.readonly()) {
    const uid = useId()
    return () =>
      h(
        'div',
        { class: 'dou-form-renderer__steps is-readonly' },
        pages.value.map((node) => {
          const titleId = `dou-form-step-${uid}-${node.id}`
          return h(
            'div',
            {
              key: node.id,
              class: 'dou-form-renderer__section',
              role: 'group',
              'aria-labelledby': titleId,
            },
            [
              h('div', { class: 'dou-form-renderer__section-header' }, [
                h('div', { id: titleId, class: 'dou-form-renderer__section-title' }, node.title),
              ]),
              pageOf(kit, node, props),
            ],
          )
        }),
      )
  }
  const chosen = shallowRef<string>()
  /** How far people got: the steps up to here can be opened again. */
  const reached = shallowRef(0)
  const failed = shallowRef(false)
  const checking = shallowRef(false)
  const current = computed(() => {
    const index = pages.value.findIndex((shown) => shown.id === chosen.value)
    return index < 0 ? 0 : index
  })
  watch(current, () => (failed.value = false))
  watch(renderer.resets, () => {
    chosen.value = undefined
    reached.value = 0
    failed.value = false
  })

  function go(index: number) {
    const target = pages.value[index]
    if (!target) return
    chosen.value = target.id
    reached.value = Math.max(reached.value, index)
  }

  // Back and Next take focus to the page they open, which names its step:
  // the button pressed may be gone, and a screen reader hears where it is.
  const stepEls = new Map<string, HTMLElement>()
  function turn(index: number) {
    go(index)
    const id = pages.value[index]?.id
    if (id) void nextTick(() => stepEls.get(id)?.focus({ preventScroll: true }))
  }

  async function next() {
    const shown = pages.value[current.value]
    if (!shown || checking.value) return
    checking.value = true
    try {
      const paths = valuePaths(shown.children, renderer.model(), scope.prefix())
      const { valid, errors } = await renderer.validate(paths)
      if (!valid) {
        failed.value = true
        const first = Object.keys(errors)[0]
        if (first) renderer.scrollToField(first)
        return
      }
      turn(current.value + 1)
    } finally {
      checking.value = false
    }
  }

  // A field with an error on another step, e.g. on submit: open its step.
  onScopeDispose(
    renderer.addRevealer((path) => {
      const index = pages.value.findIndex((page) => holdsPath(page.children, path, scope.prefix()))
      if (index >= 0) go(index)
      return index >= 0
    }),
  )

  return () => {
    const list = pages.value
    const index = current.value
    const messages = renderer.messages()
    const last = index >= list.length - 1
    // A step holding errors, e.g. ones set after submit, is marked like a tab.
    const errorPaths = renderer.errorPaths()
    const failing = new Set(
      list
        .filter((step) => errorPaths.some((path) => holdsPath(step.children, path, scope.prefix())))
        .map((step) => step.id),
    )
    const items: StepItem[] = list.map((step, at) => ({
      title: step.title,
      disabled: at > reached.value,
      status: failing.has(step.id) ? 'error' : undefined,
    }))
    const footer: VNodeChild[] = []
    if (index > 0)
      footer.push(
        h(
          DouButton,
          { key: 'prev', variant: 'outline', onClick: () => turn(index - 1) },
          () => messages.prev,
        ),
      )
    if (!last)
      footer.push(
        h(
          DouButton,
          { key: 'next', tone: 'primary', loading: checking.value, onClick: next },
          () => messages.next,
        ),
      )
    else if (renderer.footerOwner() === props.node.id) footer.push(renderer.footer() as VNodeChild)
    return h('div', { class: 'dou-form-renderer__steps' }, [
      // A step's status is read out with its title, "error" included.
      h(DouSteps, {
        items,
        current: index,
        status: failed.value ? 'error' : 'process',
        clickable: true,
        'onUpdate:current': (at: number) => {
          if (at <= reached.value) go(at)
        },
      }),
      ...list.map((node, at) =>
        h(
          'div',
          {
            key: node.id,
            ref: (el: unknown) => {
              if (el) stepEls.set(node.id, el as HTMLElement)
              else stepEls.delete(node.id)
            },
            class: 'dou-form-renderer__step',
            hidden: at !== index || undefined,
            role: 'group',
            tabindex: -1,
            'aria-label': formatMessage(messages.step, {
              index: at + 1,
              count: list.length,
              title: node.title ?? '',
            }),
          },
          [pageOf(kit, node, props)],
        ),
      ),
      h('div', { class: 'dou-form-renderer__steps-footer' }, footer),
    ])
  }
}

/** Ids of list items, by the item object, so each keeps its view while the list is reordered. */
const itemIds = new WeakMap<object, string>()
let nextItem = 0
function itemKey(item: unknown) {
  if (item === null || typeof item !== 'object') return `v:${String(item)}`
  const raw = toRaw(item)
  let id = itemIds.get(raw)
  if (!id) itemIds.set(raw, (id = `i${++nextItem}`))
  return id
}

/**
 * The copy of an item that follows the pointer. It sits on `body`, away
 * from the form whose width picks the columns and whose classes set the
 * layout, so it is wrapped in an element with the form's classes and every
 * cell keeps the columns it has now.
 */
function listGhost(el: HTMLElement): HTMLElement {
  const clone = el.cloneNode(true) as HTMLElement
  const cells = el.querySelectorAll<HTMLElement>('.dou-form-renderer__cell')
  clone.querySelectorAll<HTMLElement>('.dou-form-renderer__cell').forEach((cell, index) => {
    const source = cells[index]
    if (source) cell.style.gridColumn = getComputedStyle(source).gridColumn
  })
  const form = el.closest<HTMLElement>('.dou-form')
  if (!form) return clone
  const wrapper = document.createElement('div')
  wrapper.className = `${form.className} dou-form-renderer__list-ghost`
  // The wrapper takes the size the copy is given, not the form's container sizing.
  wrapper.style.containerType = 'normal'
  wrapper.append(clone)
  return wrapper
}

/** The rules of a list itself: its own, and its bounds on the number of items. */
function listRules(node: FormListNode, renderer: RendererContext, path: () => string): FormRule[] {
  const rules = rulesOf(node, {
    functions: renderer.functions(),
    validators: renderer.validators(),
    path,
  })
  const bounds: FormRule = {}
  if (node.min !== undefined && node.min > 0) bounds.min = node.min
  if (node.max !== undefined) bounds.max = node.max
  return bounds.min === undefined && bounds.max === undefined ? rules : [...rules, bounds]
}

export function listView(
  kit: NodeKit,
  props: NodeProps,
  renderer: RendererContext,
  scope: NodeScope,
  disabled: Flag,
) {
  provide(disabledKey, () => disabled.value)
  const uid = useId()
  const list = () => props.node as FormListNode
  const path = () => pathIn(scope, list().name)
  const items = computed(() => {
    const value = getPath(renderer.model(), path())
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
  })
  /** Item fields whose formulas read each other in a circle. */
  const blocked = computed(() => {
    const cycles = findItemFormulaCycles(list())
    for (const cycle of cycles)
      console.warn(
        `[@dou-ui/form-builder] form formulas of list "${list().name}" read each other in a circle (${cycle.join(' -> ')}); they are not worked out`,
      )
    return new Set(cycles.flat())
  })
  const rules = computed(() => listRules(list(), renderer, path))

  function write(next: Record<string, unknown>[]) {
    const name = path()
    setPath(renderer.model(), name, next)
    renderer.changed(name, getPath(renderer.model(), name))
  }
  const root = shallowRef<HTMLElement>()
  const footer = shallowRef<FormItemExpose>()
  onScopeDispose(renderer.trackError(path, () => footer.value?.error))

  /** The items of this list, not of lists inside it nor ones still animating out. */
  const itemElements = () =>
    [...(root.value?.querySelectorAll<HTMLElement>('.dou-form-renderer__list-item') ?? [])].filter(
      (el) =>
        el.closest('.dou-form-renderer__list') === root.value && !el.closest('[class*="-leave-"]'),
    )
  /** Focus the first field of an item, or the add button when there is none. */
  async function focusItem(index: number) {
    // The sortable list renders its items a tick after the value changes.
    await nextTick()
    await nextTick()
    const elements = itemElements()
    const target = elements[Math.min(index, elements.length - 1)]
    const control = target?.querySelector<HTMLElement>(
      ':scope > .dou-form-renderer__grid :is(input, textarea, select, button, [tabindex="0"]):not([disabled])',
    )
    ;(control ?? root.value?.querySelector<HTMLElement>('.dou-form-renderer__list-add'))?.focus()
  }
  function add() {
    write([...items.value, emptyItem(list(), renderer.fields())])
    void focusItem(items.value.length - 1)
  }
  function remove(index: number) {
    write(items.value.filter((_, at) => at !== index))
    void focusItem(index)
  }

  return () => {
    const node = list()
    const rows = items.value
    const messages = renderer.messages()
    // Read-only controls (a read-only builder's settings) show the items without the buttons too.
    const readonly = renderer.readonly() || renderer.controlsReadonly()
    const off = disabled.value
    const canAdd = !off && (node.max === undefined || rows.length < node.max)
    const canRemove = !off && rows.length > (node.min ?? 0)
    const sortable = node.sortable !== false && !off && !readonly && rows.length > 1
    const labelId = node.label ? `dou-form-list-${uid}` : undefined
    const required = node.required || rules.value.some((rule) => rule.required)
    return h(
      'div',
      {
        ref: root,
        class: ['dou-form-renderer__list', off && 'is-disabled', readonly && 'is-readonly'],
        role: 'group',
        'aria-labelledby': labelId,
        'aria-disabled': off || undefined,
      },
      [
        node.label || node.help
          ? h('div', { class: 'dou-form-renderer__section-header' }, [
              node.label &&
                h(
                  'div',
                  {
                    id: labelId,
                    class: ['dou-form-renderer__section-title', required && 'is-required'],
                  },
                  node.label,
                ),
              node.help && h('div', { class: 'dou-form-renderer__section-description' }, node.help),
            ])
          : null,
        rows.length
          ? h(
              DouSortable,
              {
                class: 'dou-form-renderer__list-items',
                modelValue: rows,
                'onUpdate:modelValue': (next: unknown[]) =>
                  write(next as Record<string, unknown>[]),
                itemKey,
                ghost: listGhost,
                handle: true,
                disabled: !sortable,
                itemLabel: (_item: unknown, index: number) =>
                  formatMessage(messages.item, { index: index + 1 }),
              },
              {
                default: ({ item, index }: { item: Record<string, unknown>; index: number }) => {
                  // While dragging, `index` is the place the item is shown at;
                  // its fields still read and write the place it holds in the value.
                  const raw = toRaw(item)
                  const at = rows.findIndex((row) => toRaw(row) === raw)
                  return h(ListItemView, {
                    list: node,
                    render: kit.renderNodes,
                    path: path(),
                    item,
                    index: at < 0 ? index : at,
                    position: index,
                    columns: node.columns ?? props.columns,
                    inset: props.inset + 1,
                    blocked: blocked.value,
                    sortable,
                    canRemove,
                    readonly,
                    onRemove: () => remove(at < 0 ? index : at),
                  })
                },
              },
            )
          : h(
              'div',
              { class: 'dou-form-renderer__list-empty' },
              readonly ? messages.noValue : messages.empty,
            ),
        // After the items, so a reset puts their values back before the
        // list puts back its own items; its errors show under the button.
        readonly
          ? null
          : h(
              DouFormItem,
              {
                ref: footer,
                class: 'dou-form-renderer__list-footer',
                prop: path(),
                rules: rules.value,
              },
              () =>
                h(
                  DouButton,
                  {
                    class: 'dou-form-renderer__list-add',
                    variant: 'outline',
                    disabled: !canAdd,
                    onClick: add,
                  },
                  { leading: () => h(PlusIcon), default: () => node.addText ?? messages.add },
                ),
            ),
      ],
    )
  }
}

/** One item of a list: its fields read and write the item. */
const ListItemView = defineComponent({
  name: 'DouFormListItem',
  props: {
    list: { type: Object as PropType<FormListNode>, required: true },
    render: { type: Function as PropType<NodeKit['renderNodes']>, required: true },
    path: { type: String, required: true },
    item: { type: Object as PropType<Record<string, unknown>>, required: true },
    /** Where the item is in the value. */
    index: { type: Number, required: true },
    /** Where the item is shown, which differs while it is dragged. */
    position: { type: Number, required: true },
    columns: { type: Number, required: true },
    inset: { type: Number, required: true },
    blocked: { type: Object as PropType<ReadonlySet<string>>, required: true },
    sortable: Boolean,
    canRemove: Boolean,
    /** Without the remove button. */
    readonly: Boolean,
  },
  emits: ['remove'],
  setup(props, { emit }) {
    const renderer = inject(rendererKey)!
    provide(scopeKey, {
      prefix: () => `${props.path}.${props.index}.`,
      item: () => props.item,
      blocked: () => props.blocked,
    })
    return () => {
      const messages = renderer.messages()
      const number = props.position + 1
      return h('div', { class: 'dou-form-renderer__list-item' }, [
        h('div', { class: 'dou-form-renderer__list-item-header' }, [
          props.sortable
            ? h(DouSortableHandle, {
                class: 'dou-form-renderer__list-handle',
                label: formatMessage(messages.move, { index: number }),
              })
            : null,
          h(
            'span',
            { class: 'dou-form-renderer__list-item-title' },
            formatMessage(messages.item, { index: number }),
          ),
          props.readonly
            ? null
            : h(
                DouButton,
                {
                  class: 'dou-form-renderer__list-remove',
                  variant: 'ghost',
                  size: 'sm',
                  disabled: !props.canRemove,
                  'aria-label': formatMessage(messages.remove, { index: number }),
                  onClick: () => emit('remove'),
                },
                { leading: () => h(TrashIcon) },
              ),
        ]),
        h(
          'div',
          { class: 'dou-form-renderer__grid', style: { '--dou-form-columns': props.columns } },
          props.render(props.list.children, props.columns, props.inset),
        ),
      ])
    }
  },
})
