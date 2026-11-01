<script setup lang="ts">
import {
  DouCodeDiff,
  DouCodeEditor,
  defineCodeExtension,
  javascript,
  type CodeDiagnostic,
} from '@dou-ui/code'
import { CheckIcon, PlayIcon, RotateCcwIcon, CloseIcon } from '@dou-ui/icons'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

/* 一道练习题：把以分为单位的金额写成带千分位的人民币 */
const starter = `/**
 * 把以分为单位的金额写成人民币。
 * 128050 写成 "¥1,280.50"，负号写在 ¥ 前面。
 */
function formatPrice(cents) {
  const yuan = cents / 100
  return '¥' + yuan
}
`

const answer = `/**
 * 把以分为单位的金额写成人民币。
 * 128050 写成 "¥1,280.50"，负号写在 ¥ 前面。
 */
function formatPrice(cents) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const yuan = Math.floor(abs / 100)
    .toString()
    .replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',')
  const fen = String(abs % 100).padStart(2, '0')
  return \`\${sign}¥\${yuan}.\${fen}\`
}
`

const cases = [
  { input: 128050, expected: '¥1,280.50' },
  { input: 0, expected: '¥0.00' },
  { input: 99, expected: '¥0.99' },
  { input: -500, expected: '-¥5.00' },
  { input: 100000000, expected: '¥1,000,000.00' },
]

const code = ref(starter)
const view = ref<'code' | 'diff'>('code')

interface Result {
  input: number
  expected: string
  actual?: string
  error?: string
  pass: boolean
}
const results = shallowRef<Result[] | null>(null)
const failure = ref('')
const running = ref(false)
const passed = computed(() => results.value?.filter((r) => r.pass).length ?? 0)

/* 代码在 Worker 里运行，写出死循环也不会卡住页面，超过 1 秒就停下 */
const workerSource = `
onmessage = (event) => {
  const { code, inputs } = event.data
  let fn
  try {
    fn = new Function(code + '\\nreturn typeof formatPrice === "function" ? formatPrice : null')()
  } catch (error) {
    postMessage({ failure: String(error) })
    return
  }
  if (!fn) {
    postMessage({ failure: '没有找到 formatPrice 函数' })
    return
  }
  postMessage({
    outputs: inputs.map((input) => {
      try {
        return { value: String(fn(input)) }
      } catch (error) {
        return { error: String(error) }
      }
    }),
  })
}`
let worker: Worker | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const stop = () => {
  worker?.terminate()
  worker = null
  clearTimeout(timer)
  running.value = false
}
onBeforeUnmount(stop)

function run() {
  stop()
  running.value = true
  failure.value = ''
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
  worker = new Worker(url)
  URL.revokeObjectURL(url)
  worker.addEventListener('message', (event) => {
    const data = event.data as {
      failure?: string
      outputs?: { value?: string; error?: string }[]
    }
    stop()
    if (data.failure) {
      results.value = null
      failure.value = data.failure
      return
    }
    results.value = cases.map((item, i) => {
      const out = data.outputs![i]!
      return {
        ...item,
        actual: out.value,
        error: out.error,
        pass: out.value === item.expected,
      }
    })
  })
  timer = setTimeout(() => {
    stop()
    results.value = null
    failure.value = '运行超过 1 秒，已停止。检查一下是否有死循环。'
  }, 1000)
  const inputs = cases.map((item) => item.input)
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker takes no origin
  worker.postMessage({ code: code.value, inputs })
}

function reset() {
  code.value = starter
  results.value = null
  failure.value = ''
}

