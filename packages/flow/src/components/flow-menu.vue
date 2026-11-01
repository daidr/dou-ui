<script setup lang="ts">
import type { ContextMenuItem } from 'dou-ui'
import { DouContextMenu } from 'dou-ui'
import { nextTick, useTemplateRef } from 'vue'

defineProps<{ items: ContextMenuItem[] }>()
const open = defineModel<boolean>('open', { default: false })

const menu = useTemplateRef<InstanceType<typeof DouContextMenu>>('menu')

defineExpose({
  /**
   * `box` makes (x, y) the top left of a box the menu opens beside, e.g. the
   * button that opened it; `focusChecked` puts focus on the option in use,
   * for a menu opened from the keyboard.
   */
  open(
    x: number,
    y: number,
    {
      box,
      focusChecked = false,
    }: { box?: { width: number; height: number }; focusChecked?: boolean } = {},
  ) {
    menu.value?.open(x, y, box)
    if (!focusChecked) return
    // after the menu has focused itself
    void nextTick(() =>
      nextTick(() => {
        const panel = document.activeElement
        const item =
          panel?.querySelector<HTMLElement>('[aria-checked="true"]') ??
          panel?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')
        item?.focus({ preventScroll: true })
      }),
    )
  },
  close: () => menu.value?.close(),
})
</script>

<template>
  <!-- The editor opens the menu itself; the empty anchor only gives it a place in the page. -->
  <DouContextMenu ref="menu" v-model:open="open" :items="items">
    <span class="dou-flow-editor__menu-anchor" aria-hidden="true" />
  </DouContextMenu>
</template>
