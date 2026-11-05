<script setup>
import { compactNumber, contextUsage, useLocale } from 'dou-ui'
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
// 和圆环同一口径：超过上限时是 100%，没有上限时是 0%
const meter = contextUsage(used, total)

// 一行数字：悬停提示、按钮名称和弹层顶部共用，触屏和读屏也能拿到
const hint = computed(() =>
  t('chat.context', {
    used: compactNumber(meter.used),
    total: compactNumber(meter.total),
    percent: meter.percent,
  }),
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
      <DouButton variant="ghost" size="sm" :aria-label="hint">
        <DouChatContextMeter :used="used" :total="total" />
      </DouButton>
      <template #content>
        <p class="summary">{{ hint }}</p>
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
.summary {
  margin: 0 0 12px;
  font-size: var(--dou-font-size-sm);
  font-variant-numeric: tabular-nums;
}
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
