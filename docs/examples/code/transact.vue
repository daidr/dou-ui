<script setup>
import { codeCommands, DouCodeEditor } from '@dou-ui/code'
import { DouButton, DouSpace } from 'dou-ui'
import { ref } from 'vue'

const code = ref('function hello() {\n  return 1\n}\n')
const editor = ref()

// Wraps every selection in a call to `log(…)`, or adds an empty one at each cursor.
function wrap() {
  editor.value.transact((tr) => {
    tr.replaceSelection((range) => {
      const from = Math.min(range.anchor, range.head)
      const to = Math.max(range.anchor, range.head)
      return `log(${tr.doc.slice(from, to)})`
    })
  })
  editor.value.focus()
}

function comment() {
  editor.value.transact((tr) => {
    for (let n = 1; n <= tr.doc.lines; n++) {
      const line = tr.doc.line(n)
      if (line.text) tr.insert(line.from, '// ')
    }
  })
}
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouCodeEditor ref="editor" v-model="code" aria-label="事务示例" />
    <DouSpace wrap>
      <DouButton size="sm" @click="wrap">用 log() 包起选区</DouButton>
      <DouButton size="sm" @click="comment">注释每一行</DouButton>
      <DouButton size="sm" @click="editor.run(codeCommands.selectAll)">全选</DouButton>
    </DouSpace>
  </DouSpace>
</template>
