<script setup lang="ts">
import { boundsOf, useFlowEditor } from '@dou-ui/flow'
import { computed } from 'vue'

const { doc, getNodeRect } = useFlowEditor()

/** One frame per group, around its nodes with some room for the title. */
const frames = computed(() => {
  const groups = new Map<string, string[]>()
  for (const node of doc.value.nodes) {
    const group = node.data?.group as string | undefined
    if (group) groups.set(group, [...(groups.get(group) ?? []), node.id])
  }
  return [...groups].flatMap(([name, ids]) => {
    const rect = boundsOf(ids.flatMap((id) => getNodeRect(id) ?? []))
    return rect ? [{ name, rect }] : []
  })
})
</script>

<template>
  <div
    v-for="frame in frames"
    :key="frame.name"
    class="group-frame"
    :style="{
      left: `${frame.rect.x - 16}px`,
      top: `${frame.rect.y - 40}px`,
      width: `${frame.rect.width + 32}px`,
      height: `${frame.rect.height + 56}px`,
    }"
  >
    {{ frame.name }}
  </div>
</template>

<style scoped>
.group-frame {
  position: absolute;
  padding: 8px 12px;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: var(--dou-radius-container);
  background-color: color-mix(in oklab, var(--dou-color-text) 3%, transparent);
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  pointer-events: none;
}
</style>
