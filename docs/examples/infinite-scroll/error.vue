<script setup>
import { ref } from 'vue'

const items = ref(Array.from({ length: 8 }, (_, i) => `订单 #${1001 + i}`))
let attempts = 0

async function load() {
  await new Promise((resolve) => setTimeout(resolve, 500))
  attempts += 1
  // every other request fails, to show the retry
  if (attempts % 2) throw new Error('网络错误')
  const start = items.value.length
  items.value.push(...Array.from({ length: 8 }, (_, i) => `订单 #${1001 + start + i}`))
}
</script>

<template>
  <div class="feed">
    <DouInfiniteScroll :load="load" :immediate="false">
      <ul>
        <li v-for="item in items" :key="item">{{ item }}</li>
      </ul>
      <template #error="{ retry }">
        没能加载更多订单
        <DouButton size="sm" @click="retry">再试一次</DouButton>
      </template>
    </DouInfiniteScroll>
  </div>
</template>

<style scoped>
.feed {
  width: 100%;
  height: 240px;
  overflow: auto;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  margin: 0;
  padding: 10px 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
}
</style>
