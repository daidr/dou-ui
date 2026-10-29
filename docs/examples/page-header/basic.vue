<script setup>
import { ref } from 'vue'

const backs = ref(0)
</script>

<template>
  <DouPageHeader title="订单详情" subtitle="SH-20261029-0042" @back="backs++" />
  <DouText size="sm" variant="tertiary">点了 {{ backs }} 次返回</DouText>
</template>
