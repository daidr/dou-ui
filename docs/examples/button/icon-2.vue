<script setup>
import { ArrowRightIcon } from '@dou-ui/icons'
</script>

<template>
  <DouButton size="sm" variant="soft">
    下一步
    <template #trailing><ArrowRightIcon /></template>
  </DouButton>
  <DouButton variant="soft">
    下一步
    <template #trailing><ArrowRightIcon /></template>
  </DouButton>
  <DouButton size="lg" variant="soft">
    下一步
    <template #trailing><ArrowRightIcon /></template>
  </DouButton>
</template>
