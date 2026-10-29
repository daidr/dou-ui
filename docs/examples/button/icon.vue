<script setup>
import { PlusIcon } from '@dou-ui/icons'
</script>

<template>
  <DouButton size="sm" variant="outline">
    <template #leading><PlusIcon /></template>
    新建
  </DouButton>
  <DouButton variant="outline">
    <template #leading><PlusIcon /></template>
    新建
  </DouButton>
  <DouButton size="lg" variant="outline">
    <template #leading><PlusIcon /></template>
    新建
  </DouButton>
</template>
