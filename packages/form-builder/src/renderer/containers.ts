import {
  computed,
  defineComponent,
  h,
  inject,
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
import type { FormRule, StepItem } from 'dou-ui'
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
          h(DouTabPanel, { key: node.id, value: node.id, label: node.title, eager: true }, () =>
            pageOf(kit, node, props),
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

  function go(index: number) {
    const target = pages.value[index]
    if (!target) return
    chosen.value = target.id
    reached.value = Math.max(reached.value, index)
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
      go(current.value + 1)
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
    const items: StepItem[] = list.map((step, at) => ({
      title: step.title,
      disabled: at > reached.value,
    }))
    const footer: VNodeChild[] = []
    if (index > 0)
      footer.push(
        h(
          DouButton,
          { key: 'prev', variant: 'outline', onClick: () => go(index - 1) },
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
          { key: node.id, class: 'dou-form-renderer__step', hidden: at !== index || undefined },
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

/** The rules of a list itself: its own, and its bounds on the number of items. */
function listRules(node: FormListNode, renderer: RendererContext): FormRule[] {
  const rules = rulesOf(node, { functions: renderer.functions() })
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
        `[dou-ui] form formulas of list "${list().name}" read each other in a circle (${cycle.join(' -> ')}); they are not worked out`,
      )
    return new Set(cycles.flat())
  })
  const rules = computed(() => listRules(list(), renderer))

  function write(next: Record<string, unknown>[]) {
    const name = path()
    setPath(renderer.model(), name, next)
    renderer.changed(name, getPath(renderer.model(), name))
  }
  const add = () => write([...items.value, emptyItem(list(), renderer.fields())])
  const remove = (index: number) => write(items.value.filter((_, at) => at !== index))

  return () => {
    const node = list()
    const rows = items.value
    const messages = renderer.messages()
    const off = disabled.value
    const canAdd = !off && (node.max === undefined || rows.length < node.max)
    const canRemove = !off && rows.length > (node.min ?? 0)
    const sortable = node.sortable !== false && !off && rows.length > 1
    const labelId = node.label ? `dou-form-list-${uid}` : undefined
    const required = node.required || rules.value.some((rule) => rule.required)
    return h(
      'div',
      {
        class: ['dou-form-renderer__list', off && 'is-disabled'],
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
                handle: true,
                disabled: !sortable,
                itemLabel: (_item: unknown, index: number) =>
                  formatMessage(messages.item, { index: index + 1 }),
              },
              {
                default: ({ item, index }: { item: Record<string, unknown>; index: number }) =>
                  h(ListItemView, {
                    list: node,
                    render: kit.renderNodes,
                    path: path(),
                    item,
                    index,
                    columns: node.columns ?? props.columns,
                    inset: props.inset + 1,
                    blocked: blocked.value,
                    sortable,
                    canRemove,
                    onRemove: () => remove(index),
                  }),
              },
            )
          : h('div', { class: 'dou-form-renderer__list-empty' }, messages.empty),
        // After the items, so a reset puts their values back before the
        // list puts back its own items; its errors show under the button.
        h(
          DouFormItem,
          { class: 'dou-form-renderer__list-footer', prop: path(), rules: rules.value },
          () =>
            h(
              DouButton,
              { variant: 'outline', disabled: !canAdd, onClick: add },
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
    index: { type: Number, required: true },
    columns: { type: Number, required: true },
    inset: { type: Number, required: true },
    blocked: { type: Object as PropType<ReadonlySet<string>>, required: true },
    sortable: Boolean,
    canRemove: Boolean,
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
      const number = props.index + 1
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
          h(
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
