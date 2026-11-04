<script setup>
import { ref } from 'vue'

const live = ref(false)
</script>

<template>
  <div class="demo">
    <DouSwitch v-model="live">正在运行</DouSwitch>
    <DouChatPlan
      title="整理会议纪要"
      :live="live"
      :items="[
        { label: '读取录音转写', status: 'done' },
        { label: '提取待办事项', status: 'running' },
        { label: '等待戴兜补充议题', status: 'waiting' },
        { label: '发到上海项目群' },
      ]"
    />
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.demo > :last-child {
  align-self: stretch;
}
</style>
