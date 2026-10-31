import { computed, defineComponent, h, inject, provide, shallowRef, useId, watch } from 'vue'
import type { Component, CSSProperties, InjectionKey, PropType, VNode } from 'vue'
import { DouFormItem } from 'dou-ui'
import type { FormItemExpose } from 'dou-ui'
import { getPath, isSection, setPath } from '../core/document'
import { related, truthy, tryCompileExpression } from '../core/expression'
import { rulesOf } from '../core/rules'
import type { FormFieldNode, FormNode, FormResponsive, FormSectionNode } from '../core/types'
import { fieldProps, formFieldKey } from '../fields/define'
import { rendererKey } from './context'
import type { RendererContext } from './context'

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

/** The nodes of one grid: the document's, or a section's. */
export function renderNodes(nodes: readonly FormNode[], columns: number, inset = 0): VNode[] {
  // Keyed by kind too, so a node that turns into a group gets a new view.
  return nodes.map((node) =>
    h(FormNodeView, { key: isSection(node) ? `${node.id}/g` : node.id, node, columns, inset }),
  )
}

/** Whether the groups around a node are disabled. */
const disabledKey: InjectionKey<() => boolean> = Symbol('DouFormNodeDisabled')

/** Whether a component takes a prop, so it is only passed to ones that do. */
function declares(component: Component, prop: string) {
  const props = (component as { props?: unknown }).props
  if (Array.isArray(props)) return props.includes(prop)
  return !!props && typeof props === 'object' && prop in props
}

type NodeProps = { node: FormNode; columns: number; inset: number }

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
    /** How many bordered sections the node sits in; their padding comes off the label column. */
    inset: { type: Number, default: 0 },
  },
  setup(props) {
    const renderer = inject(rendererKey)!
    const parentDisabled = inject(disabledKey, undefined)

    /** An expression of the node, run against the form; `fallback` when it is unset or does not parse. */
    function condition(source: string | undefined, fallback: boolean) {
      if (!source) return fallback
      const expression = tryCompileExpression(source)
      if (!expression) return fallback
      const node = props.node
      const model = renderer.model()
      return truthy(
        expression.evaluate({
          values: model,
          value: !isSection(node) && node.name ? getPath(model, node.name) : null,
          functions: renderer.functions(),
        }),
      )
    }

    const visible = computed(() => condition(props.node.visibleWhen, true))
    const disabled = computed(
      () => !!parentDisabled?.() || condition(props.node.disabledWhen, false),
    )
    const render = isSection(props.node)
      ? sectionView(props, disabled)
      : fieldView(props, renderer, visible, disabled, condition)

    return () => {
      if (!visible.value) return null
      const node = props.node
      return h(
        'div',
        {
          class: 'dou-form-renderer__cell',
          style: spanStyle(node.span, props.columns),
          'data-node': node.id,
        },
        [render()],
      )
    }
  },
})

function sectionView(props: NodeProps, disabled: { readonly value: boolean }) {
  provide(disabledKey, () => disabled.value)
  const uid = useId()
  return () => {
    const node = props.node as FormSectionNode
    const columns = node.columns ?? props.columns
    const titleId = node.title ? `dou-form-section-${uid}` : undefined
    return h(
      'div',
      {
        class: ['dou-form-renderer__section', node.bordered && 'is-bordered'],
        role: 'group',
        'aria-labelledby': titleId,
        'aria-disabled': disabled.value || undefined,
      },
      [
        node.title || node.description
          ? h('div', { class: 'dou-form-renderer__section-header' }, [
              node.title &&
                h('div', { id: titleId, class: 'dou-form-renderer__section-title' }, node.title),
              node.description &&
                h('div', { class: 'dou-form-renderer__section-description' }, node.description),
            ])
          : null,
        h(
          'div',
          { class: 'dou-form-renderer__grid', style: { '--dou-form-columns': columns } },
          renderNodes(node.children, columns, props.inset + (node.bordered ? 1 : 0)),
        ),
      ],
    )
  }
}

function fieldView(
  props: NodeProps,
  renderer: RendererContext,
  visible: { readonly value: boolean },
  disabled: { readonly value: boolean },
  condition: (source: string | undefined, fallback: boolean) => boolean,
) {
  const field = () => props.node as FormFieldNode
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
        arg = expression.evaluate({ values: renderer.model(), functions: renderer.functions() })
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
    const node = field()
    const fitValue = type.value?.fitValue
    if (!fitValue || !node.name || node.source?.keep) return
    const model = renderer.model()
    const value = getPath(model, node.name)
    const fitted = fitValue(value, list)
    if (fitted !== value) setPath(model, node.name, fitted)
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
    rulesOf(field(), { required: required.value, functions: renderer.functions() }),
  )

  // A check that reads other fields runs again when they change, while
  // the field shows an error: an end date stops being wrong once the
  // start date moves before it.
  const checked = computed(() => {
    const { name, rules: specs } = field()
    const paths: string[] = []
    for (const spec of specs ?? []) {
      if (!spec.check) continue
      for (const path of tryCompileExpression(spec.check)?.fields ?? [])
        if (path === '' || !name || !related(name, path)) paths.push(path)
    }
    return paths
  })
  watch(
    () => {
      const paths = checked.value
      if (!paths.length) return undefined
      const model = renderer.model()
      return paths.map((path) => (path ? getPath(model, path) : model))
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
    // A field that holds a formula's result shows it but takes no input.
    if (node.formula) {
      if (declares(spec.component, 'readonly')) bound.readonly = true
      else bound.disabled = true
      // Steppers would only invite a change that cannot be made.
      if (declares(spec.component, 'controls')) bound.controls = false
    }
    const name = node.name
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
