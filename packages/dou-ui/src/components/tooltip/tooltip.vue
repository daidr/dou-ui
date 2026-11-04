<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { ariaHotkey, useApplePlatform } from '../../composables/use-hotkey'
import type { VirtualElement } from '../../composables/use-floating'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { hasHover } from '../../utils/pointer'
import { DouKbd } from '../kbd'
import type { TooltipProps, TooltipSlots } from './tooltip'
import { claimTooltip, releaseTooltip } from './only-one'
import { useTeleport } from '../../utils/teleport'

defineOptions({ name: 'DouTooltip', inheritAttrs: false })

const props = withDefaults(defineProps<TooltipProps>(), {
  placement: 'top',
  disabled: false,
  showDelay: 200,
  hideDelay: 100,
  offset: 6,
  followCursor: false,
  interactive: true,
  teleport: undefined,
})
const teleportTarget = useTeleport(() => props.teleport)
const open = defineModel<boolean>('open', { default: false })
defineSlots<TooltipSlots>()

const ns = useNamespace('tooltip')
const id = `dou-tooltip-${useId()}`

const {
  triggerRef,
  panelRef,
  rendered,
  theme,
  placement,
  panelStyle,
  triggerListeners,
  panelListeners,
  update,
} = usePopup({
  open,
  trigger: ['hover', 'focus'],
  // touch gets no tip, see below
  tap: false,
  disabled: () => props.disabled,
  placement: () => props.placement,
  // keep clear of the pointer itself when following it
  offset: () => props.offset + (props.followCursor ? 10 : 0),
  showDelay: () => props.showDelay,
  hideDelay: () => props.hideDelay,
  anchor: () => (props.followCursor && pointer.value ? cursor : undefined),
})

// with `followCursor`, the tooltip sits next to a point under the pointer
const pointer = ref<{ x: number; y: number } | null>(null)
const cursor: VirtualElement = {
  getBoundingClientRect: () => new DOMRect(pointer.value?.x ?? 0, pointer.value?.y ?? 0, 0, 0),
}
function onPointermove(event: PointerEvent) {
  if (!props.followCursor || !hasHover(event.pointerType)) return
  pointer.value = { x: event.clientX, y: event.clientY }
  update()
}

/*
 * Tooltips that hover or focus opened show one at a time. One opened
 * through `open` from outside (a guide, say) takes no part: it neither
 * closes the others nor is closed by them.
 */
let byTrigger = false
// A tooltip whose trigger left the page without unmounting is just dropped.
const close = () => {
  if ((triggerRef.value?.$el as Node | undefined)?.isConnected !== false) open.value = false
}
watch(open, (value) => {
  if (value && byTrigger) claimTooltip(close)
  else if (!value) {
    releaseTooltip(close)
    byTrigger = false
  }
})
onBeforeUnmount(() => releaseTooltip(close))
/** Marks what follows (the open after the delay) as the trigger's own doing. */
const fromTrigger = (handler?: (event: Event) => void) =>
  handler &&
  ((event: Event) => {
    byTrigger = true
    handler(event)
  })

const interactive = computed(() => props.interactive && !props.followCursor)

const apple = useApplePlatform()

// A tap also brings focus, and phones move it away only with the next tap
// elsewhere, so the tip would stay up over the page. Touch gets no tip, the
// same as a native title (hover already leaves touch out).
let touch = false
const notTouch = (handler?: (event: Event) => void) =>
  handler && ((event: Event) => touch || handler(event))
const leave = (handler?: (event: Event) => void) =>
  handler &&
  ((event: Event) => {
    // the finger lifting is not leaving: the focus from the tap is still to come
    if (hasHover((event as PointerEvent).pointerType ?? 'mouse')) touch = false
    handler(event)
    if (!open.value) byTrigger = false
  })
function onPointerType(event: PointerEvent) {
  touch = !hasHover(event.pointerType)
}
const enter = (handler?: (event: Event) => void) => (event: Event) => {
  onPointerType(event as PointerEvent)
  handler?.(event)
}

// Focus that comes with a press shows no tip: the pointer is already there
// and hovering shows it. Opened at once under the pointer, it could take the
// release, and the click that started it would be lost.
let pressing = false
function onPointerdown(event: PointerEvent) {
  onPointerType(event)
  pressing = true
  setTimeout(() => (pressing = false))
}
const focusin = (handler?: (event: Event) => void) =>
  handler && ((event: Event) => pressing || handler(event))

const triggerProps = computed(() => ({
  ...triggerListeners.value,
  onPointerenter: enter(fromTrigger(triggerListeners.value.onPointerenter)),
  onFocusin: notTouch(focusin(fromTrigger(triggerListeners.value.onFocusin))),
  onPointerleave: leave(triggerListeners.value.onPointerleave),
  onFocusout: leave(triggerListeners.value.onFocusout),
  onPointerdown,
  onPointermove,
  'aria-describedby': open.value ? id : undefined,
  ...(props.shortcut && { 'aria-keyshortcuts': ariaHotkey(props.shortcut, apple.value) }),
}))
</script>

<template>
  <OnlyChild ref="triggerRef" v-bind="triggerProps"><slot /></OnlyChild>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="tooltip"
        :class="[ns.b(), 'dou-floating', ns.is('static', !interactive)]"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        v-bind="{ ...$attrs, ...(interactive ? panelListeners : {}) }"
      >
        <span v-if="shortcut" :class="ns.e('shortcut')">
          <span :class="ns.e('text')"
            ><slot name="content">{{ content }}</slot></span
          >
          <DouKbd size="sm" :keys="shortcut" />
        </span>
        <slot v-else name="content">{{ content }}</slot>
      </div>
    </Transition>
  </Teleport>
</template>
