<script setup>
import { ref } from 'vue'

const open = ref(false)
const size = ref(420)
</script>

<template>
  <DouButton variant="outline" @click="open = true">查看日志</DouButton>
  <DouText variant="tertiary" size="sm">当前宽度：{{ size }}px</DouText>
  <DouDrawer v-model:open="open" v-model:size="size" title="构建日志" resizable :min-size="320">
    <pre class="log">
12:04:11  安装依赖…
12:04:19  构建 dou-ui…
12:04:42  构建完成，耗时 23 秒
12:04:43  分发到 18 个节点
12:04:50  部署完成，由戴兜触发</pre>
  </DouDrawer>
</template>

<style scoped>
.log {
  margin: 0;
  color: var(--dou-color-text-secondary);
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
  white-space: pre-wrap;
}
</style>
