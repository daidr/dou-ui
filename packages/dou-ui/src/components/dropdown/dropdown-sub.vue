<script setup lang="ts">
import { ChevronRightIcon } from '@dou-ui/icons'
import { computed, inject, nextTick, ref, useId, watch } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { dropdownKey } from './dropdown'
import type { DropdownSubProps, DropdownSubSlots } from './dropdown'
import { menuItems, useMenuKeys } from './menu-keys'

defineOptions({ name: 'DouDropdownSub', inheritAttrs: false })

const props = withDefaults(defineProps<DropdownSubProps>(), {
  disabled: false,
  divided: false,
  placement: 'right-start',
})
const slots = defineSlots<DropdownSubSlots>()

const ns = useNamespace('dropdown')
const id = `dou-dropdown-sub-${useId()}`
const dropdown = inject(dropdownKey, null)

const open = ref(false)
const popup = usePopup({
  open,
  trigger: 'manual',
  disabled: () => props.disabled,
  placement: () => props.placement,
  // Sits just over the edge of the parent menu, level with the item.
  offset: 2,
  closeOnOutside: true,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle } = popup
const item = () => popup.reference() as HTMLElement | null

// It closes with the menu it belongs to.
watch(
  () => dropdown?.opened() ?? true,
  (opened) => !opened && popup.hide(),
)

async function openAndFocus() {
  popup.show()
  await nextTick()
  menuItems(panelRef.value)[0]?.focus()
}

/** Close and put focus back on the item that opened it. */
function back() {
  popup.hide()
  item()?.focus()
}

// The pointer opens it after a short rest on the item, and leaving both
// the item and the submenu closes it. A finger has no hover: a tap opens
// it, and the finger lifting is not leaving.
function onEnter(event: PointerEvent) {
  if (props.disabled || event.pointerType === 'touch') return
  popup.show(100)
}
function onLeave(event: PointerEvent) {
  if (event.pointerType !== 'touch') popup.hide(150)
}

function onPointermove(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement
  if (!props.disabled && document.activeElement !== el) el.focus({ preventScroll: true })
}

function onItemKeydown(event: KeyboardEvent) {
  if (props.disabled || event.key !== 'ArrowRight') return
  event.preventDefault()
  event.stopPropagation()
  void openAndFocus()
}

function onClick(event: MouseEvent) {
  if (props.disabled) return
  // Enter and Space reach here as a click with `detail` 0.
  if (event.detail === 0) void openAndFocus()
  else popup.show()
}

const onMenuKeydown = useMenuKeys(
  () => panelRef.value,
  () => popup.hide(),
)
function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    event.stopPropagation()
    return back()
  }
  if (event.key === 'ArrowRight' && dropdown?.move) {
    event.preventDefault()
    return dropdown.move(1)
  }
  onMenuKeydown(event)
}

function onPanelEnter(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  popup.show()
  dropdown?.hold()
}
function onPanelLeave(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  onLeave(event)
  dropdown?.release()
}

const classes = computed(() => [
  ns.e('item'),
  ns.e('sub'),
  ns.is('disabled', props.disabled),
  ns.is('open', open.value),
])
</script>

<template>
  <div v-if="divided" role="separator" :class="ns.e('separator')" />
  <OnlyChild ref="triggerRef">
    <div
      v-bind="$attrs"
      role="menuitem"
      tabindex="-1"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="rendered ? id : undefined"
      :aria-disabled="disabled || undefined"
      :class="classes"
      @click="onClick"
      @keydown="onItemKeydown"
      @pointermove="onPointermove"
      @pointerenter="onEnter"
      @pointerleave="onLeave"
    >
      <span v-if="slots.prefix" :class="ns.e('prefix')"><slot name="prefix" /></span>
      <span :class="ns.e('label')"
        ><slot name="title">{{ title }}</slot></span
      >
      <span :class="[ns.e('suffix'), ns.e('arrow')]" aria-hidden="true"><ChevronRightIcon /></span>
    </div>
  </OnlyChild>
  <Teleport v-if="rendered" to="body">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="menu"
        tabindex="-1"
        :class="[ns.b(), ns.m('sub'), 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        @keydown="onPanelKeydown"
        @pointerenter="onPanelEnter"
        @pointerleave="onPanelLeave"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
