<script setup>
import { DouGridLayout } from '@dou-ui/dashboard'
import { DouCard, DouSparkline, DouStatistic, DouSwitch } from 'dou-ui'
import { ref } from 'vue'

const editable = ref(true)
const items = ref([
  { id: 'visits', x: 0, y: 0, w: 4, h: 2 },
  { id: 'orders', x: 4, y: 0, w: 4, h: 2 },
  { id: 'refunds', x: 8, y: 0, w: 4, h: 2 },
  { id: 'revenue', x: 0, y: 2, w: 8, h: 3 },
  { id: 'users', x: 8, y: 2, w: 4, h: 3 },
])

const tiles = {
  visits: { title: '今日访问', value: 18240, data: [8, 9, 7, 11, 12, 10, 14, 13, 16, 18] },
  orders: { title: '今日订单', value: 1326, data: [3, 4, 4, 5, 3, 6, 7, 6, 8, 9] },
  refunds: { title: '退款申请', value: 12, data: [4, 3, 5, 2, 3, 2, 1, 2, 2, 1] },
  revenue: {
    title: '近 30 天销售额（元）',
    value: 2864120,
    data: [62, 70, 68, 75, 80, 78, 86, 90, 88, 95, 102, 98, 110, 118, 112, 120, 126, 122, 130],
  },
  users: { title: '新增用户', value: 386, data: [12, 18, 15, 20, 22, 19, 25, 28, 24, 30] },
}
</script>

<template>
  <div class="demo">
    <label class="bar">
      <DouSwitch v-model="editable" size="sm" />
      编辑布局
    </label>
    <DouGridLayout
      v-model="items"
      :editable="editable"
      :row-height="56"
      :gap="12"
      :item-label="(item) => tiles[item.id].title"
    >
      <template #item="{ item }">
        <DouCard :title="tiles[item.id].title" padding="sm" class="tile">
          <DouStatistic :value="tiles[item.id].value" />
          <DouSparkline
            :data="tiles[item.id].data"
            type="area"
            smooth
            width="100%"
            :height="item.h > 2 ? 96 : 32"
          />
        </DouCard>
      </template>
    </DouGridLayout>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
.bar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--dou-font-size-sm);
}
.tile :deep(.dou-card__body) {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
}
</style>
