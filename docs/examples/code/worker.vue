<script setup>
import { DouCodeEditor, defineCodeExtension, javascript } from '@dou-ui/code'
import { ref } from 'vue'

const code = ref(`// 戴兜的月报脚本
const orders = loadOrders('上海')
const total = sumBy(orders, 'amount')
notify('戴兜', formatMoney(total))
sendMail(total)
`)

// 一个 worker，加上按 id 对上回复的小工具
let worker = null
let nextId = 0
const waiting = new Map()

function ask(message, signal) {
  if (!worker) {
    worker = new Worker(new URL('./worker/script-service.ts', import.meta.url), { type: 'module' })
    worker.addEventListener('message', ({ data }) => {
      waiting.get(data.id)?.(data.result)
      waiting.delete(data.id)
    })
  }
  const id = ++nextId
  return new Promise((resolve) => {
    waiting.set(id, resolve)
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no target origin
    worker.postMessage({ id, ...message })
    // 编辑器不再需要这次结果时（文字又变了），就不等它了
    signal?.addEventListener('abort', () => {
      waiting.delete(id)
      resolve(null)
    })
  })
}

const service = defineCodeExtension({
  name: 'worker',
  completion: ({ pos, signal }, { doc }) =>
    ask({ type: 'complete', text: doc.toString(), pos }, signal),
  lint: ({ doc }) => ask({ type: 'lint', text: doc.toString() }),
  setup: () => () => {
    worker?.terminate()
    worker = null
    waiting.clear()
  },
})
</script>

<template>
  <DouCodeEditor
    v-model="code"
    :language="javascript"
    :extensions="[service]"
    aria-label="worker 示例"
  />
</template>
