<script setup lang="ts">
import { CheckIcon } from '@dou-ui/icons'
import { computed, inject } from 'vue'
import { ariaHotkey, formatHotkey, useApplePlatform } from '../../composables/use-hotkey'
import { useNamespace } from '../../utils/namespace'
import { dropdownKey, dropdownRadioGroupKey } from './dropdown'
import type { DropdownItemProps, DropdownItemSlots } from './dropdown'

defineOptions({ name: 'DouDropdownItem', inheritAttrs: false })

const props = withDefaults(defineProps<DropdownItemProps>(), {
  disabled: false,
  tone: 'neutral',
  divided: false,
  checked: undefined,
})
const emit = defineEmits<{ click: [event: MouseEvent]; 'update:checked': [checked: boolean] }>()
const slots = defineSlots<DropdownItemSlots>()

const ns = useNamespace('dropdown')
const dropdown = inject(dropdownKey, null)
const radioGroup = inject(dropdownRadioGroupKey, null)
const apple = useApplePlatform()

const kind = computed(() =>
  radioGroup && props.value !== undefined
    ? 'radio'
    : props.checked !== undefined
      ? 'checkbox'
      : undefined,
)
const isChecked = computed(() =>
  kind.value === 'radio' ? radioGroup!.value() === props.value : props.checked === true,
)
const role = computed(() => (kind.value ? `menuitem${kind.value}` : 'menuitem'))

const shortcutText = computed(() =>
  props.shortcut
    ? formatHotkey(props.shortcut, apple.value)
        .map((step) => step.join(apple.value ? '' : '+'))
        .join(' ')
    : '',
)

const ariaShortcut = computed(() =>
  props.shortcut ? ariaHotkey(props.shortcut, apple.value) : undefined,
)

const classes = computed(() => [
  ns.e('item'),
  ns.m(props.tone),
  ns.is('disabled', props.disabled),
  ns.is('checked', isChecked.value),
])

function onClick(event: MouseEvent) {
  if (props.disabled) return
  emit('click', event)
  if (kind.value === 'checkbox') emit('update:checked', !props.checked)
  else if (kind.value === 'radio') radioGroup!.pick(props.value!)
  dropdown?.select(props.value)
}

// The pointer and the keyboard share one highlight: the focused item.
function onPointermove(event: PointerEvent) {
  const item = event.currentTarget as HTMLElement
  if (!props.disabled && document.activeElement !== item) item.focus({ preventScroll: true })
}
function onPointerleave(event: PointerEvent) {
  const item = event.currentTarget as HTMLElement
  if (document.activeElement === item) item.closest<HTMLElement>('[role="menu"]')?.focus()
}
</script>

<template>
  <div v-if="divided" role="separator" :class="ns.e('separator')" />
  <div
    v-bind="$attrs"
    :role="role"
    tabindex="-1"
    :class="classes"
    :aria-checked="kind ? isChecked : undefined"
    :aria-disabled="disabled || undefined"
    :aria-keyshortcuts="ariaShortcut"
    @click="onClick"
    @pointermove="onPointermove"
    @pointerleave="onPointerleave"
  >
    <span
      v-if="kind"
      :class="[ns.e('indicator'), `${ns.e('indicator')}--${kind}`]"
      aria-hidden="true"
      ><CheckIcon v-if="kind === 'checkbox' && isChecked"
    /></span>
    <span v-if="slots.prefix" :class="ns.e('prefix')"><slot name="prefix" /></span>
    <span :class="ns.e('label')"><slot /></span>
    <span v-if="slots.suffix || shortcut" :class="ns.e('suffix')"
      ><slot name="suffix">{{ shortcutText }}</slot></span
    >
  </div>
</template>
