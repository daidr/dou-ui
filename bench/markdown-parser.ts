// Parser cost of DouMarkdown, without a browser.
// Usage: bun bench/markdown-parser.ts
// Streams a long reply into the incremental parser a few characters at a
// time and compares it with parsing the whole text again on every chunk.
import {
  createMarkdownParser,
  parseMarkdown,
} from '../packages/dou-ui/src/components/markdown/parser'

const print = (line = '') => process.stdout.write(`${line}\n`)
const words = ['上海', '北京', '杭州', '深圳']
const sentence = '今天在上海讨论了组件库的虚拟滚动方案，'
function doc(lines: number) {
  const out: string[] = []
  for (let i = 0; out.length < lines; i++) {
    out.push(
      `## 第 ${i} 节`,
      '',
      `${sentence.repeat(3)}**重点 ${i}**，参考 [文档](https://example.com/${i}) 和 \`code\`。`,
      '',
      `- ${words[i % 4]}的第一项`,
      '- 第二项，*强调*',
      `  - 嵌套 ${i}`,
      '',
      '| 城市 | 数值 |',
      '| --- | --: |',
      `| ${words[(i + 1) % 4]} | ${i * 3} |`,
      '',
      '```ts',
      `const value${i} = compute(${i})`,
      '```',
      '',
    )
  }
  return out.join('\n')
}

const percentile = (list: number[], p: number) =>
  list.toSorted((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * p))]!

function whole(source: string) {
  const runs = Math.max(3, Math.round(2e6 / source.length))
  parseMarkdown(source)
  const start = performance.now()
  for (let i = 0; i < runs; i++) parseMarkdown(source)
  const ms = (performance.now() - start) / runs
  return { ms, mbps: source.length / 1e6 / (ms / 1000) }
}

function stream(source: string, chunk: number, incremental: boolean, limit = Infinity) {
  const parser = createMarkdownParser()
  const times: number[] = []
  let count = 0
  for (let i = chunk; i < source.length + chunk && count < limit; i += chunk, count++) {
    const part = source.slice(0, Math.min(i, source.length))
    const start = performance.now()
    if (incremental) parser.update(part)
    else createMarkdownParser().update(part)
    times.push(performance.now() - start)
  }
  return {
    p50: percentile(times, 0.5),
    p95: percentile(times, 0.95),
    max: Math.max(...times),
    count: times.length,
  }
}

const f = (x: number) => x.toFixed(3)
print('整篇解析')
print('大小\t耗时 ms\t吞吐 MB/s')
for (const lines of [300, 3000, 30000]) {
  const source = doc(lines)
  const { ms, mbps } = whole(source)
  print(`${(source.length / 1024).toFixed(0)} KB\t${ms.toFixed(2)}\t${mbps.toFixed(1)}`)
}

print('\n流式：每 4 个字符一次 update（ms / 次）')
print('大小\t方式\tp50\tp95\tmax\t次数')
for (const lines of [300, 3000]) {
  const source = doc(lines)
  const size = `${(source.length / 1024).toFixed(0)} KB`
  const inc = stream(source, 4, true)
  print(`${size}\t增量\t${f(inc.p50)}\t${f(inc.p95)}\t${f(inc.max)}\t${inc.count}`)
  // re-parsing everything is quadratic: measure the last 300 chunks only
  const tail = source.slice(0, source.length)
  const full = stream(tail, 4, false, lines > 1000 ? 300 : Infinity)
  if (lines > 1000) {
    const times: number[] = []
    for (let k = 0; k < 100; k++) {
      const part = source.slice(0, source.length - k * 4)
      const start = performance.now()
      createMarkdownParser().update(part)
      times.push(performance.now() - start)
    }
    print(
      `${size}\t整篇重解析（末尾）\t${f(percentile(times, 0.5))}\t${f(percentile(times, 0.95))}\t${f(Math.max(...times))}\t100`,
    )
  } else print(`${size}\t整篇重解析\t${f(full.p50)}\t${f(full.p95)}\t${f(full.max)}\t${full.count}`)
}
