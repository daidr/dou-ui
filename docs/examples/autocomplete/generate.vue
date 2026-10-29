<script setup>
import { ref } from 'vue'

const email = ref('')
const domains = ['qq.com', '163.com', 'gmail.com', 'outlook.com']
const emailSuggest = (query) => {
  if (
    !query ||
    (query.includes('@') &&
      query.split('@')[1].length > 0 &&
      domains.some((d) => d === query.split('@')[1]))
  )
    return []
  const [name, host = ''] = query.split('@')
  return domains.filter((d) => d.startsWith(host)).map((d) => `${name}@${d}`)
}
</script>

<template>
  <DouAutocomplete
    v-model="email"
    :fetch="emailSuggest"
    :debounce="0"
    :min-length="1"
    :highlight="false"
    placeholder="邮箱"
    style="width: 240px"
  />
</template>
