<script setup lang="ts">
import { DouContextMenu, DouDropdownItem, DouIcon } from 'dou-ui'
import { useTemplateRef, type Component } from 'vue'

/** An item of the grid's menu. */
export interface SheetMenuItem {
  key: string
  label: string
  icon?: Component
  shortcut?: string
  tone?: 'neutral' | 'danger'
  divided?: boolean
  disabled?: boolean
  run: () => void
}

defineProps<{ items: SheetMenuItem[] }>()
const emit = defineEmits<{ select: [key: unknown] }>()
const open = defineModel<boolean>('open', { default: false })

// shortcuts mean nothing without a keyboard
const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

const menu = useTemplateRef<InstanceType<typeof DouContextMenu>>('menu')

defineExpose({
  open: (x: number, y: number) => menu.value?.open(x, y),
  close: () => menu.value?.close(),
})
</script>

<template>
  <!-- The grid opens the menu itself; the empty anchor only gives it a place in the page. -->
  <DouContextMenu ref="menu" v-model:open="open" @select="emit('select', $event)">
    <span class="dou-sheet__menu-anchor" aria-hidden="true" />
    <template #menu>
      <DouDropdownItem
        v-for="item in items"
        :key="item.key"
        :value="item.key"
        :disabled="item.disabled"
        :tone="item.tone"
        :divided="item.divided"
        :shortcut="coarse() ? undefined : item.shortcut"
      >
        <template v-if="item.icon" #prefix>
          <DouIcon><component :is="item.icon" /></DouIcon>
        </template>
        {{ item.label }}
      </DouDropdownItem>
    </template>
  </DouContextMenu>
</template>
