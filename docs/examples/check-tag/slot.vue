<script setup>
import { CircleIcon, StarIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const filter = ref(['starred'])
</script>

<template>
  <DouCheckTagGroup v-model="filter" multiple size="sm">
    <DouCheckTag value="starred">
      <template #leading><StarIcon /></template>
      已加星标
    </DouCheckTag>
    <DouCheckTag value="unread">
      <template #leading><CircleIcon /></template>
      未读
    </DouCheckTag>
    <DouCheckTag value="mine">我负责的</DouCheckTag>
  </DouCheckTagGroup>
</template>
