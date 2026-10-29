<script setup>
import { CloudIcon, DatabaseIcon, GlobeIcon, ServerIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const services = ref(['compute', 'storage'])
const serviceOptions = [
  { value: 'compute', label: '云服务器', icon: ServerIcon },
  { value: 'storage', label: '对象存储', icon: CloudIcon },
  { value: 'database', label: '数据库', icon: DatabaseIcon },
  { value: 'cdn', label: '内容分发', icon: GlobeIcon },
]
</script>

<template>
  <DouListbox
    v-model="services"
    :options="serviceOptions"
    multiple
    aria-label="服务"
    style="width: 240px"
  />
  <DouText variant="secondary">已选：{{ services.join('、') || '无' }}</DouText>
</template>
