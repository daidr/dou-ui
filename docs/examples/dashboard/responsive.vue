<script setup>
import { DouGridLayout } from '@dou-ui/dashboard'
import { DouButton, DouSegmentedControl } from 'dou-ui'
import { computed, ref } from 'vue'

const width = ref('100%')
const grid = ref()
// 当前断点由网格自己的宽度决定
const breakpoint = computed(() => grid.value?.breakpoint ?? 'lg')
const items = ref([
  { id: '访问量', x: 0, y: 0, w: 3, h: 2 },
  { id: '订单', x: 3, y: 0, w: 3, h: 2 },
  { id: '退款', x: 6, y: 0, w: 3, h: 2 },
  { id: '转化率', x: 9, y: 0, w: 3, h: 2 },
  { id: '销售趋势', x: 0, y: 2, w: 8, h: 3 },
  { id: '新用户', x: 8, y: 2, w: 4, h: 3 },
])
// 在较窄的断点上拖动过的位置，按断点名保存
const layouts = ref({})
const columns = { lg: 12, md: 6, sm: 1 }
</script>

<template>
  <div class="demo">
    <div class="bar">
      <DouSegmentedControl
        v-model="width"
        size="sm"
        :options="[
          { value: '100%', label: '整行' },
          { value: '560px', label: '560px' },
          { value: '320px', label: '320px' },
        ]"
      />
      <span class="note">{{ breakpoint }} · {{ columns[breakpoint] }} 列</span>
      <DouButton v-if="Object.keys(layouts).length" size="sm" variant="ghost" @click="layouts = {}">
        还原窄屏布局
      </DouButton>
    </div>
    <div class="frame" :style="{ width }">
      <DouGridLayout
        ref="grid"
        v-model="items"
        v-model:layouts="layouts"
        editable
        :row-height="40"
        :gap="8"
      >
        <template #item="{ item }">
          <div class="tile">{{ item.id }}</div>
        </template>
      </DouGridLayout>
    </div>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.note {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  font-variant-numeric: tabular-nums;
}
.frame {
  max-width: 100%;
  padding: 8px;
  border: 1px dashed var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  box-sizing: border-box;
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
