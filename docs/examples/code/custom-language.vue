<script setup>
import { defineCodeLanguage, DouCodeEditor } from '@dou-ui/code'
import { ref } from 'vue'

// 一个简单的 INI 配置语言：分号开头是注释，[节名]，键 = 值
const ini = defineCodeLanguage({
  name: 'ini',
  token(stream) {
    if (stream.sol() && stream.match(/^\s*;.*$/)) return 'comment'
    if (stream.sol() && stream.match(/^\s*\[[^\]]*\]/)) return 'keyword'
    if (stream.match(/^[\w.-]+(?=\s*=)/)) return 'property'
    if (stream.match(/^=\s*/)) return 'operator'
    if (stream.match(/^\d+$/)) return 'number'
    if (stream.match(/^(?:true|false)$/)) return 'keyword'
    stream.skipToEnd()
    return 'string'
  },
  comment: { line: ';' },
})

const code = ref(`; 门店配置
[shop]
name = 上海一店
seats = 24

[order]
max_cups = 2
allow_takeaway = true
`)
</script>

<template>
  <DouCodeEditor v-model="code" :language="ini" aria-label="自定义语言示例" />
</template>
