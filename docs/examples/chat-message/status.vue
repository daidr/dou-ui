<script setup>
import { RefreshIcon } from '@dou-ui/icons'
import { onBeforeUnmount, ref } from 'vue'

const current = ref('sending')
const retryStatus = ref('error')
let timer

function retry() {
  retryStatus.value = 'sending'
  clearTimeout(timer)
  timer = setTimeout(() => {
    retryStatus.value = 'sent'
  }, 1200)
}

onBeforeUnmount(() => clearTimeout(timer))

const options = [
  { label: '发送中', value: 'sending' },
  { label: '已送达', value: 'sent' },
  { label: '发送失败', value: 'error' },
]

const filesOnly = [
  {
    type: 'files',
    files: [{ uid: '1', name: '滴水湖骑行路线.gpx', size: 184320 }],
  },
]
</script>

<template>
  <div class="status-demo__bar">
    <DouSegmentedControl v-model="current" size="sm" :options="options" />
  </div>

  <DouChatMessage sender="user" :status="current" content="周六上午九点在世纪公园集合。" editable />

  <DouChatMessage
    sender="user"
    status="sending"
    content="顺便帮我查一下周六上海南汇嘴观海公园附近的风向、气温和降水概率，如果下午风大我们就提前一小时出发。"
  />

  <DouChatMessage sender="user" status="sending" :parts="filesOnly" />

  <DouChatMessage
    sender="user"
    :status="retryStatus"
    content="路线文件也一并发你了，帮我看看坡度。"
  >
    <template #status="{ status }">
      <DouTooltip v-if="status === 'error'" content="发送失败，点击重试">
        <DouButton size="xs" variant="ghost" tone="danger" aria-label="重试发送" @click="retry">
          <RefreshIcon />
        </DouButton>
      </DouTooltip>
    </template>
  </DouChatMessage>
</template>

<style scoped>
.status-demo__bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
</style>
