<script setup>
import { LayersIcon, StoreIcon } from '@dou-ui/icons'
import { ref } from 'vue'

// 选项里有图标组件，放在普通数组里，不放进 ref
const options = [
  {
    value: 'sh',
    label: '上海门店',
    description: '静安、徐汇两家，按上周的人手排',
    icon: StoreIcon,
  },
  { value: 'all', label: '全部门店', description: '包括还没开业的浦东店', icon: LayersIcon },
]
const status = ref('waiting')
const answer = ref()

function onSelect(value) {
  answer.value = value
  status.value = 'answered'
}
</script>

<template>
  <DouChatQuestion
    title="下周的排班要覆盖哪些门店？"
    :options="options"
    :status="status"
    :answer="answer"
    @select="onSelect"
  />
  <div v-if="status !== 'waiting'">
    <DouButton size="sm" variant="ghost" @click="status = 'waiting'">重置</DouButton>
  </div>
</template>
