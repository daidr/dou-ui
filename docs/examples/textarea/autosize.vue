<script setup>
import { ref } from 'vue'

const note = ref('输入的内容越多，输入框就越高。\n超过最大行数后改为滚动。')
</script>

<template>
  <DouTextarea v-model="note" :autosize="{ minRows: 2, maxRows: 5 }" />
</template>
