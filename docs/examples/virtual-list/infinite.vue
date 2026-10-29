<script setup>
import { ref } from 'vue'

const feed = ref(Array.from({ length: 30 }, (_, index) => `第 ${index + 1} 条`))
const loading = ref(false)
function more() {
  if (loading.value || feed.value.length >= 120) return
  loading.value = true
  setTimeout(() => {
    const start = feed.value.length
    feed.value = [
      ...feed.value,
      ...Array.from({ length: 30 }, (_, index) => `第 ${start + index + 1} 条`),
    ]
    loading.value = false
  }, 600)
}
</script>

<template>
  <DouCard padding="none">
    <DouVirtualList :items="feed" :item-size="36" :height="216" @end-reached="more">
      <template #default="{ item }">
        <div class="vl-row">{{ item }}</div>
      </template>
    </DouVirtualList>
  </DouCard>
  <DouText variant="tertiary" size="sm">
    已加载 {{ feed.length }} 条{{ loading ? '，加载中…' : '' }}
  </DouText>
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
