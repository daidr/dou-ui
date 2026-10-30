<script setup lang="ts">
import { DouFlowPort } from '@dou-ui/flow'

defineProps<{
  data: { title: string; text: string }
  readonly: boolean
  updateData: (patch: { text: string }) => void
}>()
</script>

<template>
  <div class="prompt-node">
    <div class="prompt-node__head">
      {{ data.title }}
      <DouFlowPort id="text" />
    </div>
    <textarea
      class="prompt-node__input"
      :value="data.text"
      :readonly="readonly"
      rows="4"
      @input="updateData({ text: ($event.target as HTMLTextAreaElement).value })"
    />
  </div>
</template>

<style scoped>
.prompt-node {
  width: 240px;
  padding-bottom: 12px;
}

.prompt-node__head {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  font-weight: var(--dou-font-weight-medium);
}

.prompt-node__input {
  display: block;
  box-sizing: border-box;
  width: calc(100% - 24px);
  margin: 0 12px;
  padding: 6px 8px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  background: var(--dou-color-bg-canvas);
  color: inherit;
  font: inherit;
  font-size: var(--dou-font-size-sm);
  line-height: 20px;
  resize: none;
}

.prompt-node__input:focus-visible {
  outline: 2px solid var(--dou-color-focus);
  outline-offset: 2px;
}
</style>
