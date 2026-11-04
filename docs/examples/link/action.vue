<script setup>
import { ref } from 'vue'

const archived = ref(true)
</script>

<template>
  <!-- one link whose words change, so focus stays on it after Enter or Space -->
  <DouText>
    <span aria-live="polite">{{ archived ? '已将 3 条通知归档。' : '通知已放回收件箱。' }}</span>
    <DouLink :tone="archived ? 'primary' : 'neutral'" @click="archived = !archived">
      {{ archived ? '撤销' : '重新归档' }}
    </DouLink>
  </DouText>
</template>
