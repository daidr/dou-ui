<script setup>
import { DouButton, DouSpace } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { onMounted, ref, shallowRef } from 'vue'
import { fields, makeOrderColumns } from './orders'

// 大数据放在 shallowRef 里：整体替换，不需要逐项响应
const data = shallowRef({})
const count = ref(0)
const config = ref({
  rows: ['region', 'city', 'category'],
  columns: ['quarter', 'month'],
  values: ['amount', { field: 'cups', aggregate: 'sum' }],
})

function load(n) {
  // 按列生成：每个字段一个数组
  data.value = makeOrderColumns(n, n)
  count.value = n
}

onMounted(() => load(100_000))
</script>

<template>
  <div class="pivot-demo">
    <DouSpace>
      <DouButton size="sm" :disabled="count === 100_000" @click="load(100_000)">10 万条</DouButton>
      <DouButton size="sm" :disabled="count === 1_000_000" @click="load(1_000_000)"
        >100 万条</DouButton
      >
      <span class="note">{{
        count > 100_000
          ? `${count.toLocaleString()} 条订单，在 worker 中汇总，汇总时页面照常响应`
          : `${count.toLocaleString()} 条订单，在页面中直接汇总`
      }}</span>
    </DouSpace>
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
.note {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
