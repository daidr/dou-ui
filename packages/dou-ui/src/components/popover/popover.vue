<script setup lang="ts">
import { computed, mergeProps, useId, useSlots } from 'vue'
import type { CSSProperties } from 'vue'
import { getTabbable } from '../../composables/use-focus-trap'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { useScopeAttrs } from '../../utils/scope-id'
import type { PopoverExpose, PopoverProps, PopoverSlots } from './popover'
import { useTeleport } from '../../utils/teleport'

defineOptions({ name: 'DouPopover', inheritAttrs: false })

const props = withDefaults(defineProps<PopoverProps>(), {
  placement: 'bottom',
  trigger: 'click',
  disabled: false,
  showDelay: 100,
  hideDelay: 150,
  offset: 8,
  openOnTap: true,
  teleport: undefined,
})
const teleportTarget = useTeleport(() => props.teleport)
const open = defineModel<boolean>('open', { default: false })
defineSlots<PopoverSlots>()
const slots = useSlots()

const ns = useNamespace('popover')
const scopeAttrs = useScopeAttrs()
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
  tap: () => props.openOnTap,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle, panelListeners } = popup

// The panel lives at the end of <body>, away from the trigger in tab
// order. `Tab` from the trigger steps into the panel, and stepping out of
// either end of the panel lands back on the trigger, from where the
// browser carries on as usual. Leaving the trigger any other way (`Tab`
// with nothing to focus in the panel, or `Shift+Tab`) closes the panel, so
// it doesn't stay open away from the focus.
function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !open.value || !panelRef.value) return
  const first = event.shiftKey ? undefined : getTabbable(panelRef.value)[0]
  if (!first) return popup.hide()
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

// Hover has no keyboard of its own: Enter or Space on the trigger (a click
// with `detail` 0) opens and closes a hover card too, so a screen reader
// can reach it. A link trigger keeps Enter for following the link.
function onTriggerClick(event: MouseEvent) {
  if (props.trigger !== 'hover' || event.detail !== 0 || props.disabled) return
  if ((event.currentTarget as Element | null)?.matches('a[href]')) return
  if (open.value) return popup.hide()
  popup.tapped.value = true
  popup.show()
}

const triggerProps = computed(() =>
  mergeProps(popup.triggerListeners.value, {
    onKeydown: onTriggerKeydown,
    onClick: onTriggerClick,
    'aria-haspopup': 'dialog' as const,
    // a hover card a tap or the keyboard opened stays, like a dialog
    'aria-expanded': props.trigger === 'hover' && !popup.tapped.value ? undefined : open.value,
    'aria-controls': rendered.value ? id : undefined,
  }),
)

const panelClasses = computed(() => [ns.b(), 'dou-floating', ns.is('titled', hasTitle.value)])
// CSS `min()` only accepts <length-percentage>, length math functions and
// var()/env(). Writing unitless strings, intrinsic keywords or malformed values
// into `--dou-popover-max-*` would make `max-width` / `max-height` invalid at
// computed-value time (IACVT) and drop the viewport clamp.
const CSS_LENGTH_PERCENTAGE =
  /^\+?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?:%|px|cm|mm|q|in|pc|pt|r?(?:em|ex|cap|ch|ic|lh)|[sld]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max))$/i
const CSS_MIN_FUNCTION = /^(?:calc|min|max|clamp|round|abs|mod|rem|var|env)\(/i
function isMinCompatibleSize(value: string): boolean {
  if (CSS_LENGTH_PERCENTAGE.test(value)) return true
  if (!CSS_MIN_FUNCTION.test(value) || !value.endsWith(')')) return false
  const openIndex = value.indexOf('(')
  if (!value.slice(openIndex + 1, -1).trim()) return false
  let depth = 0
  for (let i = openIndex; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') {
      depth--
      if (depth === 0) return i === value.length - 1
      if (depth < 0) return false
    }
  }
  return false
}
const cssSize = (value: string | number | undefined) => {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 ? `${value}px` : undefined
  const trimmed = value?.trim()
  return trimmed || undefined
}
const panelSizeStyle = computed<CSSProperties>(() => {
  const width = cssSize(props.width)
  const maxHeight = cssSize(props.maxHeight)
  return {
    width,
    ...(width !== undefined &&
      isMinCompatibleSize(width) && {
        '--dou-popover-max-width': width,
      }),
    ...(maxHeight !== undefined &&
      isMinCompatibleSize(maxHeight) && {
        '--dou-popover-max-height': maxHeight,
      }),
  }
})

defineExpose<PopoverExpose>({ open: () => popup.show(), close: () => popup.dismiss() })
</script>

<template>
  <OnlyChild ref="triggerRef" v-bind="triggerProps"><slot /></OnlyChild>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="dialog"
        :aria-labelledby="hasTitle ? titleId : undefined"
        :class="panelClasses"
        :style="[panelStyle, panelSizeStyle]"
        :data-placement="placement"
        :data-dou-theme="theme"
        v-bind="{ ...scopeAttrs(), ...$attrs, ...panelListeners }"
        @keydown="onPanelKeydown"
      >
        <div v-if="hasTitle" :id="titleId" :class="ns.e('title')">
          <slot name="title">{{ title }}</slot>
        </div>
        <div :class="ns.e('content')">
          <slot name="content" :close="popup.dismiss">{{ content }}</slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
