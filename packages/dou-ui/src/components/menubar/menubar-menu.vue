<script setup lang="ts">
import { computed, inject, provide, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { DouDropdown } from '../dropdown'
import { dropdownHostKey } from '../dropdown/dropdown'
import { menubarKey } from './menubar'
import type { MenubarMenuProps, MenubarMenuSlots } from './menubar'

defineOptions({ name: 'DouMenubarMenu', inheritAttrs: false })

const props = withDefaults(defineProps<MenubarMenuProps>(), { disabled: false })
defineSlots<MenubarMenuSlots>()

const ns = useNamespace('menubar')
const id = useId()
const menubar = inject(menubarKey, null)

const open = computed({
  get: () => menubar?.active.value === id,
  set: (value) => {
    if (!menubar) return
    if (value) menubar.active.value = id
    else if (menubar.active.value === id) menubar.active.value = null
  },
})

// Once one menu is open, pointing at another button opens that one instead.
function onPointerenter() {
  if (!props.disabled && menubar?.active.value && menubar.active.value !== id) open.value = true
}

// Moving focus along the bar with a menu open carries the open menu along.
function onFocus() {
  if (!props.disabled && menubar?.active.value && menubar.active.value !== id) open.value = true
}

provide(dropdownHostKey, { move: (step) => menubar?.move(id, step) })
</script>

<template>
  <DouDropdown
    v-model:open="open"
    trigger="click"
    placement="bottom-start"
    :offset="4"
    :disabled="disabled"
    @select="(value) => menubar?.select(value, name ?? label ?? '')"
  >
    <button
      v-bind="$attrs"
      type="button"
      role="menuitem"
      :class="[ns.e('trigger'), ns.is('open', open), ns.is('disabled', disabled)]"
      :data-menu="id"
      :aria-disabled="disabled || undefined"
      :tabindex="disabled ? -1 : undefined"
      @pointerenter="onPointerenter"
      @focus="onFocus"
    >
      <slot name="label">{{ label }}</slot>
    </button>
    <template #menu><slot /></template>
  </DouDropdown>
</template>
