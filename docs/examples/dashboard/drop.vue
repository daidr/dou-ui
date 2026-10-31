<script setup>
import { DouGridLayout } from '@dou-ui/dashboard'
import { ActivityIcon, LineChartIcon, StickyNoteIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const kinds = [
  { kind: 'stat', label: '统计数字', icon: ActivityIcon, w: 3, h: 2 },
  { kind: 'chart', label: '折线图', icon: LineChartIcon, w: 6, h: 3 },
  { kind: 'note', label: '便签', icon: StickyNoteIcon, w: 3, h: 3 },
]
const grid = ref()
const items = ref([
  { id: '1', x: 0, y: 0, w: 6, h: 2 },
  { id: '2', x: 6, y: 0, w: 3, h: 2 },
])
const labels = ref({ 1: '统计数字', 2: '统计数字' })
let next = 3

// 在列表项上按下时开始拖入，松手的位置就是新格子的位置
function press(event, kind) {
  grid.value.startDrop(event, { id: String(next), w: kind.w, h: kind.h }, kind)
}

function onDrop({ item, data }) {
  labels.value[item.id] = data.label
  next++
}
</script>

<template>
  <div class="demo">
    <ul class="palette">
      <li v-for="kind in kinds" :key="kind.kind" @pointerdown="press($event, kind)">
        <component :is="kind.icon" />
        {{ kind.label }}
      </li>
    </ul>
    <div class="board">
      <DouGridLayout
        ref="grid"
        v-model="items"
        editable
        :columns="12"
        :row-height="40"
        :gap="8"
        @drop="onDrop"
      >
        <template #item="{ item }">
          <div class="tile">{{ labels[item.id] }}</div>
        </template>
      </DouGridLayout>
    </div>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}
.palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.palette li {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  margin: 0;
  padding: 0 12px;
  box-sizing: border-box;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-surface);
  font-size: var(--dou-font-size-sm);
  cursor: grab;
  user-select: none;
  -webkit-touch-callout: none;
}
.board {
  flex: 1 1 320px;
  min-height: 216px;
  padding: 8px;
  border: 1px dashed var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  box-sizing: border-box;
}
@media (max-width: 640px) {
  .palette {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
.tile {
  display: grid;
  place-items: center;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-surface);
  font-size: var(--dou-font-size-sm);
}
</style>
