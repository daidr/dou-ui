<script setup lang="ts">
import { computed, inject, mergeProps, nextTick, provide, useAttrs, useId } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { dropdownHostKey, dropdownKey } from './dropdown'
import { menuItems, useMenuKeys } from './menu-keys'
import type { DropdownExpose, DropdownProps, DropdownSlots, DropdownValue } from './dropdown'
import { useTeleport } from '../../utils/teleport'
import DropdownItems from './dropdown-items.vue'
import { useItemsWarning } from './items-warning'
import { findMenuItem } from './menu-entries'

defineOptions({ name: 'DouDropdown', inheritAttrs: false })

const props = withDefaults(defineProps<DropdownProps>(), {
  placement: 'bottom-start',
  trigger: 'click',
  disabled: false,
  hideOnSelect: true,
  sameWidth: false,
  showDelay: 100,
  hideDelay: 150,
  offset: 6,
  teleport: undefined,
})
const teleportTarget = useTeleport(() => props.teleport)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [value: DropdownValue | undefined] }>()
const slots = defineSlots<DropdownSlots>()
useItemsWarning('Dropdown', () => !!props.items && !!slots.menu)

const ns = useNamespace('dropdown')
const id = `dou-dropdown-${useId()}`

const popup = usePopup({
  open,
  trigger: () => props.trigger,
  disabled: () => props.disabled,
  placement: () => props.placement,
  offset: () => props.offset,
  sameWidth: () => props.sameWidth,
  showDelay: () => props.showDelay,
  hideDelay: () => props.hideDelay,
  // a menu closes on a press outside however it was opened, `manual` too
  closeOnOutside: true,
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle, panelListeners } = popup

const items = () => menuItems(panelRef.value)

async function openAndFocus(which: 'first' | 'last') {
  popup.show()
  await nextTick()
  const list = items()
  ;(which === 'first' ? list[0] : list.at(-1))?.focus()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
  event.preventDefault()
  void openAndFocus(event.key === 'ArrowDown' ? 'first' : 'last')
}

// A click from Enter or Space (`detail` is 0) opens the menu with its
// first item focused, so the keyboard can carry on from there.
function onTriggerClick(event: MouseEvent) {
  if (event.detail !== 0 || props.disabled) return
  if (props.trigger === 'click' ? open.value : !open.value) void openAndFocus('first')
}

const triggerProps = computed(() =>
  mergeProps(popup.triggerListeners.value, {
    onKeydown: onTriggerKeydown,
    onClick: onTriggerClick,
    'aria-haspopup': 'menu',
    'aria-expanded': open.value,
    'aria-controls': rendered.value ? id : undefined,
  }),
)

const host = inject(dropdownHostKey, null)
const attrs = useAttrs()

// Tab leaves from the trigger so focus moves on from where the menu was opened.
const onKeys = useMenuKeys(
  () => panelRef.value,
  () => {
    ;(popup.reference() as HTMLElement | null)?.focus()
    popup.hide()
  },
)

function onMenuKeydown(event: KeyboardEvent) {
  if (host && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault()
    return host.move(event.key === 'ArrowRight' ? 1 : -1)
  }
  onKeys(event)
}

provide(dropdownKey, {
  select(value) {
    findMenuItem(props.items, value)?.run?.()
    emit('select', value)
    if (!props.hideOnSelect) return
    // Focus may be in a submenu, outside the panel: it goes back to the trigger too.
    const restore = !!(document.activeElement as HTMLElement | null)?.closest(`.${ns.b()}`)
    popup.hide()
    if (restore) (popup.reference() as HTMLElement | null)?.focus()
  },
  opened: () => open.value,
  hold: () => props.trigger === 'hover' && popup.show(),
  release: () => props.trigger === 'hover' && popup.hide(props.hideDelay),
  move: host ? (direction) => host.move(direction) : undefined,
  panelClass: () => attrs.class,
  teleport: () => teleportTarget.value,
})

defineExpose<DropdownExpose>({ open: () => popup.show(), close: () => popup.hide() })
</script>

<template>
  <OnlyChild ref="triggerRef" v-bind="triggerProps"><slot /></OnlyChild>
  <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
    <Transition appear name="dou-floating">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="menu"
        tabindex="-1"
        :class="[ns.b(), 'dou-floating']"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
        v-bind="{ ...$attrs, ...panelListeners }"
        @keydown="onMenuKeydown"
      >
        <slot name="menu"><DropdownItems v-if="props.items" :items="props.items" /></slot>
      </div>
    </Transition>
  </Teleport>
</template>
