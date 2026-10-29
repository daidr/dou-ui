<script setup>
import { ref } from 'vue'

const picked = ref('')
</script>

<template>
  <DouChatSuggestions
    title="试试这样问"
    :items="['总结这篇文章', '翻译成英文', '换一种更正式的语气', '列出待办事项']"
    @select="picked = $event"
  />
  <p v-if="picked" class="picked">选择了：{{ picked }}</p>
</template>

<style scoped>
.picked {
  margin: 0;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
