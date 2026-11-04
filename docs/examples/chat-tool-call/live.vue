<script setup>
import { ref } from 'vue'

const live = ref(false)
</script>

<template>
  <DouSwitch v-model="live">正在运行</DouSwitch>
  <DouChatToolCall
    title="正在搜索：上海 滨江 骑行路线"
    status="running"
    :live="live"
    :input="{ query: '上海 滨江 骑行路线' }"
  />
</template>
