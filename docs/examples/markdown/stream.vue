<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const full = `好的，下面是给戴兜整理的**上海一日行程**：

1. 上午：外滩散步，看看万国建筑群
2. 中午：豫园附近吃小笼包，人均约 \`80\` 元
3. 下午：乘地铁 2 号线到陆家嘴

| 时间 | 地点 | 交通 |
| --- | --- | --- |
| 09:00 | 外滩 | 步行 |
| 12:00 | 豫园 | 步行 10 分钟 |
| 15:00 | 陆家嘴 | 地铁 2 号线 |

计算交通费的小脚本：

\`\`\`ts
const fares = [3, 4, 3]
const total = fares.reduce((sum, fare) => sum + fare, 0)
console.log(\`交通费共 \${total} 元\`)
\`\`\`

> 小提示：周末豫园人多，建议**错峰**前往。`

const content = ref('')
const streaming = ref(false)
let timer

// Imitates a reply arriving in chunks of uneven size.
function start() {
  clearTimeout(timer)
  content.value = ''
  streaming.value = true
  let index = 0
  const next = () => {
    index += 2 + Math.floor(Math.random() * 8)
    content.value = full.slice(0, index)
    if (index >= full.length) streaming.value = false
    else timer = setTimeout(next, 40 + Math.random() * 120)
  }
  next()
}

onMounted(start)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <DouMarkdown :content="content" :streaming="streaming" caret />
  <div>
    <DouButton size="sm" @click="start">重新播放</DouButton>
  </div>
</template>
