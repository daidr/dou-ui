<script setup lang="ts">
import {
  createCodeWorkerPool,
  DouCodeDiff,
  remoteCodeLanguage,
  typescript,
  type CodeLanguage,
} from '@dou-ui/code'
import { DouSegmentedControl, DouSpace, DouText } from 'dou-ui'
import { computed, onBeforeUnmount, ref } from 'vue'

const pool = createCodeWorkerPool(
  () => new Worker(new URL('./worker/shiki-highlight.ts', import.meta.url), { type: 'module' }),
  { maxWorkers: 2 },
)
onBeforeUnmount(() => pool.dispose())

const rustRemote = remoteCodeLanguage({
  name: 'rust',
  comment: { line: '//', block: ['/*', '*/'] },
  indentAfter: /[{(]\s*$/,
})

function buildRust(modified: boolean) {
  const head = [
    '// 在 Worker 中运行 Shiki 离主线程高亮，主线程不加载 Shiki',
    'use std::collections::HashMap;',
    '',
    'pub struct Order {',
    '    pub city: String,',
    '    pub amount: u64,',
    modified ? '    pub vip: bool,' : null,
    '}',
    '',
    'pub fn total_by_city(orders: &[Order]) -> HashMap<&str, u64> {',
    '    let mut totals = HashMap::new();',
    '    for order in orders {',
    modified
      ? '        let bonus = if order.vip { 10 } else { 0 };\n        *totals.entry(order.city.as_str()).or_insert(0) += order.amount + bonus;'
      : '        *totals.entry(order.city.as_str()).or_insert(0) += order.amount;',
    '    }',
    '    totals',
    '}',
    '',
  ].filter((line): line is string => line !== null)
  const rest = Array.from({ length: 120 }, (_, i) =>
    modified && i === 12
      ? `pub fn helper_${i}(x: u64) -> u64 { x.saturating_mul(2) + ${i} }`
      : `pub fn helper_${i}(x: u64) -> u64 { x + ${i} }`,
  )
  return [...head, ...rest].join('\n')
}

function buildTs(modified: boolean) {
  const head = [
    '// 内置 TypeScript 语法 + Worker 异步 diffText',
    'export interface Metric {',
    '  name: string',
    '  value: number',
    modified ? '  unit: "ms" | "count"' : null,
    '}',
    '',
    'export function summarize(metrics: Metric[]): number {',
    modified
      ? '  return metrics.reduce((sum, item) => sum + Math.max(0, item.value), 0)'
      : '  return metrics.reduce((sum, item) => sum + item.value, 0)',
    '}',
    '',
  ].filter((line): line is string => line !== null)
  const rest = Array.from({ length: 120 }, (_, i) =>
    modified && i === 15
      ? `export const factor${i}: number = ${i * 2}`
      : `export const factor${i}: number = ${i}`,
  )
  return [...head, ...rest].join('\n')
}

const files: Record<
  'rust' | 'ts',
  { label: string; language: CodeLanguage; original: string; modified: string }
> = {
  rust: {
    label: 'Rust（Shiki 离主线程）',
    language: rustRemote,
    original: buildRust(false),
    modified: buildRust(true),
  },
  ts: {
    label: 'TypeScript（内置检查点）',
    language: typescript,
    original: buildTs(false),
    modified: buildTs(true),
  },
}

const active = ref<'rust' | 'ts'>('rust')
const current = computed(() => files[active.value])
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouSpace wrap align="center">
      <DouSegmentedControl
        v-model="active"
        size="sm"
        :options="[
          { label: files.rust.label, value: 'rust' },
          { label: files.ts.label, value: 'ts' },
        ]"
      />
      <DouText variant="secondary" size="sm">
        共用 Worker 池（syncHighlightLines: 0、syncDiffLines: 0）
      </DouText>
    </DouSpace>
    <DouCodeDiff
      :key="active"
      :original="current.original"
      :model-value="current.modified"
      :language="current.language"
      :worker="pool"
      :sync-highlight-lines="0"
      :sync-diff-lines="0"
      style="height: 360px"
    />
  </DouSpace>
</template>
