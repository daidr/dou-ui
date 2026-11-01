// 在 worker 里运行的“语言服务”：补全和检查都在这里算，页面不卡
const api: Record<string, { params: string; info: string }> = {
  loadOrders: { params: '(city: string)', info: '读取某个城市的订单' },
  sumBy: { params: '(list, key: string)', info: '按字段求和' },
  groupBy: { params: '(list, key: string)', info: '按字段分组' },
  formatMoney: { params: '(value: number)', info: '写成金额，比如 ¥1,280.00' },
  notify: { params: '(to: string, text: string)', info: '给某人发一条消息' },
}
const keywords = ['const', 'let', 'return', 'if', 'else', 'for', 'of', 'function']

type ServiceRequest =
  | { id: number; type: 'complete'; text: string; pos: number }
  | { id: number; type: 'lint'; text: string }

function complete(text: string, pos: number) {
  const word = /[\w$]*$/.exec(text.slice(0, pos))![0]
  // 模拟一次耗时的分析
  const until = Date.now() + 30
  while (Date.now() < until);
  const declared = [...text.matchAll(/\b(?:const|let)\s+([\w$]+)/g)].map((m) => m[1]!)
  return {
    from: pos - word.length,
    options: [
      ...Object.entries(api).map(([label, { params, info }]) => ({
        label,
        kind: 'function',
        detail: params,
        info,
        snippet: `${label}($0)`,
      })),
      ...declared.map((label) => ({ label, kind: 'variable' })),
      ...keywords.map((label) => ({ label, kind: 'keyword' })),
    ],
  }
}

function lint(text: string) {
  const declared = new Set(
    [...text.matchAll(/\b(?:const|let|function)\s+([\w$]+)/g)].map((m) => m[1]!),
  )
  const out = []
  for (const match of text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = match[1]!
    if (api[name] || declared.has(name) || keywords.includes(name)) continue
    out.push({
      from: match.index!,
      to: match.index! + name.length,
      severity: 'warning',
      message: `没有叫 ${name} 的函数`,
      source: 'worker',
    })
  }
  return out
}

self.addEventListener('message', (event: MessageEvent<ServiceRequest>) => {
  const request = event.data
  const result =
    request.type === 'complete' ? complete(request.text, request.pos) : lint(request.text)
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage has no target origin
  self.postMessage({ id: request.id, result })
})
