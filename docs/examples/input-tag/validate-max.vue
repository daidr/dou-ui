<script setup>
import { ref } from 'vue'

const emails = ref(['daidr@daidr.me'])
const isEmail = (tag) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tag)
</script>

<template>
  <DouInputTag v-model="emails" :validate="isEmail" :max="3" placeholder="输入邮箱" />
</template>
