<script setup>
import { ref } from 'vue'

const cities = ref(['上海'])
</script>

<template>
  <DouInputTag v-model="cities" :separators="[' ', '、']" placeholder="用空格或顿号分隔" />
</template>
