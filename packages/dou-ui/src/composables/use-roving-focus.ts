import { onMounted, onUpdated, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

export type RovingOrientation = 'horizontal' | 'vertical'

export interface UseRovingFocusOptions {
  /** Which arrow keys move focus. Defaults to `horizontal`. */
  orientation?: MaybeRefOrGetter<RovingOrientation>
  /** Turn it off, e.g. when an outer container already moves focus. */
  enabled?: MaybeRefOrGetter<boolean>
  /** Go from the last item back to the first and the other way. Defaults to `true`. */
  loop?: boolean
}

const ITEMS = 'button, a[href], input, select, textarea, [tabindex]'
/** Marks the controls this composable manages, whose `tabindex` it rewrites. */
const MARK = 'data-dou-roving'

/** Fields where the arrow keys move the text cursor rather than focus. */
function isTextField(element: Element) {
  if (element instanceof HTMLTextAreaElement || (element as HTMLElement).isContentEditable) {
    return true
  }
  return (
    element instanceof HTMLInputElement &&
    !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
      element.type,
    )
  )
}

/**
 * Keep one control of a container in the Tab order and move focus between
 * them with the arrow keys, Home and End. The control that last had focus
 * is the one Tab returns to. Controls are found in the DOM, so anything
 * focusable inside takes part; disabled ones are skipped.
 */
export function useRovingFocus(
  container: Readonly<Ref<HTMLElement | null>>,
  options: UseRovingFocusOptions = {},
) {
  const { loop = true } = options
  let current: HTMLElement | null = null

  function items() {
    const root = container.value
    if (!root) return []
    // Controls that keep themselves out of the Tab order (a clear button
    // inside an input, say) stay out.
    return Array.from(root.querySelectorAll<HTMLElement>(ITEMS)).filter(
      (element) =>
        !(element as HTMLButtonElement).disabled &&
        element.getAttribute('aria-disabled') !== 'true' &&
        (element.hasAttribute(MARK) || element.tabIndex >= 0),
    )
  }

  function sync() {
    if (toValue(options.enabled) === false) return
    const list = items()
    if (!list.length) return
    if (!current || !list.includes(current)) current = list[0]!
    for (const element of list) {
      element.setAttribute(MARK, '')
      element.tabIndex = element === current ? 0 : -1
    }
  }

  function onFocusin(event: FocusEvent) {
    const target = event.target as HTMLElement
    if (items().includes(target)) {
      current = target
      sync()
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (toValue(options.enabled) === false || event.defaultPrevented) return
    const target = event.target as HTMLElement
    const list = items()
    const index = list.indexOf(target)
    if (index < 0) return
    const vertical = toValue(options.orientation) === 'vertical'
    const back = vertical ? 'ArrowUp' : 'ArrowLeft'
    const forward = vertical ? 'ArrowDown' : 'ArrowRight'
    // A text field keeps its own arrow keys; Home and End move its cursor too.
    if (isTextField(target)) return
    let next: number | undefined
    if (event.key === back) next = index > 0 ? index - 1 : loop ? list.length - 1 : index
    else if (event.key === forward) next = index < list.length - 1 ? index + 1 : loop ? 0 : index
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = list.length - 1
    if (next === undefined) return
    event.preventDefault()
    list[next]!.focus()
  }

  onMounted(() => {
    const root = container.value
    root?.addEventListener('focusin', onFocusin)
    root?.addEventListener('keydown', onKeydown)
    sync()
  })
  onUpdated(sync)

  return { sync }
}
