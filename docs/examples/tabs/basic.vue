<script setup>
import { ref } from 'vue'

const tab = ref('overview')
</script>

<template>
  <DouTabs v-model="tab">
    <DouTabPanel value="overview" label="概览">项目的基本信息与最近一次部署。</DouTabPanel>
    <DouTabPanel value="deployments" label="部署">所有部署记录，按时间倒序。</DouTabPanel>
    <DouTabPanel value="logs" label="日志">实时运行日志。</DouTabPanel>
    <DouTabPanel value="billing" label="账单" disabled>账单</DouTabPanel>
    <DouTabPanel value="settings" label="设置">域名、环境变量与权限。</DouTabPanel>
  </DouTabs>
</template>
