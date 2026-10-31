import { computed, defineComponent, h, inject, provide, shallowRef, useId, watch } from 'vue'
import type { Component, CSSProperties, PropType, VNode, VNodeChild } from 'vue'
import { DouFormItem } from 'dou-ui'
import type { FormItemExpose } from 'dou-ui'
import {
  cloneValue,
  getPath,
  isContainer,
  isField,
  isList,
  isPage,
  isSteps,
  isTabs,
  setPath,
} from '../core/document'
import { equalValues, related, truthy, tryCompileExpression } from '../core/expression'
import { rulesOf } from '../core/rules'
import type {
  FormFieldNode,
  FormNode,
  FormPageNode,
  FormResponsive,
  FormSectionNode,
} from '../core/types'
import { fieldProps, formFieldKey } from '../fields/define'
import { disabledKey, pathIn, rendererKey, rootScope, scopeKey } from './context'
import type { Condition, NodeKit, NodeProps, NodeScope, RendererContext } from './context'
import { listView, stepsView, tabsView } from './containers'

const breakpoints = ['base', 'sm', 'md', 'lg', 'xl'] as const

/** `--dou-form-span` for `base`, `--dou-form-span-md` for the others. */
const spanVar = (key: (typeof breakpoints)[number]) =>
  key === 'base' ? '--dou-form-span' : `--dou-form-span-${key}`

/** The span of a node at each breakpoint it sets, clamped to the grid. */
export function spanStyle(span: FormResponsive<number> | undefined, columns: number) {
  const style: Record<string, number> = {}
  const clamp = (value: number) => Math.min(Math.max(1, Math.round(value)), columns)
  if (span === undefined) style[spanVar('base')] = columns
  else if (typeof span === 'number') style[spanVar('base')] = clamp(span)
  else {
    style[spanVar('base')] = clamp(span.base ?? columns)
    for (const key of breakpoints.slice(1)) {
      const value = span[key]
      if (value !== undefined) style[spanVar(key)] = clamp(value)
    }
  }
  return style as CSSProperties
}

const warned = new Set<string>()
function warnUnknown(type: string) {
  if (warned.has(type)) return
  warned.add(type)
  console.warn(`[dou-ui] form field type "${type}" is not registered; pass it in \`fields\``)
}

/** The nodes of one grid: the document's, a group's, a page's or a list item's. */
export function renderNodes(nodes: readonly FormNode[], columns: number, inset = 0): VNode[] {
  return nodes.map((node) => h(FormNodeView, { key: nodeKey(node), node, columns, inset }))
}

/** The key of a node's view: by kind too, so a node that turns into another kind gets a new view. */
export const nodeKey = (node: FormNode) => `${node.id}/${isField(node) ? 'field' : node.type}`

/** A page's description and its own grid. */
export function renderPage(page: FormPageNode, columns: number, inset: number) {
  const own = page.columns ?? columns
  return [
    page.description
      ? h('div', { class: 'dou-form-renderer__page-description' }, page.description)
      : null,
    h(
      'div',
      { class: 'dou-form-renderer__grid', style: { '--dou-form-columns': own } },
      renderNodes(page.children, own, inset),
    ),
  ]
}

/** Whether a component takes a prop, so it is only passed to ones that do. */
function declares(component: Component, prop: string) {
  const props = (component as { props?: unknown }).props
  if (Array.isArray(props)) return props.includes(prop)
  return !!props && typeof props === 'object' && prop in props
}

/**
 * One node and its grid cell. A node re-renders only when its own object
 * changes or a value it reads does, so typing in one field leaves the
 * others alone. A hidden node renders nothing: no cell, no form item to
 * check and no options to load.
 */
