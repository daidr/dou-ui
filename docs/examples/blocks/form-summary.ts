import type { FormDocument, FormNode } from '@dou-ui/form-builder'

/** 提交结果的一行：字段的标签和显示用的文字 */
export interface SummaryLine {
  label: string
  text: string
}

type Option = string | number | { value: unknown; label?: string }

const isContainer = (node: FormNode): node is FormNode & { children: FormNode[] } =>
  'children' in node && Array.isArray(node.children)

/** 按字段的 `options` 把选项的值换成文字 */
function optionText(node: FormNode, value: unknown) {
  const options = ((node as { props?: { options?: Option[] } }).props?.options ?? []) as Option[]
  for (const option of options) {
    if (typeof option === 'object' && option.value === value) return option.label ?? String(value)
    if (option === value) return String(option)
  }
  return String(value)
}

function valueText(node: FormNode, value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (node.type === 'upload' && Array.isArray(value))
    return value.map((file: { name?: string }) => file.name).join('、')
  if (Array.isArray(value)) return value.map((item) => optionText(node, item)).join('、')
  return optionText(node, value)
}

/**
 * 按表单里的顺序和标签列出提交的值。没填的字段和没有标签的字段不列出，
 * 列表字段每一项各占几行。
 */
export function summarize(form: FormDocument, values: Record<string, any>): SummaryLine[] {
  const lines: SummaryLine[] = []
  const visit = (nodes: readonly FormNode[], scope: Record<string, any>, prefix: string) => {
    for (const node of nodes) {
      const name = 'name' in node ? (node.name as string | undefined) : undefined
      const label = 'label' in node ? (node.label as string | undefined) : undefined
      if (node.type === 'list' && name && label) {
        const items = (scope[name] ?? []) as Record<string, any>[]
        items.forEach((item, index) =>
          visit((node as { children: FormNode[] }).children, item, `${label} ${index + 1} · `),
        )
      } else if (isContainer(node)) visit(node.children, scope, prefix)
      else if (name && label) {
        const text = valueText(node, scope[name])
        if (text) lines.push({ label: prefix + label, text })
      }
    }
  }
  visit(form.nodes, values, '')
  return lines
}
