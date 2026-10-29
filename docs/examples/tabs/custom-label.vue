<script setup>
import { ref } from 'vue'

const tab2 = ref('deployments')
</script>

<template>
  <DouTabs v-model="tab2">
    <DouTabPanel value="deployments">
      <template #label>部署 <DouBadge :value="12" /></template>
      12 条部署记录。
    </DouTabPanel>
    <DouTabPanel value="issues">
      <template #label>告警 <DouBadge :value="2" tone="danger" /></template>
      2 条未处理的告警。
    </DouTabPanel>
    <DouTabPanel value="members" label="成员">3 位成员。</DouTabPanel>
    <template #extra>
      <DouButton size="sm" variant="outline">新建部署</DouButton>
    </template>
  </DouTabs>
</template>
