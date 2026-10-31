<script setup>
import { DouGridLayout } from '@dou-ui/dashboard'
import { LockIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const items = ref([
  { id: 'notice', x: 0, y: 0, w: 12, h: 1, locked: true },
  { id: 'wide', x: 0, y: 1, w: 6, h: 2, minW: 4 },
  { id: 'small', x: 6, y: 1, w: 3, h: 2, maxW: 4, maxH: 2 },
  { id: 'tall', x: 9, y: 1, w: 3, h: 3, minH: 3 },
])
const notes = {
  notice: '固定在顶部的公告：不能移动，其他格子会绕开它',
  wide: '至少 4 列宽',
  small: '最多 4 列宽、2 行高',
  tall: '至少 3 行高',
}
</script>

<template>
  <DouGridLayout
    v-model="items"
    editable
    :row-height="56"
    :gap="12"
    :item-label="(item) => notes[item.id]"
  >
    <template #item="{ item }">
      <div class="tile" :class="{ locked: item.locked }">
        <LockIcon v-if="item.locked" />
        {{ notes[item.id] }}
        <span v-if="!item.locked" class="size">{{ item.w }} × {{ item.h }}</span>
      </div>
    </template>
  </DouGridLayout>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 0 16px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-surface);
  font-size: var(--dou-font-size-sm);
}
.tile.locked {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  background-color: color-mix(in oklab, var(--dou-color-text) 3%, var(--dou-color-bg-surface));
  color: var(--dou-color-text-secondary);
}
.size {
  color: var(--dou-color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
