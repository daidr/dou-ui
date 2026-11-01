<script setup lang="ts">
import type { ContextMenuItem } from 'dou-ui'
import { DouContextMenu } from 'dou-ui'
import { useTemplateRef } from 'vue'

defineProps<{ items: ContextMenuItem[] }>()
const open = defineModel<boolean>('open', { default: false })

const menu = useTemplateRef<InstanceType<typeof DouContextMenu>>('menu')

defineExpose({
  open: (x: number, y: number) => menu.value?.open(x, y),
  close: () => menu.value?.close(),
})
</script>

<template>
  <!-- The chart opens the menu itself; the empty anchor only gives it a place in the page. -->
  <DouContextMenu ref="menu" v-model:open="open" :items="items">
    <span class="dou-gantt__menu-anchor" aria-hidden="true" />
  </DouContextMenu>
</template>
