import { computed, defineComponent, h, inject, provide, useId } from 'vue'
import type { CSSProperties, PropType, VNode } from 'vue'
import { DouFormItem } from 'dou-ui'
import { getPath, isSection, setPath } from '../core/document'
import { rulesOf } from '../core/rules'
import type { FormFieldNode, FormNode, FormResponsive, FormSectionNode } from '../core/types'
import { fieldProps, formFieldKey } from '../fields/define'
import { rendererKey } from './context'

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
  return nodes.map((node) => h(FormNodeView, { key: node.id, node, columns, inset }))
}

/**
 * One node and its grid cell. A node re-renders only when its own object
 * changes or the value at its name does, so typing in one field leaves
 * the others alone.
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
    const type = computed(() =>
      isSection(props.node) ? undefined : renderer.fields().get(props.node.type),
    )
    const settings = computed(() => fieldProps(type.value, props.node as FormFieldNode))
    provide(formFieldKey, () => ({
      node: props.node as FormFieldNode,
      type: type.value!,
      props: settings.value,
    }))
    const uid = useId()

    // Labels inside bordered sections line up with the ones outside: the
    // padding and border of each section come off the label column.
    function labelWidth() {
      const width = renderer.labelWidth()
      if (width === undefined || !props.inset) return width
      return `calc(${width}px - ${props.inset} * (var(--dou-space-lg) + 1px))`
    }

    function renderSection(node: FormSectionNode) {
      const columns = node.columns ?? props.columns
      const titleId = node.title ? `dou-form-section-${uid}` : undefined
      return h(
        'div',
        {
          class: ['dou-form-renderer__section', node.bordered && 'is-bordered'],
          role: 'group',
          'aria-labelledby': titleId,
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

    function renderField(node: FormFieldNode) {
      const spec = type.value
      if (!spec) {
        warnUnknown(node.type)
        return null
      }
      const bound = spec.toProps ? spec.toProps(settings.value, node) : settings.value
      if (spec.kind === 'display' || !node.name) return h(spec.component, bound)
      const name = node.name
      const model = renderer.model()
      return h(
        DouFormItem,
        {
          label: node.label,
          prop: name,
          help: node.help,
          rules: rulesOf(node),
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

    return () => {
      const node = props.node
      return h(
        'div',
        {
          class: 'dou-form-renderer__cell',
          style: spanStyle(node.span, props.columns),
          'data-node': node.id,
        },
        [isSection(node) ? renderSection(node) : renderField(node)],
      )
    }
  },
})
