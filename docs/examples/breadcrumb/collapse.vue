<script setup>
const items = [
  { label: '首页', href: '#' },
  { label: '项目', href: '#' },
  { label: 'dou-ui', href: '#' },
  { label: '部署', href: '#' },
  { label: '39dc86b' },
]
</script>

<template>
  <DouBreadcrumb :items="items" :max-items="3" />
</template>