/* 边写边检查：函数名写错、留下 console.log 都会标出来 */
const practice = defineCodeExtension({
  name: 'practice',
  lint(ctx): CodeDiagnostic[] {
    const text = ctx.doc.toString()
    const out: CodeDiagnostic[] = []
    if (!/function\s+formatPrice\s*\(|(?:const|let)\s+formatPrice\s*=/.test(text))
      out.push({
        from: 0,
        to: 0,
        severity: 'error',
        message: '需要定义 formatPrice 函数',
      })
    for (const match of text.matchAll(/console\.log\(/g)) {
      out.push({
        from: match.index,
        to: match.index + 11,
        severity: 'info',
        message: '提交前记得去掉调试输出',
        actions: [
          {
            label: '删除这一行',
            run(context, d) {
              const line = context.doc.lineAt(d.from)
              const to = Math.min(line.to + 1, context.doc.length)
              context.transact((tr) => tr.replace(line.from, to, ''))
            },
          },
        ],
      })
    }
    return out
  },
  completion(request) {
    const options = [
      {
        label: 'toLocaleString',
        kind: 'method' as const,
        detail: '按地区写数字',
      },
      { label: 'padStart', kind: 'method' as const, detail: '在前面补足字符' },
      { label: 'Math.floor', kind: 'function' as const, detail: '向下取整' },
      { label: 'Math.abs', kind: 'function' as const, detail: '绝对值' },
    ]
    if (!request.word.text) return null
    return { from: request.word.from, options }
  },
})
const extensions = [practice]
</script>

<template>
  <div class="practice">
    <DouPageHeader title="代码练习" subtitle="第 3 题 · 字符串与数字" :show-back="false" :level="2">
      <template #extra>
        <DouButton variant="outline" :disabled="running" @click="reset">
          <template #leading><RotateCcwIcon /></template>
          重置
        </DouButton>
        <DouButton tone="primary" :loading="running" @click="run">
          <template #leading><PlayIcon /></template>
          运行测试
        </DouButton>
      </template>
    </DouPageHeader>

    <div class="practice__main">
      <DouCard title="格式化金额" class="practice__task">
        <p>
          订单里的金额以“分”为单位保存。写一个函数
          <code>formatPrice(cents)</code>，把它写成带千分位、保留两位小数的人民币。
        </p>
        <ul class="practice__examples">
          <li v-for="item in cases.slice(0, 4)" :key="item.input">
            <code>formatPrice({{ item.input }})</code>
            <span aria-hidden="true">→</span>
            <code>"{{ item.expected }}"</code>
          </li>
        </ul>
        <p class="practice__hint">
          按 <DouKbd>Ctrl</DouKbd> + <DouKbd>Space</DouKbd> 可以看到常用的方法。
        </p>
      </DouCard>

      <div class="practice__editor">
        <DouSegmentedControl
          v-model="view"
          size="sm"
          :options="[
            { label: '我的代码', value: 'code' },
            { label: '对比参考答案', value: 'diff' },
          ]"
        />
        <DouCodeEditor
          v-if="view === 'code'"
          v-model="code"
          :language="javascript"
          :extensions="extensions"
          line-numbers
          class="practice__code"
          aria-label="我的代码"
        />
        <DouCodeDiff
          v-else
          :original="code"
          :model-value="answer"
          :language="javascript"
          class="practice__code"
        />
      </div>

      <DouCard title="测试结果" class="practice__results">
        <template #extra>
          <DouTag v-if="results" :tone="passed === cases.length ? 'success' : 'warning'">
            通过 {{ passed }} / {{ cases.length }}
          </DouTag>
        </template>
        <DouAlert v-if="failure" tone="danger" :title="failure" />
        <DouEmpty
          v-else-if="!results"
          size="sm"
          title="还没有运行"
          description="写好后点“运行测试”"
        />
        <ul v-else class="practice__list">
          <li v-for="item in results" :key="item.input" :class="{ 'is-pass': item.pass }">
            <span class="practice__mark" :aria-label="item.pass ? '通过' : '未通过'">
              <CheckIcon v-if="item.pass" />
              <CloseIcon v-else />
            </span>
            <code>formatPrice({{ item.input }})</code>
            <span v-if="!item.pass" class="practice__actual">
              {{
                item.error ??
                `得到 ${JSON.stringify(item.actual)}，应为 ${JSON.stringify(item.expected)}`
              }}
            </span>
          </li>
        </ul>
      </DouCard>
    </div>
  </div>
</template>

<style scoped>
.practice {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.practice__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 880px) {
  .practice__main {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  }
  .practice__task {
    grid-row: span 2;
  }
}
.practice__task p {
  margin: 0 0 12px;
  font-size: var(--dou-font-size-sm);
  line-height: 1.7;
}
.practice__task .practice__hint {
  margin: 12px 0 0;
  color: var(--dou-color-text-secondary);
}
.practice__examples {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 12px 16px;
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-muted);
  list-style: none;
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
}
.practice__examples li {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
}
.practice__examples span {
  color: var(--dou-color-text-tertiary);
}
.practice__editor {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.practice__code {
  height: 320px;
}
.practice__list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--dou-font-size-sm);
}
.practice__list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.practice__mark {
  display: inline-flex;
  color: var(--dou-color-danger-text);
}
.is-pass .practice__mark {
  color: var(--dou-color-success-text);
}
.practice__mark svg {
  width: 16px;
  height: 16px;
}
.practice__actual {
  color: var(--dou-color-text-secondary);
}
</style>