export const FormNodeView = defineComponent({
  name: 'DouFormNode',
  props: {
    node: { type: Object as PropType<FormNode>, required: true },
    columns: { type: Number, required: true },
    /** How many bordered sections and list items the node sits in; their padding comes off the label column. */
    inset: { type: Number, default: 0 },
    /** A page drawn by its tabs or steps: no cell and no title of its own. */
    asPage: Boolean,
  },
  setup(props) {
    const renderer = inject(rendererKey)!
    const scope = inject(scopeKey, rootScope)
    const parentDisabled = inject(disabledKey, undefined)

    /**
     * An expression of a node (this one by default), run against the form;
     * `fallback` when it is unset or does not parse.
     */
    const condition: Condition = (source, fallback, node = props.node) => {
      if (!source) return fallback
      const expression = tryCompileExpression(source)
      if (!expression) return fallback
      const model = renderer.model()
      const name = isList(node) || isField(node) ? node.name : undefined
      return truthy(
        expression.evaluate({
          values: model,
          value: name ? getPath(model, pathIn(scope, name)) : null,
          item: scope.item(),
          functions: renderer.functions(),
        }),
      )
    }

    const visible = computed(() => condition(props.node.visibleWhen, true))
    const disabled = computed(
      () => !!parentDisabled?.() || condition(props.node.disabledWhen, false),
    )
    const node = props.node
    let render: () => VNodeChild
    if (isTabs(node)) render = tabsView(kit, props, renderer, scope, disabled, condition)
    else if (isSteps(node)) render = stepsView(kit, props, renderer, scope, disabled, condition)
    else if (isList(node)) render = listView(kit, props, renderer, scope, disabled)
    else if (props.asPage && isPage(node)) render = pageView(props, disabled)
    else if (isContainer(node)) render = sectionView(props, disabled)
    else render = fieldView(props, renderer, scope, visible, disabled, condition)

    return () => {
      if (!visible.value) return null
      if (props.asPage) return render()
      const current = props.node
      return h(
        'div',
        {
          class: 'dou-form-renderer__cell',
          style: spanStyle(current.span, props.columns),
          'data-node': current.id,
        },
        [render()],
      )
    }
  },
})

/** A page of tabs or steps. */
function pageView(props: NodeProps, disabled: { readonly value: boolean }) {
  provide(disabledKey, () => disabled.value)
  return () => {
    const page = props.node as FormPageNode
    return h(
      'div',
      { class: 'dou-form-renderer__page', 'data-node': page.id },
      renderPage(page, props.columns, props.inset),
    )
  }
}

/** A section, or a page outside tabs and steps, drawn the same way. */
const kit: NodeKit = { view: FormNodeView, renderNodes }

function sectionView(props: NodeProps, disabled: { readonly value: boolean }) {
  provide(disabledKey, () => disabled.value)
  const uid = useId()
  return () => {
    const node = props.node as FormSectionNode | FormPageNode
    const columns = node.columns ?? props.columns
    const title = node.title
    const bordered = !isPage(node) && node.bordered
    const titleId = title ? `dou-form-section-${uid}` : undefined
    return h(
      'div',
      {
        class: ['dou-form-renderer__section', bordered && 'is-bordered'],
        role: 'group',
        'aria-labelledby': titleId,
        'aria-disabled': disabled.value || undefined,
      },
      [
        title || node.description
          ? h('div', { class: 'dou-form-renderer__section-header' }, [
              title && h('div', { id: titleId, class: 'dou-form-renderer__section-title' }, title),
              node.description &&
                h('div', { class: 'dou-form-renderer__section-description' }, node.description),
            ])
          : null,
        h(
          'div',
          { class: 'dou-form-renderer__grid', style: { '--dou-form-columns': columns } },
          renderNodes(node.children, columns, props.inset + (bordered ? 1 : 0)),
        ),
      ],
    )
  }
}

