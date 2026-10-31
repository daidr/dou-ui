<script setup>
import { DouCodeEditor } from '@dou-ui/code'
import { DouButton, DouSpace, DouText } from 'dou-ui'
import { computed, ref } from 'vue'

const code = ref('const greeting = "你好，戴兜"\nconst count = 3\n\nexport { greeting, count }\n')
const selection = ref({ ranges: [{ anchor: 6, head: 14 }], main: 0 })
const editor = ref()

const summary = computed(() =>
  selection.value.ranges.map((range) => `${range.anchor} → ${range.head}`).join('，'),
)

function selectCount() {
  const from = code.value.indexOf('count')
  editor.value.select(from, from + 'count'.length)
  editor.value.focus()
}
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouCodeEditor
      ref="editor"
      v-model="code"
      v-model:selection="selection"
      aria-label="选区示例"
    />
    <DouSpace align="center" wrap>
      <DouButton size="sm" @click="selectCount">选中 count</DouButton>
      <DouButton size="sm" :disabled="!editor?.canUndo" @click="editor.undo()">撤销</DouButton>
      <DouText variant="secondary" size="sm">选区：{{ summary }}</DouText>
    </DouSpace>
  </DouSpace>
</template>
