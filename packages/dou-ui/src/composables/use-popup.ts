import { computed, nextTick, onScopeDispose, ref, toValue, watch } from 'vue'
import type { CSSProperties, ComponentPublicInstance, MaybeRefOrGetter, Ref } from 'vue'
import { useZIndex } from '../components/config-provider/use-config'
import { onlyChildElement } from '../utils/only-child'
import { hasHover } from '../utils/pointer'
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
  /**
   * Close on a press outside. Defaults to on for `click` and `focus` triggers,
   * and for a `hover` panel a tap opened.
   */
  closeOnOutside?: MaybeRefOrGetter<boolean>
  /**
   * A finger or a pen has no hover: a tap on the trigger of a `hover` panel
   * without the `click` trigger opens and closes it instead, and a link
   * there is followed only once the panel is open. Defaults to on.
   */
  tap?: MaybeRefOrGetter<boolean>
  /** What the panel is placed next to, when not the trigger itself (e.g. the pointer). */
  anchor?: () => Element | VirtualElement | null | undefined
}

// Hover listens to pointer events and leaves fingers and pens out: a tap
// also sends mouseenter, and the mouseleave that may follow at any time
// (or only with the next tap elsewhere) would close what the tap opened.
const hoverable = (event: Event) => hasHover((event as PointerEvent).pointerType)

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

  // The press the next click comes from, and whether the panel was open
  // then: focus from the same tap may open it before the click arrives.
  let press: { hover: boolean; wasOpen: boolean } | null = null
  /** The panel was opened by a tap, and stays until tapped away. */
  const tapped = ref(false)
  watch(open, (value) => value || (tapped.value = false))

  useLayer({
    open,
    elements: () => [reference(), panelRef.value],
    onEscape: dismiss,
    onOutside: () => {
      const close =
        toValue(options.closeOnOutside) ??
        (triggers.value.has('click') || triggers.value.has('focus') || tapped.value)
      if (close) hide()
    },
  })

  const showDelay = () => toValue(options.showDelay) ?? 0
  const hideDelay = () => toValue(options.hideDelay) ?? 0

  const triggerListeners = computed(() => {
    const on: Record<string, (event: Event) => void> = {}
    if (triggers.value.has('hover')) {
      on.onPointerenter = (event) => hoverable(event) && show(showDelay())
      on.onPointerleave = (event) => hoverable(event) && hide(hideDelay())
      if (!triggers.value.has('click') && (toValue(options.tap) ?? true)) {
        on.onPointerdown = (event) => {
          press = { hover: hoverable(event), wasOpen: open.value }
        }
        // a finger that scrolls the page instead sends no click
        on.onPointercancel = () => (press = null)
        on.onClick = (event) => {
          const from = press
          press = null
          // the keyboard is left to the component, and the mouse has hover;
          // a click with no press before it comes from assistive technology
          if ((event as MouseEvent).detail === 0 || from?.hover) return
          if (from ? from.wasOpen : open.value) return hide()
          // a link opens the panel first; the next tap follows it
          event.preventDefault()
          // before showing: a `v-model:open` only takes the new value later
          tapped.value = !toValue(options.disabled)
          show()
        }
      }
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
      onPointerenter: (event: Event) => hoverable(event) && clear(),
      onPointerleave: (event: Event) => hoverable(event) && hide(hideDelay()),
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
    tapped,
    show,
    hide,
    dismiss,
    update: floating.update,
  }
}
