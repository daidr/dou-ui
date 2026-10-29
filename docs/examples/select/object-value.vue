<script setup>
import { ref } from 'vue'

const people = [
  { value: { id: 1, name: '戴兜', team: '平台组' }, label: '戴兜' },
  { value: { id: 2, name: '阿周', team: '业务组' }, label: '阿周' },
  { value: { id: 3, name: '小陈', team: '业务组' }, label: '小陈' },
]
const owner = ref({ id: 1, name: '戴兜', team: '平台组' })
</script>

<template>
  <DouSelect v-model="owner" :options="people" value-key="id" style="width: 200px" />
  <DouText variant="tertiary" size="sm">{{ JSON.stringify(owner) }}</DouText>
</template>
