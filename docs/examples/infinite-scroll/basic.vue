<script setup>
import { ref } from 'vue'

const notes = ref([])
const finished = ref(false)

async function load() {
  await new Promise((resolve) => setTimeout(resolve, 600))
  const start = notes.value.length
  notes.value.push(...Array.from({ length: 10 }, (_, i) => `第 ${start + i + 1} 条动态`))
  if (notes.value.length >= 40) finished.value = true
}
</script>

<template>
  <div class="feed">
    <DouInfiniteScroll :load="load" :finished="finished">
      <ul>
        <li v-for="note in notes" :key="note">{{ note }}</li>
      </ul>
    </DouInfiniteScroll>
  </div>
</template>

<style scoped>
.feed {
  width: 100%;
  height: 280px;
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
