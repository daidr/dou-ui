<script setup>
import { ref } from 'vue'

const page3 = ref(2)
</script>

<template>
  <DouPagination v-model:page="page3" :total="95" simple />
  <DouPagination v-model:page="page3" :total="95" size="sm" />
  <DouPagination v-model:page="page3" :total="95" size="lg" />
  <DouPagination :page="2" :total="95" disabled />
</template>
