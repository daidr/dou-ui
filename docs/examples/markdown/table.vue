<script setup>
import { ref } from 'vue'

const width = ref('360px')

const content = `| 配置项 | 环境变量 | 类型 | 默认值 | 配置文件路径 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 服务端口 | \`DOU_SERVER_PORT\` | \`number\` | \`3000\` | \`packages/web/vite.config.ts\` | 上海本地预览服务的监听端口，端口占用时可调整 |
| 接口地址 | \`DOU_API_BASE_URL\` | \`string\` | \`https://api.example.com/v1/shanghai/stores/overview\` | \`packages/server/src/config/runtime-environment-options.ts\` | 戴兜用于切换测试与生产环境的接口基准地址，超长路径到达上限后自动折行 |
| 缓存策略 | \`DOU_CACHE_MODE\` | \`string\` | \`stale-while-revalidate\` | \`packages/web/src/cache/policy.ts\` | 控制离线读取时的缓存刷新方式 |`
</script>

<template>
  <div class="markdown-table-demo">
    <DouSegmentedControl
      v-model="width"
      :options="[
        { value: '360px', label: '360px' },
        { value: '100%', label: '100%' },
      ]"
    />
    <div class="markdown-table-demo__frame" :style="{ width, maxWidth: '100%' }">
      <DouMarkdown :content="content" />
    </div>
  </div>
</template>

<style scoped>
.markdown-table-demo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.markdown-table-demo__frame {
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}
</style>
