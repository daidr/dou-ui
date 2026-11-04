<script setup>
import { GlobeIcon, SearchIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const live = ref(false)
</script>

<template>
  <DouSwitch v-model="live">正在运行</DouSwitch>
  <DouChatSteps
    :live="live"
    open
    :items="[
      { label: '搜索网页', detail: '上海 周末 展览', icon: SearchIcon },
      { label: '阅读网页', detail: 'westbund.example.com', icon: GlobeIcon, status: 'running' },
    ]"
  />
</template>
