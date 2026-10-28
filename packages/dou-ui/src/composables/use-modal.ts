import { getCurrentInstance, nextTick, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { useZIndex } from '../components/config-provider/use-config'
import { useFocusTrap } from './use-focus-trap'
import { useLayer } from './use-layer'
import { useScrollLock } from './use-scroll-lock'
import { useThemeScope } from './use-theme-scope'

export interface UseModalOptions {
  open: Ref<boolean>
  /** The full-screen layer: mask and panel together. */
  root: Ref<HTMLElement | null>
  /** The panel focus is trapped in. */
  panel: Ref<HTMLElement | null>
  closeOnEscape: MaybeRefOrGetter<boolean>
  closeOnMask: MaybeRefOrGetter<boolean>
  lockScroll: MaybeRefOrGetter<boolean>
  /** Ask to close, e.g. after `Escape` or a press on the mask. */
  requestClose: () => void
}

/**
 * The shared behavior of modal layers: stacked above everything opened
 * before, focus trapped inside, the page behind locked and inert to the
 * pointer, and `Escape` or a press on the mask asking to close.
 */
export function useModal(options: UseModalOptions) {
  const { open, root, panel } = options

  const rendered = ref(open.value)
  const zIndex = ref<number>()
  const { next } = useZIndex()
  const instance = getCurrentInstance()
  const { theme, sync } = useThemeScope(() => instance?.vnode.el as Node | null)
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

  const layer = useLayer({
    open,
    elements: () => [root.value],
    onEscape: () => {
      if (toValue(options.closeOnEscape)) options.requestClose()
    },
  })

  useFocusTrap(panel, {
    active: open,
    contains: layer.contains,
    initialFocus: () => panel.value?.querySelector<HTMLElement>('[autofocus]') ?? panel.value,
  })
  useScrollLock(() => open.value && toValue(options.lockScroll))

  // Only a press that both starts and ends on the mask closes, so dragging
  // a text selection out of the panel does not.
  let pressedMask = false
  const maskListeners = {
    onPointerdown: (event: PointerEvent) => {
      pressedMask = event.target === event.currentTarget
    },
    onClick: (event: MouseEvent) => {
      const onMask = pressedMask && event.target === event.currentTarget
      pressedMask = false
      if (onMask && toValue(options.closeOnMask)) options.requestClose()
    },
  }

  return { rendered, zIndex, theme, maskListeners }
}
