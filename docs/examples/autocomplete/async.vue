<script setup>
import { ref } from 'vue'

const city = ref('')
const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安', '苏州']
const search = (query) =>
  new Promise((resolve) =>
    setTimeout(
      () =>
        resolve(
          cities.filter((c) => c.includes(query)).map((c) => ({ value: c, description: '城市' })),
        ),
      400,
    ),
  )
</script>

<template>
  <DouAutocomplete
    v-model="city"
    :fetch="search"
    :min-length="1"
    placeholder="城市"
    clearable
    style="width: 240px"
  />
</template>
