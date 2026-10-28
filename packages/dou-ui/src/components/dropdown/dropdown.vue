<script setup lang="ts">
import { computed, mergeProps, nextTick, provide, useId } from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { OnlyChild } from '../../utils/only-child'
import { dropdownKey } from './dropdown'
import type { DropdownExpose, DropdownProps, DropdownSlots, DropdownValue } from './dropdown'

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
  teleport: 'body',
})
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [value: DropdownValue | undefined] }>()
defineSlots<DropdownSlots>()

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
})
const { triggerRef, panelRef, rendered, theme, placement, panelStyle, panelListeners } = popup

const items = () =>
  [...(panelRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].filter(
    (item) => item.getAttribute('aria-disabled') !== 'true',
  )

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

let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined

function onMenuKeydown(event: KeyboardEvent) {
  const list = items()
  const index = list.indexOf(document.activeElement as HTMLElement)
  const focus = (next: number) => list[(next + list.length) % list.length]?.focus()

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focus(index + 1)
      return
    case 'ArrowUp':
      event.preventDefault()
      focus(index < 0 ? -1 : index - 1)
      return
    case 'Home':
      event.preventDefault()
      focus(0)
      return
    case 'End':
      event.preventDefault()
      focus(-1)
      return
    case 'Enter':
    case ' ':
      event.preventDefault()
      list[index]?.click()
      return
    case 'Tab':
      // Leave from the trigger so focus moves on from where the menu was opened.
      ;(popup.reference() as HTMLElement | null)?.focus()
      popup.hide()
      return
  }

  // Typing jumps to the next item starting with the typed text.
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
  clearTimeout(typedTimer)
  typed += event.key.toLowerCase()
  typedTimer = setTimeout(() => (typed = ''), 500)
  const ordered = [...list.slice(index + 1), ...list.slice(0, index + 1)]
  const repeat = typed.length > 1 && [...typed].every((char) => char === typed[0])
  const match = ordered.find((item) =>
    item.textContent
      ?.trim()
      .toLowerCase()
      .startsWith(repeat ? typed[0]! : typed),
  )
  match?.focus()
}

provide(dropdownKey, {
  select(value) {
    emit('select', value)
    if (props.hideOnSelect) popup.dismiss()
  },
})

defineExpose<DropdownExpose>({ open: () => popup.show(), close: () => popup.hide() })
</script>

<template>
  <OnlyChild ref="triggerRef" v-bind="triggerProps"><slot /></OnlyChild>
  <Teleport v-if="rendered" :to="teleport || 'body'" :disabled="teleport === false">
    <Transition name="dou-floating">
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
        <slot name="menu" />
      </div>
    </Transition>
  </Teleport>
</template>
