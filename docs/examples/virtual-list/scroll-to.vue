<script setup>
import { ref } from 'vue'

const rows = Array.from({ length: 10000 }, (_, index) => ({
  id: index,
  name: `deploy-${String(index).padStart(5, '0')}`,
  region: ['上海', '新加坡', '东京', '法兰克福'][index % 4],
}))
const list = ref()
const target = ref(5000)
</script>

<template>
  <DouSpace>
    <DouInputNumber v-model="target" :min="0" :max="9999" size="sm" />
    <DouButton size="sm" variant="outline" @click="list.scrollToIndex(target, 'center')">
      跳转
    </DouButton>
  </DouSpace>
  <DouCard padding="none">
    <DouVirtualList ref="list" :items="rows" :item-size="36" item-key="id" :height="216">
      <template #default="{ item, index }">
        <div class="vl-row" :class="{ 'vl-row--target': index === target }">
          <DouText mono>{{ item.name }}</DouText>
          <DouText variant="tertiary" size="sm">#{{ index }}</DouText>
        </div>
      </template>
    </DouVirtualList>
  </DouCard>
</template>

<style>
.vl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  box-sizing: border-box;
}
.vl-row--target {
  background: color-mix(in oklab, var(--dou-color-text) 6%, transparent);
}
</style>
