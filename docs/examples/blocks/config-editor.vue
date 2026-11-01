<script setup lang="ts">
import {
  DouCodeDiff,
  DouCodeEditor,
  defineCodeExtension,
  yaml,
  type CodeCompletion,
  type CodeDiagnostic,
} from '@dou-ui/code'
import { toast } from 'dou-ui'
import { computed, ref } from 'vue'

/* 门店服务的部署配置：改完先检查，再看改了哪些地方，确认后保存 */
const saved = ref(`# 门店服务
name: shop-api
region: sh
replicas: 2

resources:
  cpu: 500m
  memory: 512Mi

env:
  LOG_LEVEL: info
  CACHE_TTL: 300

domains:
  - shop.example.com
  - api.shop.example.com
`)
const draft = ref(saved.value)
const view = ref<'edit' | 'diff'>('edit')

/* ------------------------------------------------------------ 读出 YAML 的结构 */

/** 一个键：所在的行、键和值在全文中的位置，以及下一级的键或列表项。 */
interface Entry {
  key: string
  value: string
  keyFrom: number
  valueFrom: number
  valueTo: number
  indent: number
  children: Entry[]
  items: { value: string; from: number; to: number }[]
}

/** 只读出配置文件常用的部分：按缩进分层的键值和 `- ` 列表。 */
function readYaml(text: string): Entry[] {
  const root: Entry[] = []
  const stack: Entry[] = []
  let offset = 0
  for (const line of text.split('\n')) {
    const from = offset
    offset += line.length + 1
    const body = line.replace(/\s+#.*$/, '')
    if (!body.trim() || body.trimStart().startsWith('#')) continue
    const indent = body.length - body.trimStart().length
    while (stack.length && stack.at(-1)!.indent >= indent) stack.pop()
    const item = /^(\s*)-\s+(.*)$/.exec(body)
    if (item) {
      const parent = stack.at(-1)
      const value = item[2]!.trim()
      const start = from + body.indexOf(value, item[1]!.length + 1)
      parent?.items.push({ value, from: start, to: start + value.length })
      continue
    }
    const pair = /^(\s*)([^:#]+?)\s*:(?:\s+(.*))?$/.exec(body)
    if (!pair) continue
    const value = (pair[3] ?? '').trim()
    const keyFrom = from + indent
    const valueFrom = value ? from + body.lastIndexOf(value) : from + body.length
    const entry: Entry = {
      key: pair[2]!,
      value,
      keyFrom,
      valueFrom,
      valueTo: valueFrom + value.length,
      indent,
      children: [],
      items: [],
    }
    ;(stack.at(-1)?.children ?? root).push(entry)
    stack.push(entry)
  }
  return root
}

/* ------------------------------------------------------------ 配置的规则 */

interface Field {
  label: string
  required?: boolean
  check?: (value: string) => string | null
  options?: string[]
  fields?: Record<string, Field>
  /** 下一级是任意的键，比如环境变量 */
  map?: boolean
  list?: (value: string) => string | null
}

const integer = (min: number, max: number) => (value: string) =>
  /^\d+$/.test(value) && +value >= min && +value <= max ? null : `应为 ${min} 到 ${max} 的整数`

const schema: Record<string, Field> = {
  name: {
    label: '服务名',
    required: true,
    check: (v) => (/^[a-z][a-z0-9-]*$/.test(v) ? null : '只能用小写字母、数字和 -，以字母开头'),
  },
  region: {
    label: '地域',
    required: true,
    options: ['sh', 'bj', 'gz'],
    check: (v) => (['sh', 'bj', 'gz'].includes(v) ? null : '地域只能是 sh、bj 或 gz'),
  },
  replicas: { label: '实例数', required: true, check: integer(1, 20) },
  port: { label: '端口', check: integer(1024, 65535) },
  resources: {
    label: '资源',
    fields: {
      cpu: {
        label: 'CPU',
        check: (v) => (/^\d+m?$/.test(v) ? null : 'CPU 写成 500m（毫核）或 1、2'),
      },
      memory: {
        label: '内存',
        check: (v) => (/^\d+(Mi|Gi)$/.test(v) ? null : '内存写成 512Mi 或 2Gi'),
      },
    },
  },
  env: { label: '环境变量', map: true },
  domains: {
    label: '域名',
    list: (v) => (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v) ? null : '不是有效的域名'),
  },
}

function check(text: string): CodeDiagnostic[] {
  const out: CodeDiagnostic[] = []
  const walk = (entries: Entry[], fields: Record<string, Field>) => {
    for (const name of Object.keys(fields))
      if (fields[name]!.required && !entries.some((e) => e.key === name))
        out.push({
          from: 0,
          to: 0,
          severity: 'error',
          message: `缺少“${fields[name]!.label}”（${name}）`,
        })
    for (const entry of entries) {
      const field = fields[entry.key]
      if (!field) {
        out.push({
          from: entry.keyFrom,
          to: entry.keyFrom + entry.key.length,
          severity: 'warning',
          message: `不认识的配置项 ${entry.key}`,
        })
        continue
      }
      const problem = entry.value && field.check?.(entry.value)
      if (problem)
        out.push({
          from: entry.valueFrom,
          to: entry.valueTo,
          severity: 'error',
          message: problem,
          actions: field.options?.map((option) => ({
            label: `改成 ${option}`,
            run: (ctx, d) => ctx.transact((tr) => tr.replace(d.from, d.to, option)),
          })),
        })
      if (field.fields) walk(entry.children, field.fields)
      for (const item of entry.items) {
        const wrong = field.list?.(item.value)
        if (wrong)
          out.push({
            from: item.from,
            to: item.to,
            severity: 'error',
            message: wrong,
          })
      }
    }
  }
  walk(readYaml(text), schema)
  return out
}

/* ------------------------------------------------------------ 补全：按所在的层级给出键名和可选的值 */

const config = defineCodeExtension({
  name: 'service-config',
  lint: (ctx) => check(ctx.doc.toString()),
  completion(request, ctx) {
    const line = ctx.doc.lineAt(request.pos)
    const before = line.text.slice(0, request.pos - line.from)
    // 值：冒号后面
    const value = /^\s*([\w-]+):\s+(\w*)$/.exec(before)
    if (value) {
      const field = schema[value[1]!]
      if (!field?.options) return null
      return {
        from: request.pos - value[2]!.length,
        options: field.options.map((option) => ({
          label: option,
          kind: 'constant',
        })),
      }
    }
    // 键：行首，按缩进找到上一级
    const key = /^(\s*)([\w-]*)$/.exec(before)
    if (!key) return null
    const indent = key[1]!.length
    let fields: Record<string, Field> | undefined = schema
    if (indent > 0) {
      fields = undefined
      for (let n = line.number - 1; n >= 1; n--) {
        const text = ctx.doc.line(n).text
        const parent = /^(\s*)([\w-]+):\s*$/.exec(text)
        if (parent && parent[1]!.length < indent) {
          fields = schema[parent[2]!]?.fields
          break
        }
      }
    }
    if (!fields) return null
    const present = new Set(readYaml(ctx.doc.toString()).map((e) => e.key))
    const options: CodeCompletion[] = Object.entries(fields)
      .filter(([name]) => indent > 0 || !present.has(name))
      .map(([name, field]) => ({
        label: name,
        detail: field.label,
        kind: 'property',
        snippet: field.fields || field.map || field.list ? `${name}:\n  $0` : `${name}: $0`,
      }))
    return { from: request.pos - key[2]!.length, options }
  },
})
const extensions = [config]

/* ------------------------------------------------------------ 保存 */

const problems = computed(() => check(draft.value))
const errors = computed(() => problems.value.filter((p) => p.severity === 'error').length)
const changed = computed(() => draft.value !== saved.value)
const summary = computed(() => {
  const entries = readYaml(draft.value)
  const get = (key: string) => entries.find((e) => e.key === key)
  return [
    { label: '服务', value: get('name')?.value || '—' },
    { label: '地域', value: get('region')?.value || '—' },
    {
      label: '实例',
      value: get('replicas')?.value ? `${get('replicas')!.value} 个` : '—',
    },
    { label: '域名', value: `${get('domains')?.items.length ?? 0} 个` },
  ]
})

function save() {
  saved.value = draft.value
  view.value = 'edit'
  toast.success('配置已保存，下次发布时生效')
}
function revert() {
  draft.value = saved.value
}
</script>

<template>
  <div class="config">
    <DouPageHeader title="服务配置" subtitle="shop-api · 生产环境" :show-back="false" :level="2">
      <template #extra>
        <DouButton variant="outline" :disabled="!changed" @click="revert">还原</DouButton>
        <DouButton tone="primary" :disabled="!changed || errors > 0" @click="save">
          保存
        </DouButton>
      </template>
    </DouPageHeader>

    <div class="config__summary">
      <div v-for="item in summary" :key="item.label" class="config__fact">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </div>

    <div class="config__bar">
      <DouSegmentedControl
        v-model="view"
        size="sm"
        :options="[
          { label: '编辑', value: 'edit' },
          { label: '查看改动', value: 'diff', disabled: !changed },
        ]"
      />
      <span class="config__state" aria-live="polite">
        <DouBadge :tone="errors ? 'danger' : problems.length ? 'warning' : 'success'" dot />
        {{
          errors
            ? `${errors} 个错误，改好后才能保存`
            : problems.length
              ? `${problems.length} 条提醒`
              : '检查通过'
        }}
      </span>
    </div>

    <DouCodeEditor
      v-if="view === 'edit'"
      v-model="draft"
      :language="yaml"
      :extensions="extensions"
      line-numbers
      class="config__code"
      aria-label="服务配置"
    />
    <DouCodeDiff
      v-else
      v-model="draft"
      :original="saved"
      :language="yaml"
      editable
      class="config__code"
    />
  </div>
</template>

<style scoped>
.config {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.config__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-border);
}
.config__fact {
  display: grid;
  gap: 4px;
  padding: 12px 16px;
  background-color: var(--dou-color-bg-surface);
}
.config__fact span {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
.config__fact strong {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.config__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}
.config__state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
.config__code {
  height: 400px;
}
</style>
