<script setup lang="ts">
import { useFlowEditor } from '@dou-ui/flow'
import { computed } from 'vue'

const { doc, getNodeRect } = useFlowEditor()

/** A ring around each marked node, a little larger than the node. */
const rings = computed(() =>
  doc.value.nodes.flatMap((node) => {
    const rect = node.data?.marked ? getNodeRect(node.id) : null
    return rect ? [{ id: node.id, rect }] : []
  }),
)
</script>

<template>
  <div
    v-for="ring in rings"
    :key="ring.id"
    class="mark-ring"
    :style="{
      left: `${ring.rect.x - 6}px`,
      top: `${ring.rect.y - 6}px`,
      width: `${ring.rect.width + 12}px`,
      height: `${ring.rect.height + 12}px`,
    }"
  />
</template>

<style scoped>
.mark-ring {
  position: absolute;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: calc(var(--dou-radius-container) + 6px);
  background-color: color-mix(in oklab, var(--dou-color-text) 4%, transparent);
  pointer-events: none;
}
</style>
