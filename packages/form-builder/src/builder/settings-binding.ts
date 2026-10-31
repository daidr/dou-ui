import { reactive, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { cloneValue, getPath, isList, setPath, unsetPath, valueNodes } from '../core/document'
import { equalValues, isEmptyValue } from '../core/expression'
import { startValue } from '../core/values'
import type { FormDocument, FormNode } from '../core/types'
import type { FormFieldType } from '../fields/define'

type Data = Record<string, unknown>

/**
 * Edit an object (a node, its `props`, or the document's settings)
 * through a settings form. The form's values start as a copy of the
 * object; when one changes, the keys it touches are handed to `apply`
 * as a patch. A setting set back to what leaving it out means (its
 * `default`, or empty) is left out of the object again.
 */
export function useSettingsBinding(options: {
  source: () => Data | undefined
  /** What the object belongs to, e.g. the node's id: a new key shows a new copy even if the object is the same. */
  key?: () => unknown
  form: () => FormDocument
  fields: () => Map<string, FormFieldType>
  /** Prepare a copy of the object for the form, e.g. turn plain options into objects. */
  prepare?: (data: Data) => Data
  /** Write the patch; returns the object as it now is. */
  apply: (patch: Data) => Data | undefined
}): Ref<Data> {
  const model = shallowRef<Data>(reactive({}))
  /** The object the last patch made, which the form already shows. */
  let own: Data | undefined

  watch(
    [options.source, () => options.key?.()],
    ([data, key], previous) => {
      if (data && data === own && previous?.[1] === key) return
      own = undefined
      const copy = cloneValue(data ?? {}) as Data
      model.value = reactive(options.prepare ? options.prepare(copy) : copy)
    },
    { immediate: true },
  )

  /** What leaving a setting out means: its default, else its type's empty value. */
  function fallback(node: FormNode) {
    if (isList(node)) return node.default ?? []
    const type = options.fields().get(node.type)
    return type && 'name' in node ? startValue(type, node) : undefined
  }

  watch(
    model,
    (values) => {
      const data = options.source() ?? {}
      const patch: Data = {}
      for (const node of valueNodes(options.form().nodes)) {
        const path = node.name!
        const next = getPath(values, path)
        const before = getPath(data, path)
        const base = fallback(node)
        const now = next === undefined ? base : next
        const was = before === undefined ? base : before
        if (equalValues(now, was)) continue
        const drop = equalValues(now, base) || isEmptyValue(now)
        const [key, ...rest] = path.split('.')
        if (!rest.length) {
          patch[key!] = drop ? undefined : cloneValue(now)
          continue
        }
        // A setting inside an object: copy the object and change only that key.
        const top = key!
        const holder = cloneValue((top in patch ? patch[top] : data[top]) ?? {}) as Data
        if (drop) unsetPath(holder, rest.join('.'))
        else setPath(holder, rest.join('.'), cloneValue(now))
        patch[key!] = isEmptyValue(holder) ? undefined : holder
      }
      if (Object.keys(patch).length) own = options.apply(patch)
    },
    { deep: true },
  )

  return model
}
