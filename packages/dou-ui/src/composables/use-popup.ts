import { computed, nextTick, onScopeDispose, ref, toValue, watch } from 'vue'
import type { CSSProperties, ComponentPublicInstance, MaybeRefOrGetter, Ref } from 'vue'
import { useZIndex } from '../components/config-provider/use-config'
import { onlyChildElement } from '../utils/only-child'
import { useFloating } from './use-floating'
import type { Placement, VirtualElement } from './use-floating'
import { useLayer } from './use-layer'
import { useThemeScope } from './use-theme-scope'

/** What opens a floating panel. `manual` leaves it entirely to `v-model:open`. */
export type PopupTrigger = 'hover' | 'click' | 'focus' | 'manual'

export interface UsePopupOptions {
  open: Ref<boolean>
  trigger: MaybeRefOrGetter<PopupTrigger | PopupTrigger[]>
  disabled?: MaybeRefOrGetter<boolean>
  placement: MaybeRefOrGetter<Placement>
  offset?: MaybeRefOrGetter<number>
  sameWidth?: MaybeRefOrGetter<boolean>
  /** Delay before opening on hover, in ms. */
  showDelay?: MaybeRefOrGetter<number>
  /** Delay before closing once the pointer leaves, in ms. */
  hideDelay?: MaybeRefOrGetter<number>
  /** Close on a press outside. Defaults to on for `click` and `focus` triggers. */
  closeOnOutside?: MaybeRefOrGetter<boolean>
  /** What the panel is placed next to, when not the trigger itself (e.g. the pointer). */
  anchor?: () => Element | VirtualElement | null | undefined
}

/**
 * The shared behavior of panels anchored to a trigger: opening on hover,
 * focus or click, closing on `Escape` or a press outside, stacking above
 * other layers and following the trigger around.
 */
export function usePopup(options: UsePopupOptions) {
  const { open } = options
  const triggerRef = ref<ComponentPublicInstance | null>(null)
  const panelRef = ref<HTMLElement | null>(null)
  const reference = () => onlyChildElement(triggerRef.value)

  const triggers = computed(() => {
    const value = toValue(options.trigger)
    return new Set(Array.isArray(value) ? value : [value])
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => clearTimeout(timer)
  function show(delay = 0) {
    clear()
    if (toValue(options.disabled)) return
    if (delay > 0) timer = setTimeout(() => (open.value = true), delay)
    else open.value = true
  }
  function hide(delay = 0) {
    clear()
    if (delay > 0) timer = setTimeout(() => (open.value = false), delay)
    else open.value = false
  }
  onScopeDispose(clear)

  /** Close, handing focus back to the trigger if it was inside the panel. */
  function dismiss() {
    const restore = !!panelRef.value?.contains(document.activeElement)
    hide()
    if (restore) (reference() as HTMLElement | null)?.focus()
  }

  watch(
    () => toValue(options.disabled),
    (disabled) => disabled && hide(),
  )

  // Render the panel the first time it opens, then keep it.
  const rendered = ref(open.value)
  const zIndex = ref<number>()
  const { next } = useZIndex()
  const { theme, sync } = useThemeScope(reference)
  watch(
    open,
    (value) => {
      if (!value) return
      rendered.value = true
      zIndex.value = next()
      void nextTick(sync)
    },
    { immediate: true },
  )

  const floating = useFloating(() => options.anchor?.() ?? reference(), panelRef, {
    open,
    placement: options.placement,
    offset: options.offset,
    sameWidth: options.sameWidth,
  })

  useLayer({
    open,
    elements: () => [reference(), panelRef.value],
    onEscape: dismiss,
    onOutside: () => {
      const close =
        toValue(options.closeOnOutside) ??
        (triggers.value.has('click') || triggers.value.has('focus'))
      if (close) hide()
    },
  })

  const showDelay = () => toValue(options.showDelay) ?? 0
  const hideDelay = () => toValue(options.hideDelay) ?? 0

  const triggerListeners = computed(() => {
    const on: Record<string, (event: Event) => void> = {}
    if (triggers.value.has('hover')) {
      on.onMouseenter = () => show(showDelay())
      on.onMouseleave = () => hide(hideDelay())
    }
    if (triggers.value.has('focus')) {
      on.onFocusin = () => show()
      on.onFocusout = (event) => {
        const related = (event as FocusEvent).relatedTarget
        if (related instanceof Node && panelRef.value?.contains(related)) return
        hide()
      }
    }
    if (triggers.value.has('click')) {
      on.onClick = () => (open.value ? hide() : show())
    }
    return on
  })

  // Moving from the trigger onto the panel keeps a hover panel open.
  const panelListeners = computed(() => {
    if (!triggers.value.has('hover')) return {}
    return {
      onMouseenter: clear,
      onMouseleave: () => hide(hideDelay()),
    }
  })

  const panelStyle = computed<CSSProperties>(() => ({
    ...floating.style.value,
    zIndex: zIndex.value,
  }))

  return {
    triggerRef,
    panelRef,
    reference,
    rendered,
    theme,
    placement: floating.placement,
    panelStyle,
    triggerListeners,
    panelListeners,
    show,
    hide,
    dismiss,
    update: floating.update,
  }
}
