<script setup>
import { ref } from 'vue'

const modes = [
  { label: '跟随系统', value: 'auto' },
  { label: '减少', value: 'reduce' },
  { label: '关闭', value: 'none' },
]
const mode = ref('auto')
const open = ref(false)
</script>

<template>
  <DouConfigProvider :motion="mode">
    <DouSpace size="sm">
      <DouSegmentedControl v-model="mode" :options="modes" size="sm" />
      <DouButton size="sm" variant="outline" @click="open = true">打开抽屉</DouButton>
      <DouSpinner />
    </DouSpace>
    <DouDrawer v-model:open="open" title="通知设置"> 新消息会通过邮件和站内信通知你。 </DouDrawer>
  </DouConfigProvider>
</template>
