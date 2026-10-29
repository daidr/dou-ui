<script setup>
import { ref } from 'vue'

const page = ref(1)
const page2 = ref(6)
</script>

<template>
  <DouPagination v-model:page="page" :total="95" />
  <DouPagination v-model:page="page2" :total="500" />
</template>
