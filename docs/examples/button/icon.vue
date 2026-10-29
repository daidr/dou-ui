<script setup>
import { ArrowRightIcon, PlusIcon } from '@dou-ui/icons'
</script>

<template>
  <DouButton variant="outline">
    <template #leading><PlusIcon /></template>
    新建
  </DouButton>
  <DouButton variant="ghost">
    下一步
    <template #trailing><ArrowRightIcon /></template>
  </DouButton>
</template>
