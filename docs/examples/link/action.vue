<script setup>
import { ref } from 'vue'

const archived = ref(true)
</script>

<template>
  <DouText v-if="archived">
    已将 3 条通知归档。<DouLink tone="primary" @click="archived = false">撤销</DouLink>
  </DouText>
  <DouText v-else> 通知已放回收件箱。<DouLink @click="archived = true">重新归档</DouLink> </DouText>
</template>
