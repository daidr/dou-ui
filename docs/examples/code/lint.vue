<script setup>
import { DouCodeEditor, defineCodeExtension, javascript } from '@dou-ui/code'
import { ref } from 'vue'

const code = ref(`// 戴兜的门店统计脚本
var stores = loadStores('上海')
var open = stores.filter((store) => store.open)
console.log(open.length)`)

// 找出 var 声明，给出“改成 let”的修复办法
const noVar = defineCodeExtension({
  name: 'no-var',
  lint: (editor) =>
    [...editor.doc.toString().matchAll(/\bvar\b/g)].map((match) => ({
      from: match.index,
      to: match.index + 3,
      severity: 'warning',
      message: '用 let 或 const 代替 var',
      source: 'no-var',
      actions: [
        {
          label: '改成 let',
          run: (context, problem) =>
            context.transact((tr) => tr.replace(problem.from, problem.to, 'let')),
        },
      ],
    })),
})
</script>

<template>
  <DouCodeEditor
    v-model="code"
    :language="javascript"
    :extensions="[noVar]"
    aria-label="诊断示例"
  />
</template>
