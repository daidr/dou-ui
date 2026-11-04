<script setup>
import { ref } from 'vue'

const status = ref('waiting')
const always = ref(false)

function decide(decision) {
  status.value = decision === 'deny' ? 'denied' : 'approved'
  always.value = decision === 'always'
}
</script>

<template>
  <DouChatConfirm
    title="运行命令？"
    description="将在项目目录里安装依赖"
    :status="status"
    allow-always
    @decide="decide"
  >
    <pre class="code">bun install</pre>
  </DouChatConfirm>
  <div v-if="status !== 'waiting'">
    <DouText size="sm" variant="tertiary">{{ always ? '以后不再询问。' : '' }}</DouText>
    <DouButton size="sm" variant="ghost" @click="status = 'waiting'">重置</DouButton>
  </div>
</template>

<style scoped>
.code {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-muted);
  font-family: var(--dou-font-family-mono);
  font-size: 12px;
}
</style>
