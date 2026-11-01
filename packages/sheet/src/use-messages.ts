import { useLocale } from 'dou-ui'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { sheetMessagesFor, type SheetMessages } from './locale'

/**
 * The spreadsheet's texts, picked by the name of DouUI's current locale.
 * Pass `messages` to override any of them.
 */
export function useSheetMessages(override?: MaybeRefOrGetter<Partial<SheetMessages> | undefined>) {
  const { locale } = useLocale()
  return computed<SheetMessages>(() => {
    const base = sheetMessagesFor(locale.value.name)
    const extra = toValue(override)
    if (!extra) return base
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined) continue
      // groups, such as error reasons or function help, can be given one by one
      const own = base[key as keyof SheetMessages]
      out[key] = own && typeof own === 'object' ? { ...own, ...(value as object) } : value
    }
    return out as unknown as SheetMessages
  })
}
