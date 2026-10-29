<script setup>
import { HomeIcon, RefreshIcon, WifiOffIcon } from '@dou-ui/icons'
import { toast } from 'dou-ui'
import { ref } from 'vue'

const pages = [
  { value: '404', label: '404' },
  { value: '403', label: '403' },
  { value: '500', label: '500' },
  { value: 'offline', label: '网络断开' },
]
const current = ref('404')

// 示例数据
const requestId = 'req_7f3a9c21e0b4'

const retrying = ref(false)
function retry() {
  retrying.value = true
  setTimeout(() => {
    retrying.value = false
    toast.danger('仍然无法连接，请检查网络')
  }, 1200)
}
</script>

<template>
  <div class="errors">
    <DouSegmentedControl v-model="current" :options="pages" size="sm" />

    <div class="errors__page">
      <DouResult
        v-if="current === '404'"
        class="errors__coded"
        title="页面不存在"
        description="链接可能已经失效，或者页面已被移动。"
      >
        <template #icon><span class="errors__code">404</span></template>
        <DouButton variant="solid">
          <template #leading><HomeIcon /></template>
          返回首页
        </DouButton>
        <DouButton variant="ghost">上一页</DouButton>
      </DouResult>

      <DouResult
        v-else-if="current === '403'"
        class="errors__coded"
        title="没有访问权限"
        description="你当前的账号无法查看这个项目。可以向项目管理员申请权限。"
      >
        <template #icon><span class="errors__code">403</span></template>
        <DouButton variant="solid">申请权限</DouButton>
        <DouButton variant="ghost">切换账号</DouButton>
      </DouResult>

      <DouResult
        v-else-if="current === '500'"
        status="danger"
        title="服务出错了"
        description="我们已经记录了这个问题，请稍后再试。如果一直出现，请把下面的编号发给我们。"
      >
        <DouButton variant="solid">
          <template #leading><RefreshIcon /></template>
          重新加载
        </DouButton>
        <DouButton variant="ghost">联系支持</DouButton>
        <template #extra>
          <div class="errors__detail">
            <DouText size="sm" variant="secondary">错误编号</DouText>
            <DouText size="sm" mono>{{ requestId }}</DouText>
            <DouCopyButton :text="requestId" size="sm" />
          </div>
        </template>
      </DouResult>

      <DouEmpty v-else title="网络已断开" description="连接恢复后会自动重新加载，也可以手动重试。">
        <template #icon><WifiOffIcon /></template>
        <DouButton variant="outline" :loading="retrying" @click="retry">重试</DouButton>
      </DouEmpty>
    </div>
  </div>
</template>

<style scoped>
.errors {
  display: grid;
  gap: 16px;
  width: 100%;
  justify-items: start;
}
.errors__page {
  display: grid;
  place-items: center;
  justify-self: stretch;
  min-height: 400px;
  padding: 24px 16px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-canvas);
}
/* 状态码代替图标，不需要图标的底框 */
.errors__coded :deep(.dou-result__icon) {
  width: auto;
  height: auto;
  border: 0;
  background: none;
  box-shadow: none;
}
.errors__code {
  color: var(--dou-color-text-tertiary);
  font-size: 56px;
  font-weight: var(--dou-font-weight-bold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.02em;
}
.errors__detail {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
