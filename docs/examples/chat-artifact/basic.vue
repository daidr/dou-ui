<script setup>
import { DownloadIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const active = ref('plan')
</script>

<template>
  <DouChatArtifact
    title="周六骑行计划.md"
    description="Markdown · 5 个时间点"
    :active="active === 'plan'"
    @open="active = 'plan'"
  />
  <DouChatArtifact
    kind="code"
    title="weather-card.vue"
    description="Vue 组件 · 86 行"
    :active="active === 'code'"
    @open="active = 'code'"
  />
  <DouChatArtifact kind="data" title="骑行记录.csv" description="表格 · 42 行">
    <template #actions>
      <DouButton variant="ghost" size="sm" aria-label="下载"><DownloadIcon /></DouButton>
    </template>
  </DouChatArtifact>
  <DouChatArtifact kind="image" title="路线图.png" status="generating" />
  <DouChatArtifact kind="web" title="活动报名页" status="error" />
</template>
