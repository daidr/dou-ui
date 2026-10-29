<script setup>
import { ref } from 'vue'

const open = ref(['build'])
</script>

<template>
  <DouCollapse v-model="open">
    <DouCollapseItem value="build" title="构建设置">
      构建命令 <code>bun run build</code>，输出目录 <code>dist</code>。
    </DouCollapseItem>
    <DouCollapseItem value="env" title="环境变量">
      共 4 个变量，其中 1 个仅在生产环境可见。
    </DouCollapseItem>
    <DouCollapseItem value="danger" title="删除项目" disabled>删除后无法恢复。</DouCollapseItem>
  </DouCollapse>
</template>
