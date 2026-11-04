<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  provide,
  ref,
  useId,
  watch,
} from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useFloating } from '../../composables/use-floating'
import { useLayer } from '../../composables/use-layer'
import { useThemeScope } from '../../composables/use-theme-scope'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild, onlyChildElement } from '../../utils/only-child'
import { useZIndex } from '../config-provider/use-config'
import { dropdownKey } from '../dropdown/dropdown'
import type { DropdownValue } from '../dropdown/dropdown'
import { useMenuKeys } from '../dropdown/menu-keys'
import type { ContextMenuExpose, ContextMenuProps, ContextMenuSlots } from './context-menu'
import DropdownItems from '../dropdown/dropdown-items.vue'
import { useItemsWarning } from '../dropdown/items-warning'
import { findMenuItem } from '../dropdown/menu-entries'
import { useTeleport } from '../../utils/teleport'
import { devWarn } from '../../utils/status-check'

defineOptions({ name: 'DouContextMenu', inheritAttrs: false })

const props = withDefaults(defineProps<ContextMenuProps>(), {
  disabled: false,
  hideOnSelect: true,
  teleport: undefined,
})
const teleportTarget = useTeleport(() => props.teleport)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  select: [value: DropdownValue | undefined]
  'update:target': [target: undefined]
}>()
const slots = defineSlots<ContextMenuSlots>()
useItemsWarning('ContextMenu', () => !!props.items && !!slots.menu)

const ns = useNamespace('context-menu')
const dropdown = useNamespace('dropdown')
const id = `dou-context-menu-${useId()}`

const triggerRef = ref<ComponentPublicInstance | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const trigger = () => onlyChildElement(triggerRef.value)

// The menu hangs off a zero-size box at the point that opened it, or off
// the box it was given, e.g. a button's, so that flipping keeps it clear.
const point = ref({ x: 0, y: 0, width: 0, height: 0 })
const anchor = {
  getBoundingClientRect: () =>
    new DOMRect(point.value.x, point.value.y, point.value.width, point.value.height),
}
const floating = useFloating(() => anchor, panelRef, {
  open,
  placement: 'bottom-start',
  offset: 2,
})

const rendered = ref(open.value)
const zIndex = ref<number>()
const { next } = useZIndex()
const { theme, sync } = useThemeScope(trigger)

// Where focus was before the menu opened, to hand it back on Escape.
let restore: HTMLElement | null = null

watch(open, (value) => {
  if (!value) return
  rendered.value = true
  zIndex.value = next()
  sync()
})

function show(x: number, y: number, box?: { width: number; height: number }) {
  if (props.disabled) return
  point.value = { x, y, width: box?.width ?? 0, height: box?.height ?? 0 }
  if (!open.value) {
    const active = document.activeElement
    restore = active instanceof HTMLElement && !panelRef.value?.contains(active) ? active : null
  }
  open.value = true
  void nextTick(() => {
    floating.update()
    panelRef.value?.focus({ preventScroll: true })
  })
}

function hide() {
  open.value = false
}

function dismiss() {
  // Focus in a submenu counts as in the menu too.
  const active = document.activeElement as HTMLElement | null
  const back = !!(panelRef.value?.contains(active) || active?.closest('.dou-dropdown--sub'))
  hide()
  if (back) (restore ?? (trigger() as HTMLElement | null))?.focus()
}

// A new right click starts with no target; the events inside set it.
// Listened to on the document so it runs before them, whatever element the
// trigger renders now.
function onDocumentContextmenu(event: MouseEvent) {
  if (props.disabled) return
  const el = trigger()
  if (el && event.target instanceof Node && el.contains(event.target))
    emit('update:target', undefined)
}
onMounted(() => document.addEventListener('contextmenu', onDocumentContextmenu, true))
onBeforeUnmount(() => document.removeEventListener('contextmenu', onDocumentContextmenu, true))

function onContextmenu(event: MouseEvent) {
  if (props.disabled) return
  if (!press?.fired) cancelPress()
  // Something inside handled this right click already, or the app said no:
  // `false` leaves it to the browser or an outer menu, `preventDefault()` to no one.
  if (event.defaultPrevented) return
  const allowed = props.beforeOpen?.(event)
  if (
    process.env.NODE_ENV !== 'production' &&
    typeof (allowed as unknown as PromiseLike<unknown> | undefined)?.then === 'function'
  )
    devWarn(
      '[dou-ui] DouContextMenu: `beforeOpen` must decide on the spot (return true or false); a Promise is ignored and the menu opens.',
    )
  if (allowed === false || event.defaultPrevented) return
  event.preventDefault()
  // A menu opened from the keyboard has no pointer position: open it at
  // the bottom left of the focused element instead.
  if (event.button === -1 || (event.clientX === 0 && event.clientY === 0)) {
    const source = event.target instanceof Element ? event.target : trigger()
    const box = source?.getBoundingClientRect()
    show(box?.left ?? 0, box?.bottom ?? 0)
    return
  }
  show(event.clientX, event.clientY)
}

