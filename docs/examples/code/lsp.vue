<script setup>
import { DouCodeEditor, javascript } from '@dou-ui/code'
import { createLanguageClient, workerTransport } from '@dou-ui/code/lsp'
import { ref } from 'vue'

const code = ref(`// 戴兜的上海月报
const orders = loadOrders('上海')
const total = sumBy(orders, 'amount')
const byShop = groupBy(orders, 'shop')

function line(name, value) {
  return name + '：' + formatMoney(value)
}

report.addRow([line('总额', total)])
notify('戴兜', line('上海', total))
sendMail(total)
`)

// 语言服务跑在 worker 里，第一个编辑器挂载时才启动，最后一个卸载时关掉
const client = createLanguageClient({
  transport: () =>
    workerTransport(
      new Worker(new URL('./lsp/script-server.ts', import.meta.url), { type: 'module' }),
    ),
})
const server = client.document({ uri: 'file:///report.js', languageId: 'javascript' })
</script>

<template>
  <DouCodeEditor
    v-model="code"
    :language="javascript"
    :extensions="[server]"
    aria-label="语言服务示例"
  />
</template>
