<script setup lang="ts">
import { DouContextMenu, DouDropdownItem, DouDropdownSub, DouIcon } from 'dou-ui'
import { useTemplateRef } from 'vue'
import type { SheetMenuItem } from '../types'

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
      <template v-for="item in items" :key="item.key">
        <DouDropdownSub
          v-if="item.children?.length"
          :title="item.label"
          :disabled="item.disabled"
          :divided="item.divided"
        >
          <template v-if="item.icon" #prefix>
            <DouIcon><component :is="item.icon" /></DouIcon>
          </template>
          <DouDropdownItem
            v-for="child in item.children"
            :key="child.key"
            :value="child.key"
            :disabled="child.disabled"
            :tone="child.tone"
            :divided="child.divided"
            :shortcut="coarse() ? undefined : child.shortcut"
          >
            <template v-if="child.icon" #prefix>
              <DouIcon><component :is="child.icon" /></DouIcon>
            </template>
            {{ child.label }}
          </DouDropdownItem>
        </DouDropdownSub>
        <DouDropdownItem
          v-else
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
    </template>
  </DouContextMenu>
</template>
