<script setup>
import { ref } from 'vue'

const names = ['设计', '研发', '运营']
const name = ref('设计')

const validate = (value) => {
  if (!value.trim()) return '名称不能为空'
  if (value !== name.value && names.includes(value)) return '已有同名分组'
  return true
}
</script>

<template>
  <div class="row">
    <DouText variant="secondary">分组名称</DouText>
    <DouEditable v-model="name" :validate="validate" :maxlength="12" />
  </div>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: auto minmax(0, 200px);
  align-items: baseline;
  gap: 16px;
}
</style>
