<script setup>
import { DouGridLayout, DouGridLayoutHandle } from '@dou-ui/dashboard'
import { GripHorizontalIcon } from '@dou-ui/icons'
import { DouButton, DouProgress } from 'dou-ui'
import { ref } from 'vue'

const items = ref([
  { id: 'disk', x: 0, y: 0, w: 6, h: 2 },
  { id: 'deploy', x: 6, y: 0, w: 6, h: 2 },
  { id: 'queue', x: 0, y: 2, w: 12, h: 2 },
])
const titles = { disk: '磁盘用量', deploy: '最近部署', queue: '任务队列' }
const deploys = ref(3)
</script>

<template>
  <DouGridLayout
    v-model="items"
    editable
    handle
    :row-height="56"
    :gap="12"
    :item-label="(item) => titles[item.id]"
  >
    <template #item="{ item }">
      <section class="tile">
        <DouGridLayoutHandle as="header" class="tile-head">
          <GripHorizontalIcon class="grip" />
          {{ titles[item.id] }}
        </DouGridLayoutHandle>
        <div class="tile-body">
          <DouProgress v-if="item.id === 'disk'" :value="72" show-value />
          <template v-else-if="item.id === 'deploy'">
            <span>今天已部署 {{ deploys }} 次</span>
            <DouButton size="sm" @click="deploys++">再部署一次</DouButton>
          </template>
          <span v-else>上海机房：等待中 14 个，执行中 3 个</span>
        </div>
      </section>
    </template>
  </DouGridLayout>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-surface);
}
.tile-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  font-size: var(--dou-font-size-sm);
  font-weight: 500;
}
.grip {
  color: var(--dou-color-text-tertiary);
}
.tile-body {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  font-size: var(--dou-font-size-sm);
}
.tile-body :deep(.dou-progress) {
  flex: 1;
}
</style>
