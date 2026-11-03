<script setup>
import { ref } from 'vue'

const current = ref(2)
const items = [
  { title: '提交申请' },
  { title: '部门审批' },
  { title: '财务复核' },
  { title: '法务确认' },
  { title: '总经理签字' },
  { title: '盖章' },
  { title: '归档' },
  { title: '通知申请人' },
]
</script>

<template>
  <DouSteps v-model:current="current" :items="items" clickable />
  <DouSpace>
    <DouButton size="sm" variant="outline" :disabled="current === 0" @click="current--">
      上一步
    </DouButton>
    <DouButton size="sm" :disabled="current === items.length - 1" @click="current++">
      下一步
    </DouButton>
  </DouSpace>
</template>
