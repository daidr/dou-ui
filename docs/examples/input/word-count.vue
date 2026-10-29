<script setup>
import { ref } from 'vue'

const bio = ref('住在上海')
</script>

<template>
  <DouInput v-model="bio" show-count maxlength="20" placeholder="一句话介绍" style="width: 240px" />
</template>
