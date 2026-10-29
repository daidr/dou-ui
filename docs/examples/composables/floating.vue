<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useFloating, useLayer, useZIndex } from 'dou-ui'

const open = ref(false)
const trigger = useTemplateRef<HTMLElement>('trigger')
const panel = useTemplateRef<HTMLElement>('panel')
const zIndex = ref<number>()
const { next } = useZIndex()

const { style, placement } = useFloating(() => trigger.value, panel, {
  open,
  placement: 'bottom-start',
})
useLayer({
  open,
  elements: () => [trigger.value, panel.value],
  onEscape: () => (open.value = false),
  onOutside: () => (open.value = false),
})

function toggle() {
  open.value = !open.value
  if (open.value) zIndex.value = next()
}
</script>

<template>
  <span ref="trigger" style="display: inline-flex">
    <DouButton variant="outline" :aria-expanded="open" @click="toggle">贴近按钮的面板</DouButton>
  </span>
  <Teleport to="body">
    <div
      v-show="open"
      ref="panel"
      class="floating-demo"
      :style="{ ...style, zIndex }"
      :data-placement="placement"
    >
      位置：{{ placement }}。按 Esc 或点击外部关闭。
    </div>
  </Teleport>
</template>

<style scoped>
.floating-demo {
  padding: 8px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-md);
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
}
</style>
