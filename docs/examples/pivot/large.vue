<script setup>
import { DouSegmentedControl } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { onMounted, ref, shallowRef, watch } from 'vue'
import { fields, orderColumnSteps } from './orders'

// 大数据放在 shallowRef 里：整体替换，不需要逐项响应
const data = shallowRef({})
const count = ref(100_000)
const loading = ref(false)
const config = ref({
  rows: ['region', 'city', 'category'],
  columns: ['quarter', 'month'],
  values: ['amount', { field: 'cups', aggregate: 'sum' }],
})

let run = 0
// 按列生成，每生成 2 万条让出一次主线程，生成时页面也能操作
async function load(n) {
  const id = ++run
  loading.value = true
  const steps = orderColumnSteps(n, n)
  let step
  do {
    await new Promise((resolve) => setTimeout(resolve))
    if (id !== run) return
    step = steps.next()
  } while (!step.done)
  data.value = step.value
  loading.value = false
}

onMounted(() => load(count.value))
watch(count, load)
</script>

<template>
  <div class="pivot-demo">
    <div class="bar">
      <DouSegmentedControl
        v-model="count"
        size="sm"
        :options="[
          { value: 100_000, label: '10 万条' },
          { value: 1_000_000, label: '100 万条' },
        ]"
      />
      <span class="note">{{
        loading
          ? '正在生成数据…'
          : count > 100_000
            ? '在 worker 中汇总，汇总时页面照常响应'
            : '在页面中直接汇总'
      }}</span>
    </div>
    <DouPivot v-model:config="config" :data="data" :fields="fields" :max-height="440" />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.note {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