function fieldView(
  props: NodeProps,
  renderer: RendererContext,
  scope: NodeScope,
  visible: { readonly value: boolean },
  disabled: { readonly value: boolean },
  condition: Condition,
) {
  const field = () => props.node as FormFieldNode
  /** The field's path in the form, e.g. `guests.2.phone` inside a list. */
  const path = () => {
    const name = field().name
    return name ? pathIn(scope, name) : undefined
  }
  const type = computed(() => renderer.fields().get(field().type))
  const item = shallowRef<FormItemExpose>()

  // Options from a source, while the field shows, has a source and its type takes options.
  const request = computed(() => {
    const source = field().source
    const prop = type.value?.optionsProp
    if (!source?.name || !prop || !visible.value) return undefined
    let arg: unknown = null
    if (source.arg) {
      const expression = tryCompileExpression(source.arg)
      if (expression)
        arg = expression.evaluate({
          values: renderer.model(),
          item: scope.item(),
          functions: renderer.functions(),
        })
    }
    const version = renderer.sourceVersion(source.name)
    return { name: source.name, arg, key: `${source.name}\u0000${JSON.stringify(arg)}#${version}` }
  })
  const options = shallowRef<unknown[]>()
  const loading = shallowRef(false)
  /** The request the shown options answer; a value is only fitted to options that replace others. */
  let shown: string | undefined
  watch(
    () => request.value?.key,
    (_key, _old, onCleanup) => {
      const current = request.value
      if (!current) {
        loading.value = false
        return
      }
      let stale = false
      onCleanup(() => (stale = true))
      loading.value = true
      renderer.load(current.name, current.arg).then(
        (list) => {
          if (stale) return
          options.value = list
          loading.value = false
          const replaced = shown !== undefined && shown !== current.key
          shown = current.key
          if (replaced) fit(list)
        },
        () => {
          if (stale) return
          options.value = []
          loading.value = false
        },
      )
    },
    { immediate: true },
  )

  /** Drop a value the new options no longer offer, e.g. a city of the province before. */
  function fit(list: unknown[]) {
    const name = path()
    const fitValue = type.value?.fitValue
    if (!fitValue || !name || field().source?.keep) return
    const model = renderer.model()
    const value = getPath(model, name)
    const fitted = fitValue(value, list)
    if (fitted !== value) setPath(model, name, fitted)
  }

  const settings = computed(() => {
    const base = fieldProps(type.value, field())
    const prop = field().source?.name && type.value?.optionsProp
    return prop ? { ...base, [prop]: options.value ?? [] } : base
  })
  provide(formFieldKey, () => ({ node: field(), type: type.value!, props: settings.value }))

  const required = computed(() => {
    const node = field()
    return condition(node.requiredWhen, node.required ?? false)
  })
  const rules = computed(() =>
    rulesOf(field(), {
      required: required.value,
      functions: renderer.functions(),
      item: scope.prefix() ? scope.item : undefined,
    }),
  )

  // Inside a list, a formula is worked out per item; formulas outside
  // lists are the renderer's, worked out in order across the form.
  if (scope.prefix())
    watch(
      () => {
        const node = field()
        if (!node.formula || !node.name || scope.blocked().has(node.name)) return undefined
        const expression = tryCompileExpression(node.formula)
        return expression
          ? {
              result: expression.evaluate({
                values: renderer.model(),
                item: scope.item(),
                functions: renderer.functions(),
              }),
            }
          : undefined
      },
      (next) => {
        const name = path()
        if (!next || !name) return
        const model = renderer.model()
        if (!equalValues(next.result, getPath(model, name)))
          setPath(model, name, cloneValue(next.result))
      },
      { immediate: true, flush: 'sync' },
    )

  // A check that reads other fields runs again when they change, while
  // the field shows an error: an end date stops being wrong once the
  // start date moves before it.
  const checked = computed(() => {
    const name = path()
    const paths: string[] = []
    for (const spec of field().rules ?? []) {
      if (!spec.check) continue
      const expression = tryCompileExpression(spec.check)
      if (!expression) continue
      for (const read of expression.fields)
        if (read === '' || !name || !related(name, read)) paths.push(read)
      // Other fields of the same item, read through `item`.
      const own = field().name
      for (const read of expression.itemFields)
        if (scope.prefix() && (read === '' || !own || !related(own, read)))
          paths.push(read ? pathIn(scope, read) : scope.prefix().slice(0, -1))
    }
    return paths
  })
  watch(
    () => {
      const paths = checked.value
      if (!paths.length) return undefined
      const model = renderer.model()
      return paths.map((read) => (read ? getPath(model, read) : model))
    },
    () => {
      if (item.value?.error) void item.value.validate()
    },
    { deep: true },
  )

  // Labels inside bordered sections line up with the ones outside: the
  // padding and border of each section come off the label column.
  function labelWidth() {
    const width = renderer.labelWidth()
    if (width === undefined || !props.inset) return width
    return `calc(${width}px - ${props.inset} * (var(--dou-space-lg) + 1px))`
  }

  return () => {
    const node = field()
    const spec = type.value
    if (!spec) {
      warnUnknown(node.type)
      return null
    }
    const bound: Record<string, unknown> = spec.toProps
      ? { ...spec.toProps(settings.value, node) }
      : { ...settings.value }
    if (request.value && declares(spec.component, 'loading')) bound.loading = loading.value
    if (disabled.value) bound.disabled = true
    if (spec.kind === 'display' || !node.name) return h(spec.component, bound)
    const blockedFormula = scope.prefix() && scope.blocked().has(node.name)
    // A field that holds a formula's result shows it but takes no input.
    if (node.formula && !blockedFormula) {
      if (declares(spec.component, 'readonly')) bound.readonly = true
      else bound.disabled = true
      // Steppers would only invite a change that cannot be made.
      if (declares(spec.component, 'controls')) bound.controls = false
    }
    const name = path()!
    const model = renderer.model()
    return h(
      DouFormItem,
      {
        ref: item,
        label: node.label,
        prop: name,
        help: node.help,
        rules: rules.value,
        labelWidth: labelWidth(),
      },
      () =>
        h(spec.component, {
          ...bound,
          modelValue: getPath(model, name),
          'onUpdate:modelValue': (value: unknown) => {
            setPath(model, name, value)
            renderer.changed(name, value)
          },
        }),
    )
  }
}
