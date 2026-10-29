<script setup>
import { ref } from 'vue'
import { BoldIcon, StarIcon } from '@dou-ui/icons'

const bold = ref(true)
const starred = ref(false)
</script>

<template>
  <DouToggle v-model:pressed="bold" aria-label="加粗">
    <BoldIcon />
  </DouToggle>
  <DouToggle v-model:pressed="starred" variant="outline">
    <template #leading>
      <StarIcon />
    </template>
    {{ starred ? '已关注' : '关注' }}
  </DouToggle>
</template>
