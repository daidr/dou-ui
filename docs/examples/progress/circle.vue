<script setup>
import { ref } from 'vue'

const value = ref(64)
</script>

<template>
  <div class="row">
    <DouProgress type="circle" :value="value" show-value label="上传进度" />
    <DouProgress type="circle" :value="100" tone="success" show-value label="已完成">
      <template #value>
        <span class="done">完成</span>
      </template>
    </DouProgress>
    <DouProgress type="circle" :width="48" size="sm" :value="value" tone="primary" label="小号" />
    <DouProgress type="circle" :width="48" size="sm" label="加载中" />
  </div>
  <div class="row">
    <DouButton size="sm" variant="outline" @click="value = Math.max(0, value - 10)">-10</DouButton>
    <DouButton size="sm" variant="outline" @click="value = Math.min(100, value + 10)">+10</DouButton>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
}
.done {
  font-size: var(--dou-font-size-sm);
}
</style>
