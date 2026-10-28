<script setup lang="ts">
import { computed, useId, useSlots } from 'vue'
import { getTabbable } from '../../composables/use-focus-trap'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import type { PopoverExpose, PopoverProps, PopoverSlots } from './popover'

defineOptions({ name: 'DouPopover', inheritAttrs: false })

const props = withDefaults(defineProps<PopoverProps>(), {
  placement: 'bottom',
  trigger: 'click',
  disabled: false,
  showDelay: 100,
  hideDelay: 150,
  offset: 8,
  teleport: 'body',
})
const open = defineModel<boolean>('open', { default: false })
defineSlots<PopoverSlots>()
const slots = useSlots()

const ns = useNamespace('popover')
const id = `dou-popover-${useId()}`
const titleId = `${id}-title`
const hasTitle = computed(() => !!props.title || !!slots.title)

const popup = usePopup({
  open,
  trigger: () => props.trigger,
  disabled: () => props.disabled,
  placement: () => props.placement,
  offset: () => props.offset,
  showDelay: () => props.showDelay,
  hideDelay: () => props.hideDelay,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle, panelListeners } = popup

// The panel lives at the end of <body>, away from the trigger in tab
// order. `Tab` from the trigger steps into the panel, and stepping out of
// either end of the panel lands back on the trigger, from where the
// browser carries on as usual.
function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab' || event.shiftKey || !open.value || !panelRef.value) return
  const first = getTabbable(panelRef.value)[0]
  if (!first) return
  event.preventDefault()
  first.focus()
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !panelRef.value) return
  const tabbable = getTabbable(panelRef.value)
  const trigger = popup.reference() as HTMLElement | null
  if (event.shiftKey && document.activeElement === tabbable[0]) {
    event.preventDefault()
    trigger?.focus()
  } else if (!event.shiftKey && document.activeElement === tabbable.at(-1)) {
    trigger?.focus()
    popup.hide()
  }
}

const triggerProps = computed(() => ({
  ...popup.triggerListeners.value,
  onKeydown: onTriggerKeydown,
  'aria-haspopup': 'dialog',
  'aria-expanded': props.trigger === 'hover' ? undefined : open.value,
  'aria-controls': rendered.value ? id : undefined,
}))

const panelClasses = computed(() => [ns.b(), 'dou-floating', ns.is('titled', hasTitle.value)])
const width = computed(() =>
  typeof props.width === 'number' ? `${props.width}px` : (props.width ?? undefined),
)

defineExpose<PopoverExpose>({ open: () => popup.show(), close: () => popup.hide() })
</script>

<template>
  <OnlyChild ref="triggerRef" v-bind="triggerProps"><slot /></OnlyChild>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition name="dou-floating">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="dialog"
        :aria-labelledby="hasTitle ? titleId : undefined"
        :class="panelClasses"
        :style="[panelStyle, { width }]"
        :data-placement="placement"
        :data-dou-theme="theme"
        v-bind="{ ...$attrs, ...panelListeners }"
        @keydown="onPanelKeydown"
      >
        <div v-if="hasTitle" :id="titleId" :class="ns.e('title')">
          <slot name="title">{{ title }}</slot>
        </div>
        <div :class="ns.e('content')">
          <slot name="content" :close="() => popup.hide()">{{ content }}</slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
