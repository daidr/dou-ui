<script setup>
import { ref } from 'vue'

const columns = ref([
  {
    id: 'todo',
    title: '待处理',
    cards: [
      { id: 1, title: '日期选择支持农历', owner: '戴兜' },
      { id: 2, title: '表格列宽记忆' },
    ],
  },
  {
    id: 'doing',
    title: '进行中',
    cards: [{ id: 3, title: '图片裁剪', owner: '戴兜' }],
  },
  { id: 'done', title: '已完成', cards: [] },
])
</script>

<template>
  <div class="board">
    <section v-for="column in columns" :key="column.id" class="column">
      <header>
        {{ column.title }}
        <DouBadge :value="column.cards.length" show-zero />
      </header>
      <DouSortable v-model="column.cards" group="board" :item-label="(card) => card.title">
        <template #default="{ item }">
          <div class="card">
            {{ item.title }}
            <DouUser v-if="item.owner" :name="item.owner" size="sm" />
          </div>
        </template>
        <template #empty>拖到这里</template>
      </DouSortable>
    </section>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-muted);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--dou-color-text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-sm);
  font-size: 13px;
}
</style>
