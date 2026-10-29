<script setup>
import { ref } from 'vue'

const lazy = ref(null)
let id = 0
const load = (option, path) =>
  new Promise((resolve) =>
    setTimeout(() => {
      const level = path.length
      resolve(
        Array.from({ length: 3 }, () => ({
          value: ++id,
          label: `第 ${level + 1} 级 · ${id}`,
          leaf: level >= 2,
        })),
      )
    }, 500),
  )
const roots = [
  { value: 'a', label: '分组 A' },
  { value: 'b', label: '分组 B' },
]
</script>

<template>
  <DouCascader v-model="lazy" :options="roots" :load="load" style="width: 260px" />
</template>
