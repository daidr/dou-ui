<script setup lang="ts">
import { computed, useId } from 'vue'
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
} = usePopup({
  open,
  trigger: ['hover', 'focus'],
  disabled: () => props.disabled,
  placement: () => props.placement,
  offset: () => props.offset,
  showDelay: () => props.showDelay,
  hideDelay: () => props.hideDelay,
})

const triggerProps = computed(() => ({
  ...triggerListeners.value,
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
        :class="[ns.b(), 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        v-bind="{ ...$attrs, ...panelListeners }"
      >
        <slot name="content">{{ content }}</slot>
      </div>
    </Transition>
  </Teleport>
</template>
