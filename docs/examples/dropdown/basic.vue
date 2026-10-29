<script setup>
import { ref } from 'vue'

const last = ref('无')
</script>

<template>
  <DouDropdown @select="(value) => (last = value)">
    <DouButton variant="outline">更多操作</DouButton>
    <template #menu>
      <DouDropdownItem value="访问">访问</DouDropdownItem>
      <DouDropdownItem value="重新部署">重新部署</DouDropdownItem>
      <DouDropdownItem value="提升为生产环境" disabled>提升为生产环境</DouDropdownItem>
      <DouDropdownItem value="删除部署" tone="danger" divided>删除部署</DouDropdownItem>
    </template>
  </DouDropdown>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</template>