/*
 * A long press opens the menu on touch screens. Safari on iOS never sends
 * `contextmenu` for one, so the press sends its own from where the finger
 * went down: listeners that note which item was pressed keep working.
 * Moving the finger first scrolls instead; the click that follows the press
 * is swallowed so it does not choose the item now under the finger.
 */
const LONG_PRESS = 500
const SLOP = 8
interface Press {
  x: number
  y: number
  timer: number
  el: HTMLElement
  origin: Element
  style: string | null
  fired: boolean
}
let press: Press | null = null

function onPointerdown(event: PointerEvent) {
  if (props.disabled || event.pointerType === 'mouse' || !event.isPrimary) return
  cancelPress()
  const el = event.currentTarget as HTMLElement
  const origin = event.target instanceof Element ? event.target : el
  const { clientX: x, clientY: y } = event
  // keep the press from selecting text or raising the system callout
  const style = el.getAttribute('style')
  el.style.setProperty('-webkit-touch-callout', 'none')
  el.style.setProperty('-webkit-user-select', 'none')
  el.style.setProperty('user-select', 'none')
  const timer = window.setTimeout(() => {
    if (!press) return
    press.fired = true
    window.getSelection()?.removeAllRanges()
    const from = press.origin.isConnected ? press.origin : el
    from.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 2,
        buttons: 0,
        clientX: x,
        clientY: y,
      }),
    )
  }, LONG_PRESS)
  press = { x, y, timer, el, origin, style, fired: false }
  window.addEventListener('pointermove', onPressMove, { passive: true })
  window.addEventListener('pointerup', onPressEnd)
  window.addEventListener('pointercancel', cancelPress)
}

function onPressMove(event: PointerEvent) {
  if (press && !press.fired && Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP)
    cancelPress()
}

function onPressEnd() {
  if (press?.fired) swallowClick()
  cancelPress()
}

function cancelPress() {
  if (!press) return
  window.clearTimeout(press.timer)
  if (press.style === null) press.el.removeAttribute('style')
  else press.el.setAttribute('style', press.style)
  press = null
  window.removeEventListener('pointermove', onPressMove)
  window.removeEventListener('pointerup', onPressEnd)
  window.removeEventListener('pointercancel', cancelPress)
}

function swallow(event: Event) {
  event.preventDefault()
  event.stopPropagation()
}

/** Drop the click the lifted finger may still produce. */
function swallowClick() {
  window.addEventListener('click', swallow, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400)
}

onScopeDispose(cancelPress)

useLayer({
  open,
  elements: () => [panelRef.value],
  onEscape: dismiss,
  onOutside: hide,
})

// The menu stays where it was opened, so scrolling the page under it closes it.
function onScroll(event: Event) {
  if (event.target instanceof Node && panelRef.value?.contains(event.target)) return
  hide()
}
watch(open, (value) => {
  if (typeof window === 'undefined') return
  const method = value ? 'addEventListener' : 'removeEventListener'
  window[method]('scroll', onScroll, { capture: true, passive: true })
  window[method]('resize', hide)
  window[method]('blur', hide)
})
onScopeDispose(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', onScroll, { capture: true })
  window.removeEventListener('resize', hide)
  window.removeEventListener('blur', hide)
})

const onMenuKeydown = useMenuKeys(
  () => panelRef.value,
  () => dismiss(),
)

provide(dropdownKey, {
  select(value) {
    findMenuItem(props.items, value)?.run?.()
    emit('select', value)
    if (props.hideOnSelect) dismiss()
  },
  opened: () => open.value,
  hold: () => {},
  release: () => {},
})

const panelStyle = computed(() => ({ ...floating.style.value, zIndex: zIndex.value }))

defineExpose<ContextMenuExpose>({ open: show, close: hide })
</script>

<template>
  <OnlyChild ref="triggerRef" @contextmenu="onContextmenu" @pointerdown="onPointerdown">
    <slot />
  </OnlyChild>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="menu"
        tabindex="-1"
        :class="[dropdown.b(), ns.b(), 'dou-floating']"
        :style="panelStyle"
        :data-placement="floating.placement.value"
        :data-dou-theme="theme"
        v-bind="$attrs"
        @keydown="onMenuKeydown"
        @contextmenu.prevent
      >
        <slot name="menu"><DropdownItems v-if="props.items" :items="props.items" /></slot>
      </div>
    </Transition>
  </Teleport>
</template>
