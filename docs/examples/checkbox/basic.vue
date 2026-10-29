<script setup>
import { ref } from 'vue'

const agreed = ref(true)
</script>

<template>
  <DouCheckbox v-model="agreed">我已阅读并同意服务条款</DouCheckbox>
</template>
