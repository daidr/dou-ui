<script setup>
import { ref } from 'vue'

const saving = ref(false)
function save() {
  saving.value = true
  setTimeout(() => (saving.value = false), 1500)
}
</script>

<template>
  <DouButton variant="outline" :loading="saving" @click="save">保存</DouButton>
  <DouCard v-loading="{ loading: saving, text: '正在保存' }" title="环境变量" style="width: 100%">
    <DouText as="p" variant="secondary">DATABASE_URL、REDIS_URL 等 6 个变量</DouText>
  </DouCard>
</template>
