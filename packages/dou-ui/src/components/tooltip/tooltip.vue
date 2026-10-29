<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { VirtualElement } from '../../composables/use-floating'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import type { TooltipProps, TooltipSlots } from './tooltip'
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
  if (!props.followCursor || event.pointerType === 'touch') return
  pointer.value = { x: event.clientX, y: event.clientY }
  update()
}

const interactive = computed(() => props.interactive && !props.followCursor)

const triggerProps = computed(() => ({
  ...triggerListeners.value,
  onPointermove,
  'aria-describedby': open.value ? id : undefined,
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
        <slot name="content">{{ content }}</slot>
      </div>
    </Transition>
  </Teleport>
</template>
