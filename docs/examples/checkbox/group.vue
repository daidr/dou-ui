<script setup>
import { computed, ref } from 'vue'

const all = ['邮件', '短信', '站内信']
const channels = ref(['邮件'])
const allChecked = computed({
  get: () => channels.value.length === all.length,
  set: (value) => (channels.value = value ? [...all] : []),
})
const partly = computed(() => channels.value.length > 0 && channels.value.length < all.length)
</script>

<template>
  <DouCheckbox v-model="allChecked" :indeterminate="partly">全部渠道</DouCheckbox>
  <DouCheckboxGroup v-model="channels">
    <DouCheckbox v-for="item in all" :key="item" :value="item">{{ item }}</DouCheckbox>
  </DouCheckboxGroup>
  <DouText variant="tertiary" size="sm">已选：{{ channels.join('、') || '无' }}</DouText>
</template>
