<script setup>
import { ref } from 'vue'

const count = ref(12)
const loading = ref(false)

async function load() {
  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 400))
  count.value += 12
  loading.value = false
}
</script>

<template>
  <ul v-infinite-scroll="{ load, disabled: count >= 60 }" class="grid">
    <li v-for="i in count" :key="i">{{ i }}</li>
  </ul>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
  width: 100%;
  height: 200px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  box-sizing: border-box;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  list-style: none;
}

li {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-muted);
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
