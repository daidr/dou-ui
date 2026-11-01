<script setup lang="ts">
import { type CodeLanguage, DouCodeEditor } from '@dou-ui/code'
import { shikiLanguage } from '@dou-ui/code/shiki'
import { DouSelect, DouSpace } from 'dou-ui'
import { computed, onMounted, ref, shallowRef } from 'vue'

const samples: Record<string, string> = {
  rust: `// 按甜度统计杯数
use std::collections::HashMap;

struct Order<'a> {
    name: &'a str,
    sugar: &'a str,
    cups: u32,
}

fn cups_by_sugar(orders: &[Order]) -> HashMap<&str, u32> {
    let mut out = HashMap::new();
    for order in orders {
        *out.entry(order.sugar).or_insert(0) += order.cups;
    }
    out
}

fn main() {
    let orders = [Order { name: "戴兜", sugar: "半糖", cups: 2 }];
    println!("{:?}", cups_by_sugar(&orders));
}
`,
  go: `// 上海各店的订单数
package main

import "fmt"

type Shop struct {
	City   string
	Orders int
}

func main() {
	shops := []Shop{{"上海", 128}, {"苏州", 64}}
	total := 0
	for _, shop := range shops {
		total += shop.Orders
	}
	fmt.Printf("共 %d 单\\n", total)
}
`,
}

const options = [
  { label: 'Rust', value: 'rust' },
  { label: 'Go', value: 'go' },
]
const current = ref('rust')
const codes = ref({ ...samples })
const languages = shallowRef<Record<string, CodeLanguage>>({})
const language = computed(() => languages.value[current.value])

// Shiki 只在用到时加载；颜色来自编辑器的主题，不加载 Shiki 的主题
onMounted(async () => {
  const [{ createHighlighter }, { createJavaScriptRegexEngine }] = await Promise.all([
    import('shiki'),
    import('shiki/engine/javascript'),
  ])
  const highlighter = await createHighlighter({
    langs: ['rust', 'go'],
    themes: [],
    engine: createJavaScriptRegexEngine(),
  })
  languages.value = {
    rust: shikiLanguage(highlighter, 'rust', {
      comment: { line: '//', block: ['/*', '*/'] },
      indentAfter: /[{(]\s*$/,
    }),
    go: shikiLanguage(highlighter, 'go', {
      comment: { line: '//', block: ['/*', '*/'] },
      indentAfter: /[{(]\s*$/,
    }),
  }
})
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouSelect v-model="current" :options="options" aria-label="语言" style="width: 160px" />
    <DouCodeEditor
      :key="current"
      v-model="codes[current]"
      :language="language"
      :tab-size="current === 'go' ? 4 : 2"
      aria-label="Shiki 语言示例"
    />
  </DouSpace>
</template>
