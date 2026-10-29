<script setup>
import { ref } from 'vue'

const summary = ref('一个为自己打造的 Vue 3 组件库')
</script>

<template>
  <DouTextarea v-model="summary" show-count maxlength="60" :rows="2" />
</template>
