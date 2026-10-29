<script setup>
import { ref } from 'vue'

const plan = ref('pro')
</script>

<template>
  <DouRadioGroup v-model="plan">
    <DouRadio value="hobby">个人版</DouRadio>
    <DouRadio value="pro">专业版</DouRadio>
    <DouRadio value="team">团队版</DouRadio>
  </DouRadioGroup>
  <DouText variant="tertiary" size="sm">当前：{{ plan }}</DouText>
</template>
