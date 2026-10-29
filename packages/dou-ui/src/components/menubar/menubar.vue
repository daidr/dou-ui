<script setup lang="ts">
import { nextTick, provide, ref, useTemplateRef } from 'vue'
import { useRovingFocus } from '../../composables/use-roving-focus'
import { useNamespace } from '../../utils/namespace'
import { menuItems } from '../dropdown/menu-keys'
import { menubarKey } from './menubar'
import type { MenubarProps, MenubarSlots } from './menubar'
import type { DropdownValue } from '../dropdown/dropdown'

defineOptions({ name: 'DouMenubar' })

const props = withDefaults(defineProps<MenubarProps>(), { size: 'md', loop: true })
const emit = defineEmits<{ select: [value: DropdownValue | undefined, menu: string] }>()
defineSlots<MenubarSlots>()

const ns = useNamespace('menubar')
const rootRef = useTemplateRef<HTMLElement>('root')
const active = ref<string | null>(null)

useRovingFocus(rootRef, { loop: props.loop })

const triggers = () =>
  [...(rootRef.value?.querySelectorAll<HTMLElement>(`.${ns.e('trigger')}`) ?? [])].filter(
    (el) => el.getAttribute('aria-disabled') !== 'true',
  )

async function move(from: string, step: 1 | -1) {
  const list = triggers()
  const index = list.findIndex((el) => el.dataset.menu === from)
  let next = index + step
  if (next < 0 || next >= list.length) {
    if (!props.loop) return
    next = (next + list.length) % list.length
  }
  const trigger = list[next]
  if (!trigger) return
  trigger.focus()
  active.value = trigger.dataset.menu!
  await nextTick()
  const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '')
  menuItems(panel)[0]?.focus()
}

provide(menubarKey, {
  active,
  move: (from, step) => void move(from, step),
  select: (value, menu) => emit('select', value, menu),
})
</script>

<template>
  <div ref="root" role="menubar" :class="[ns.b(), ns.m(size)]">
    <slot />
  </div>
</template>
