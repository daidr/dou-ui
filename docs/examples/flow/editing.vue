<script setup lang="ts">
import { DouFlowControls, DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { ref, useTemplateRef } from 'vue'
import { reviewTypes } from './review-types'

const extensions = [flowKit(), { name: 'review', nodeTypes: reviewTypes }]
const editor = useTemplateRef('editor')

// The panel is plain markup outside the editor, grouped by `palette.group`.
const groups = [...new Set(reviewTypes.map((spec) => spec.palette!.group))].map((name) => ({
  name,
  types: reviewTypes.filter((spec) => spec.palette!.group === name),
}))

const [submission, extract] = reviewTypes.map((spec) => spec.defaults!())

const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    { id: 'a', type: 'submission', x: 0, y: 40, data: submission! },
    { id: 'b', type: 'extract', x: 256, y: 40, data: extract! },
  ],
  edges: [{ id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
})
</script>

<template>
  <div class="review-flow">
    <nav class="review-flow__panel" aria-label="节点">
      <template v-for="group in groups" :key="group.name">
        <DouText variant="tertiary" size="sm" class="review-flow__group">{{ group.name }}</DouText>
        <button
          v-for="spec in group.types"
          :key="spec.type"
          type="button"
          class="review-flow__item"
          @pointerdown="editor?.startInsertDrag(spec.type, $event)"
          @click="editor?.insertNode(spec.type)"
        >
          <DouIcon><component :is="spec.palette!.icon" /></DouIcon>
          {{ spec.palette!.label }}
        </button>
      </template>
    </nav>
    <DouFlowEditor
      ref="editor"
      v-model="doc"
      :extensions="extensions"
      fit-view
      aria-label="投稿审核流程"
      style="height: 400px"
    >
      <DouFlowControls />
    </DouFlowEditor>
  </div>
</template>

<style scoped>
.review-flow {
  display: flex;
  gap: 12px;
}

.review-flow__panel {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 2px;
  width: 136px;
}

.review-flow__group {
  padding: 10px 8px 6px;
}

.review-flow__item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--dou-radius-control);
  background: none;
  color: var(--dou-color-text);
  font: inherit;
  font-size: var(--dou-font-size-sm);
  cursor: grab;
}

.review-flow__item:hover {
  background-color: var(--dou-color-bg-muted);
}

.review-flow__item:focus-visible {
  outline: 2px solid var(--dou-color-focus);
  outline-offset: -2px;
}

@media (width < 640px) {
  .review-flow {
    flex-direction: column;
  }
  .review-flow__panel {
    flex-direction: row;
    flex-wrap: wrap;
    width: auto;
  }
  .review-flow__group {
    display: none;
  }
}
</style>
