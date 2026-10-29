<script setup>
import { ref } from 'vue'

const text = ref('')
</script>

<template>
  <DouChatInput
    v-model="text"
    submit-on="mod-enter"
    :min-rows="3"
    placeholder="回车换行，Ctrl / ⌘ + 回车发送"
    @submit="text = ''"
  />
</template>
