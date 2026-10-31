<script setup>
import { DouGridLayout } from '@dou-ui/dashboard'
import { DouSegmentedControl } from 'dou-ui'
import { ref } from 'vue'

const compact = ref(false)
const items = ref([
  { id: '1', x: 0, y: 0, w: 3, h: 1 },
  { id: '2', x: 4, y: 1, w: 2, h: 2 },
  { id: '3', x: 8, y: 0, w: 4, h: 1 },
  { id: '4', x: 1, y: 3, w: 4, h: 1 },
  { id: '5', x: 7, y: 2, w: 3, h: 2 },
])
</script>

<template>
  <div class="demo">
    <DouSegmentedControl
      v-model="compact"
      size="sm"
      :options="[
        { value: false, label: '自由摆放' },
        { value: 'vertical', label: '自动上浮' },
      ]"
    />
    <DouGridLayout
      v-model="items"
      editable
      :compact="compact"
      :row-height="48"
      :gap="8"
      class="board"
    >
      <template #item="{ item }">
        <div class="note">{{ item.id }}</div>
      </template>
    </DouGridLayout>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.board {
  align-self: stretch;
  min-height: 248px;
  border-radius: var(--dou-radius-container);
  background-image: radial-gradient(var(--dou-color-border) 1px, transparent 1px);
  background-size: 16px 16px;
}
.note {
  display: grid;
  place-items: center;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-sm);
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
