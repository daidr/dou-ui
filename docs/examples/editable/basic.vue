<script setup>
import { ref } from 'vue'

const title = ref('上海办公室搬迁计划')
const note = ref('')
</script>

<template>
  <div class="card">
    <h3 class="title"><DouEditable v-model="title" /></h3>
    <DouText variant="tertiary" size="sm">负责人：戴兜</DouText>
    <DouEditable v-model="note" placeholder="添加备注" multiline />
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 360px;
}
.title {
  margin: 0;
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-lg);
  font-weight: var(--dou-font-weight-bold);
  line-height: 28px;
}
</style>
