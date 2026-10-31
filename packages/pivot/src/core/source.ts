import { useLocale } from 'dou-ui'
import { computed, markRaw, toRaw, toValue, type MaybeRefOrGetter } from 'vue'
import { PivotSource } from '../engine'
import type { PivotField } from '../engine/types'

interface Entry {
  fields: readonly PivotField<never>[] | undefined
  locale: string
  source: PivotSource<never>
}

/**
 * Sources by records, shared by every component on the page: a table and
 * its field panel given the same array read each field only once.
 */
const sources = new WeakMap<object, Entry[]>()

/** Whether two field lists describe the fields the same way (inline arrays are new each render). */
export function sameFields(a?: readonly PivotField<never>[], b?: readonly PivotField<never>[]) {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((f, i) => {
    const g = b[i]!
    return (
      f.name === g.name &&
      f.label === g.label &&
      f.type === g.type &&
      f.value === g.value &&
      f.format === g.format &&
      f.order === g.order
    )
  })
}

/** The records as a `PivotSource`, read again only when the array, the fields or the locale change. */
export function usePivotSource<Row>(
  data: MaybeRefOrGetter<readonly Row[]>,
  fields: MaybeRefOrGetter<readonly PivotField<Row>[] | undefined>,
) {
  const { locale } = useLocale()
  return computed<PivotSource<Row>>(() => {
    const rows = toRaw(toValue(data))
    const given = toValue(fields)
    const list = (given && toRaw(given)) as readonly PivotField<never>[] | undefined
    const name = locale.value.name
    let entries = sources.get(rows)
    if (!entries) sources.set(rows, (entries = []))
    const hit = entries.find((e) => e.locale === name && sameFields(e.fields, list))
    if (hit) return hit.source as unknown as PivotSource<Row>
    const source = markRaw(
      new PivotSource<Row>(rows, { fields: list as readonly PivotField<Row>[], locale: name }),
    )
    // a few versions at most: the newest fields replace the oldest
    entries.push({ fields: list, locale: name, source: source as unknown as PivotSource<never> })
    if (entries.length > 4) entries.shift()
    return source
  })
}
