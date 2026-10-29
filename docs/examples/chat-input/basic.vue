<script setup>
import { ref } from 'vue'

const text = ref('')
const sent = ref([])

function send(value) {
  sent.value.push(value)
  text.value = ''
}
</script>

<template>
  <DouChatInput v-model="text" @submit="send" />
  <p v-if="sent.length" class="sent">已发送：{{ sent.at(-1) }}</p>
</template>

<style scoped>
.sent {
  margin: 0;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
