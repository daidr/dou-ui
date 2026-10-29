<script setup>
import { ref } from 'vue'

const city = ref(null)
const cities = [
  { label: '华东', options: ['上海', '杭州', '南京', '苏州', '合肥'] },
  { label: '华北', options: ['北京', '天津', '石家庄', '太原'] },
  { label: '华南', options: ['广州', '深圳', '厦门', '南宁'] },
]
</script>

<template>
  <DouListbox
    v-model="city"
    :options="cities"
    filterable
    :max-height="240"
    aria-label="城市"
    style="width: 240px"
  />
</template>
