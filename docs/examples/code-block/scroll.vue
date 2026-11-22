<script setup>
import { onBeforeUnmount, ref } from 'vue'

const initialLines = [
  '$ bun test packages/dou-ui/src/components/code-block',
  'bun test v1.4.4',
  '[00:01] compiling packages/theme/src/components/code-block.css',
  '[00:02] loading DouCodeBlock test suite',
  '[00:03] PASS lines > splits highlighted HTML into lines',
  '[00:04] PASS DouCodeBlock > shows plain code line by line',
  '[00:05] PASS DouCodeBlock > floats copy button without header',
  '[00:06] PASS DouCodeBlock > scrolls inside maxHeight container',
]

const log = ref(initialLines.join('\n'))
const streaming = ref(false)
const atBottom = ref(true)
const blockRef = ref(null)
let timer = null
let step = initialLines.length

function appendLine() {
  step += 1
  const pad = String(step).padStart(2, '0')
  log.value += `\n[00:${pad}] PASS case #${step}: streaming output line for Shanghai build worker`
}

function toggleStream() {
  if (streaming.value) {
    clearInterval(timer)
    timer = null
    streaming.value = false
    return
  }
  streaming.value = true
  appendLine()
  timer = setInterval(() => {
    appendLine()
    if (step >= 30) {
      clearInterval(timer)
      timer = null
      streaming.value = false
    }
  }, 350)
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <DouSpace size="sm" wrap>
    <DouButton size="sm" @click="toggleStream">
      {{ streaming ? '停止输出' : '模拟流式输出' }}
    </DouButton>
    <DouButton size="sm" variant="outline" @click="appendLine">追加一行</DouButton>
    <DouButton
      v-if="!atBottom"
      size="sm"
      variant="outline"
      @click="blockRef?.scrollToBottom('smooth')"
    >
      回到底部
    </DouButton>
  </DouSpace>
  <DouCodeBlock
    ref="blockRef"
    :code="log"
    :max-height="180"
    :streaming="streaming"
    @at-bottom-change="atBottom = $event"
  />
</template>
