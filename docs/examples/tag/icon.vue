<script setup>
import { TagIcon } from '@dou-ui/icons'
</script>

<template>
  <DouTag size="sm">
    <template #leading><TagIcon /></template>
    标签
  </DouTag>
  <DouTag>
    <template #leading><TagIcon /></template>
    标签
  </DouTag>
  <DouTag size="lg" variant="outline">
    <template #leading><TagIcon /></template>
    标签
  </DouTag>
</template>
