<script setup>
import { DouCodeEditor, defineCodeExtension, javascript } from '@dou-ui/code'
import { ref } from 'vue'

const code = ref(`// 戴兜的周报脚本
const tasks = loadTasks('戴兜', 44)

`)

// 脚本里能用的函数，补全、悬停说明和参数提示都从这里来
const api = {
  loadTasks: {
    params: ['owner: string', 'week?: number'],
    returns: 'Task[]',
    info: '读取某人的任务；不传 week 时是本周',
  },
  sendReport: {
    params: ['to: string', 'title: string', 'body: string'],
    returns: 'void',
    info: '把周报发给某人',
  },
  formatDate: {
    params: ['date: Date', 'pattern: string'],
    returns: 'string',
    info: '按格式写出日期，比如 YYYY-MM-DD',
  },
}
const taskFields = [
  { label: 'title', detail: 'string', info: '任务标题' },
  { label: 'owner', detail: 'string', info: '负责人' },
  { label: 'done', detail: 'boolean', info: '是否已完成' },
  { label: 'due', detail: 'Date', info: '截止日期' },
]
const keywords = ['const', 'let', 'return', 'if', 'else', 'function']
const signatureOf = (name) => `${name}(${api[name].params.join(', ')}): ${api[name].returns}`

const scriptApi = defineCodeExtension({
  name: 'script-api',
  // 输入 . 之后也弹出补全
  completionTriggers: ['.'],
  completion({ word }, editor) {
    // 点后面补任务的字段
    if (editor.doc.slice(word.from - 1, word.from) === '.')
      return {
        from: word.from,
        options: taskFields.map((field) => ({ ...field, kind: 'property' })),
      }
    return {
      from: word.from,
      options: [
        ...Object.entries(api).map(([name, item]) => ({
          label: name,
          kind: 'function',
          detail: `(${item.params.join(', ')})`,
          info: item.info,
          // 片段：Tab 在参数之间跳转
          snippet: `${name}(${item.params.map((param, i) => `\${${i + 1}:${param.split(/\??:/)[0]}}`).join(', ')})`,
        })),
        ...keywords.map((label) => ({ label, kind: 'keyword' })),
        {
          label: 'for',
          kind: 'snippet',
          detail: '遍历数组',
          snippet: 'for (const ${1:task} of ${2:tasks}) {\n\t$0\n}',
        },
      ],
    }
  },
  // 鼠标停在函数名上，或按 Mod + I
  hover(pos, editor) {
    const line = editor.doc.lineAt(pos)
    for (const match of line.text.matchAll(/\w+/g)) {
      const from = line.from + match.index
      const to = from + match[0].length
      if (pos >= from && pos <= to && api[match[0]])
        return { from, to, content: `${signatureOf(match[0])}\n${api[match[0]].info}` }
    }
    return null
  },
  // 光标在函数的括号里时，提示正在填的参数
  signature(pos, editor) {
    const before = editor.doc.slice(Math.max(0, pos - 400), pos)
    let depth = 0
    let commas = 0
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i]
      if (ch === ')') depth++
      else if (ch === ',' && depth === 0) commas++
      else if (ch === '(') {
        if (depth-- > 0) continue
        const name = /(\w+)\s*$/.exec(before.slice(0, i))?.[1]
        if (!name || !api[name]) return null
        const label = signatureOf(name)
        const params = []
        let at = name.length + 1
        for (const param of api[name].params) {
          params.push([at, at + param.length])
          at += param.length + 2
        }
        return { label, params, active: Math.min(commas, params.length - 1), info: api[name].info }
      } else if (ch === '\n' && depth === 0 && commas === 0) return null
    }
    return null
  },
})
</script>

<template>
  <DouCodeEditor
    v-model="code"
    :language="javascript"
    :extensions="[scriptApi]"
    aria-label="周报脚本"
    style="height: 240px"
  />
</template>
