import {
  cloneValue,
  getPath,
  isContainer,
  isList,
  setPath,
  unsetPath,
  valueNodes,
} from './document'
import { truthy, tryCompileExpression } from './expression'
import type { FormFunction } from './expression'
import type { FormDocument, FormFieldNode, FormListNode, FormNode } from './types'
import { fieldProps } from '../fields/define'
import type { FormFieldType } from '../fields/define'

/** The value a field starts with: its own default, else its type's empty value. */
export function startValue(type: FormFieldType, node: FormFieldNode): unknown {
  if (node.default !== undefined) return cloneValue(node.default)
  return type.empty ? type.empty(fieldProps(type, node)) : null
}

/** The items a list starts with: its default, else `min` empty items. */
function startItems(list: FormListNode, types: Map<string, FormFieldType>) {
  if (list.default !== undefined) return cloneValue(list.default)
  return Array.from({ length: Math.max(0, list.min ?? 0) }, () => emptyItem(list, types))
}

/** A new item of a list, every field at its starting value. */
export function emptyItem(
  list: FormListNode,
  types: Map<string, FormFieldType>,
): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  fillValues(list.children, item, types)
  return item
}

/**
 * Give every field of `nodes` that `target` has no value for its starting
 * value, the items of lists included. Values already there stay.
 */
export function fillValues(
  nodes: readonly FormNode[],
  target: Record<string, unknown>,
  types: Map<string, FormFieldType>,
) {
  for (const node of valueNodes(nodes)) {
    if (isList(node)) {
      let items = getPath(target, node.name)
      if (!Array.isArray(items)) {
        setPath(target, node.name, startItems(node, types))
        items = getPath(target, node.name)
      }
      for (const item of items as unknown[])
        if (item !== null && typeof item === 'object')
          fillValues(node.children, item as Record<string, unknown>, types)
      continue
    }
    const type = types.get(node.type)
    if (!type || type.kind === 'display') continue
    if (getPath(target, node.name!) === undefined)
      setPath(target, node.name!, startValue(type, node))
  }
}

export interface VisibleValuesOptions {
  /** Functions the expressions can call besides the built-in ones. */
  functions?: Record<string, FormFunction>
}

/**
 * A copy of the values without the ones of hidden fields: a field, group,
 * page or list whose `visibleWhen` is false leaves out everything it
 * holds, item by item inside lists. This is what the renderer submits.
 */
export function visibleValues(
  document: FormDocument,
  model: Record<string, unknown>,
  options: VisibleValuesOptions = {},
): Record<string, unknown> {
  const copy = cloneValue(model)
  const shown = (node: FormNode, prefix: string, item: unknown) => {
    if (!node.visibleWhen) return true
    const expression = tryCompileExpression(node.visibleWhen)
    if (!expression) return true
    const name = isList(node) || !isContainer(node) ? (node as { name?: string }).name : undefined
    return truthy(
      expression.evaluate({
        values: model,
        value: name ? getPath(model, prefix + name) : null,
        item,
        functions: options.functions,
      }),
    )
  }
  const drop = (nodes: readonly FormNode[], prefix: string) => {
    for (const node of valueNodes(nodes)) unsetPath(copy, prefix + node.name!)
  }
  const visit = (nodes: readonly FormNode[], prefix: string, item: unknown) => {
    for (const node of nodes) {
      if (!shown(node, prefix, item)) {
        drop([node], prefix)
        continue
      }
      if (isList(node)) {
        const items = getPath(model, prefix + node.name)
        if (Array.isArray(items))
          items.forEach((entry, index) =>
            visit(node.children, `${prefix}${node.name}.${index}.`, entry),
          )
      } else if (isContainer(node)) visit(node.children, prefix, item)
    }
  }
  visit(document.nodes, '', null)
  return copy
}
