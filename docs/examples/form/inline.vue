<script setup>
import { reactive } from 'vue'

const filters = reactive({ keyword: '', status: 'all' })
</script>

<template>
  <DouForm :model="filters" layout="inline" size="sm">
    <DouFormItem label="关键词">
      <DouInput v-model="filters.keyword" clearable placeholder="搜索" style="width: 180px" />
    </DouFormItem>
    <DouFormItem label="状态">
      <DouRadioGroup v-model="filters.status">
        <DouRadio value="all">全部</DouRadio>
        <DouRadio value="ready">就绪</DouRadio>
        <DouRadio value="failed">失败</DouRadio>
      </DouRadioGroup>
    </DouFormItem>
    <DouFormItem>
      <DouButton variant="outline">筛选</DouButton>
    </DouFormItem>
  </DouForm>
</template>
