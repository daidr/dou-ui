<script setup>
const log = () => {}
</script>

<template>
  <DouAlert tone="danger" title="构建失败">
    类型检查未通过，详见构建日志。
    <template #action>
      <DouButton size="sm" variant="outline" @click="log">查看日志</DouButton>
    </template>
  </DouAlert>
  <DouAlert tone="warning" title="配额即将用尽" closable>本月的构建时长已用去 92%。</DouAlert>
</template>
