<script setup>
import { ref } from 'vue'

const text = ref('https://ui.daidr.me')
</script>

<template>
  <DouQrcode :value="text" />
  <DouInput v-model="text" style="max-width: 280px" placeholder="输入文字或链接" />
</template>
