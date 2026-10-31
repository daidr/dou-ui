<script setup>
import { ref } from 'vue'

const page = ref(2048)
</script>

<template>
  <DouPagination v-model:page="page" :total="99990" show-jumper />
</template>
