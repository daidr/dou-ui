<script setup>
import { HeartIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const warm = ref(4)
</script>

<template>
  <DouRate v-model="warm" tone="warning">
    <template #default="{ value }">
      <DouText variant="secondary" size="sm">{{ value }} 分</DouText>
    </template>
  </DouRate>
  <DouRate v-model="warm">
    <template #icon>
      <HeartIcon />
    </template>
  </DouRate>
</template>
