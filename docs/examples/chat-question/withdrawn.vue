<script setup>
import { ref } from 'vue'

const options = [
  { value: 'mon', label: '周一上午' },
  { value: 'wed', label: '周三下午' },
  { value: 'fri', label: '周五上午' },
]
const status = ref('waiting')
const answer = ref()

function toggle() {
  status.value = status.value === 'waiting' ? 'withdrawn' : 'waiting'
}
</script>

<template>
  <DouChatQuestion
    title="周会定在哪个时间？"
    :description="
      status === 'withdrawn' ? '戴兜已经在日历里定好了周三下午，不用再选了。' : undefined
    "
    :options="options"
    :status="status"
    :answer="answer"
    @select="(value) => ((answer = value), (status = 'answered'))"
  />
  <div>
    <DouButton size="sm" :variant="status === 'waiting' ? 'outline' : 'ghost'" @click="toggle">
      {{ status === 'waiting' ? '撤回提问' : '重置' }}
    </DouButton>
  </div>
</template>
