<script setup>
import { ref } from 'vue'
import { en } from 'dou-ui'

const keyword = ref('dou-ui')
</script>

<template>
  <DouConfigProvider :locale="en">
    <DouSpace size="sm">
      <DouInput v-model="keyword" clearable style="width: 200px" />
      <DouTag closable>closable</DouTag>
    </DouSpace>
  </DouConfigProvider>
</template>
