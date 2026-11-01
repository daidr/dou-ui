<script setup>
import {
  css,
  DouCodeEditor,
  json,
  markdown,
  python,
  shell,
  sql,
  typescript,
  vue,
  yaml,
} from '@dou-ui/code'
import { DouSelect, DouSpace } from 'dou-ui'
import { computed, ref } from 'vue'

const samples = {
  vue: {
    language: vue,
    code: `<script setup lang="ts">
import { ref } from 'vue'

const cups = ref(2)
${'<'}/script>

<template>
  <button :class="{ on: cups > 0 }" @click="cups++">
    戴兜点了 {{ cups }} 杯
  </button>
</template>

<style scoped>
.on {
  color: #3f56b5;
}
</style>
`,
  },
  typescript: {
    language: typescript,
    code: `type Sugar = '无糖' | '半糖' | '全糖'

/** 同一种甜度一共几杯 */
export function cupsOf(orders: { sugar: Sugar; cups: number }[], sugar: Sugar) {
  return orders
    .filter((order) => order.sugar === sugar)
    .reduce((sum, order) => sum + order.cups, 0)
}
`,
  },
  css: {
    language: css,
    code: `.menu > li:hover {
  color: var(--dou-color-text);
  padding: 4px 12px;
  background: rgb(0 0 0 / 0.04) !important;
}

@media (min-width: 640px) {
  .menu { display: flex; }
}
`,
  },
  json: {
    language: json,
    code: `{
  "shop": "上海一店",
  "open": true,
  "seats": 24,
  "menu": ["奶茶", "果茶", null]
}
`,
  },
  markdown: {
    language: markdown,
    code: `# 今日菜单

- **奶茶**：半糖、*少冰*
- 果茶，见 [价目表](./price.md)

\`\`\`
每人限两杯
\`\`\`
`,
  },
  python: {
    language: python,
    code: `from dataclasses import dataclass


@dataclass
class Order:
    name: str
    cups: int = 1

    def total(self, price: float) -> float:
        """这一单的金额"""
        return self.cups * price  # 不含配送费


print(Order("戴兜", 2).total(12.5))
`,
  },
  shell: {
    language: shell,
    code: `#!/usr/bin/env bash
set -e

CITY="上海"
for shop in a b c; do
  echo "同步 $CITY 的 \${shop} 店" | tee -a sync.log
done

if [ -d dist ]; then
  rm -rf dist && bun run build --prod
fi
`,
  },
  sql: {
    language: sql,
    code: `-- 上海各店本周的杯数
SELECT shop, SUM(cups) AS total
FROM orders
WHERE city = '上海'
  AND created_at >= now() - INTERVAL '7 days'
GROUP BY shop
ORDER BY total DESC
LIMIT 10;
`,
  },
  yaml: {
    language: yaml,
    code: `# 读书会报名
name: 周末读书会
city: 上海
seats: 24
open: true
hosts:
  - 戴兜
  - 阿青
note: |
  14:00 签到
  14:30 开始分享
`,
  },
}

const options = [
  { label: 'Vue', value: 'vue' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Python', value: 'python' },
  { label: 'Shell', value: 'shell' },
  { label: 'SQL', value: 'sql' },
  { label: 'YAML', value: 'yaml' },
]
const current = ref('vue')
const codes = ref(Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, v.code])))
const language = computed(() => samples[current.value].language)
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouSelect v-model="current" :options="options" aria-label="语言" style="width: 160px" />
    <DouCodeEditor
      :key="current"
      v-model="codes[current]"
      :language="language"
      aria-label="语言示例"
    />
  </DouSpace>
</template>
