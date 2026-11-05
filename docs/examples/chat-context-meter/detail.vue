<script setup>
import { compactNumber, useLocale } from 'dou-ui'
import { computed } from 'vue'

const { t } = useLocale()

// 这个会话的用量，来自应用自己的统计
const total = 200_000
const usage = {
  input: 38_400,
  output: 9_600,
  cacheWrite: 4_100,
  cacheRead: 61_800,
  compacted: 2,
}
const used = usage.input + usage.output + usage.cacheWrite
const percent = Math.round((used / total) * 100)

const hint = computed(() =>
  t('chat.context', { used: compactNumber(used), total: compactNumber(total), percent }),
)
const parts = [
  { label: '输入', value: usage.input },
  { label: '输出', value: usage.output },
  { label: '缓存写入', value: usage.cacheWrite },
]
const hitRate = Math.round((usage.cacheRead / (usage.cacheRead + usage.input)) * 100)
</script>

<template>
  <DouTooltip :content="hint">
    <DouPopover title="本次会话用量" placement="top-start" :width="280">
      <DouButton variant="ghost" size="sm" aria-label="上下文用量">
        <DouChatContextMeter :used="used" :total="total" />
      </DouButton>
      <template #content>
        <DouProgressGroup
          :items="parts"
          :max="total"
          legend
          label="上下文"
          :format="compactNumber"
        />
        <dl class="stats">
          <dt>缓存命中</dt>
          <dd>{{ hitRate }}%</dd>
          <dt>已压缩</dt>
          <dd>{{ usage.compacted }} 次</dd>
        </dl>
      </template>
    </DouPopover>
  </DouTooltip>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  margin: 12px 0 0;
  font-size: var(--dou-font-size-sm);
}
.stats dt {
  color: var(--dou-color-text-secondary);
}
.stats dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
