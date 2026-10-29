<script setup>
import { computed, ref } from 'vue'

const sizes = [
  { label: '1 千', value: 1_000 },
  { label: '1 万', value: 10_000 },
  { label: '10 万', value: 100_000 },
]
const size = ref(10_000)

let seed = 7
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const series = computed(() => {
  seed = 7
  let value = 50
  const list = []
  for (let i = 0; i < size.value; i++) {
    value = Math.max(0, value + (random() - 0.5) * 4)
    list.push(Math.round(value * 10) / 10)
  }
  // one spike, to show that thinning keeps it
  list[Math.floor(size.value * 0.62)] = Math.max(...list) + 40
  return list
})
</script>

<template>
  <div class="long-demo">
    <DouSegmentedControl v-model="size" :options="sizes" size="sm" />
    <DouSparkline
      :data="series"
      width="100%"
      style="justify-self: stretch"
      :height="56"
      :markers="['max', 'last']"
    />
  </div>
</template>

<style scoped>
.long-demo {
  width: 100%;
  display: grid;
  gap: 16px;
  justify-items: start;
}
</style>
