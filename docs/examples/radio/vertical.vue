<script setup>
import { ref } from 'vue'

const region = ref('sh')
</script>

<template>
  <DouRadioGroup v-model="region" direction="vertical">
    <DouRadio value="sh">华东（上海）</DouRadio>
    <DouRadio value="sz">华南（深圳）</DouRadio>
    <DouRadio value="bj" disabled>华北（北京）· 维护中</DouRadio>
  </DouRadioGroup>
</template>
