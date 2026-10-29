<script setup>
import { SearchIcon } from '@dou-ui/icons'
import { ref } from 'vue'

const keyword = ref('dou-ui')
const price = ref('')
</script>

<template>
  <DouInput v-model="keyword" clearable style="width: 240px">
    <template #prefix>
      <DouIcon><SearchIcon /></DouIcon>
    </template>
  </DouInput>
  <DouInput v-model="price" placeholder="0.00" style="width: 160px">
    <template #prefix>¥</template>
    <template #suffix>元</template>
  </DouInput>
</template>
