<script setup>
import { ref } from 'vue'

const page2 = ref(6)
const pageSize = ref(20)
</script>

<template>
  <DouPagination
    v-model:page="page2"
    v-model:page-size="pageSize"
    :total="500"
    show-total
    :page-sizes="[10, 20, 50, 100]"
  />
</template>
