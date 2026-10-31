<script setup lang="ts">
import { DouContextMenu, DouDropdownItem, DouIcon } from 'dou-ui'
import { useTemplateRef } from 'vue'
import type { GanttMenuItem } from '../core/menu'

defineProps<{ items: GanttMenuItem[] }>()
const emit = defineEmits<{ select: [key: unknown] }>()
const open = defineModel<boolean>('open', { default: false })

// Shortcuts mean nothing without a keyboard.
const coarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

const menu = useTemplateRef<InstanceType<typeof DouContextMenu>>('menu')

defineExpose({
  open: (x: number, y: number) => menu.value?.open(x, y),
  close: () => menu.value?.close(),
})
</script>

<template>
  <!-- The chart opens the menu itself; the empty anchor only gives it a place in the page. -->
  <DouContextMenu ref="menu" v-model:open="open" @select="emit('select', $event)">
    <span class="dou-gantt__menu-anchor" aria-hidden="true" />
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
