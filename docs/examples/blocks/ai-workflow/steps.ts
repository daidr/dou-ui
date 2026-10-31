import {
  DatabaseSearchIcon,
  GitBranchIcon,
  HeadsetIcon,
  MessageQuestionIcon,
  MessageReplyIcon,
  SparkleCircleIcon,
} from '@dou-ui/icons'
import type { Component } from 'vue'

export interface StepOutput {
  key: string
  label: string
}

export interface StepKind {
  label: string
  icon: Component
  /** What the step hands on to later steps; other steps refer to it by `{{id.key}}`. */
  outputs: StepOutput[]
  /** Exits; a step with more than one names each. */
  exits: { id: string; label?: string }[]
  /** Whether the step has an input. */
  input: boolean
  defaults: () => Record<string, unknown>
  /** One line shown on the node. */
  summary: (data: Record<string, any>) => string
}

export const models = [
  { value: 'fast', label: '快速' },
  { value: 'balanced', label: '均衡' },
  { value: 'careful', label: '细致' },
]

export const libraries = [
  { value: 'notes', label: '戴兜的笔记' },
  { value: 'manual', label: '产品手册' },
  { value: 'faq', label: '常见问题' },
]

export const queues = [
  { value: 'support', label: '客服组' },
  { value: 'sales', label: '销售组' },
]

const labelOf = (list: { value: string; label: string }[], value: string) =>
  list.find((item) => item.value === value)?.label ?? ''

export const kinds: Record<string, StepKind> = {
  start: {
    label: '收到提问',
    icon: MessageQuestionIcon,
    outputs: [{ key: 'question', label: '问题' }],
    exits: [{ id: 'out' }],
    input: false,
    defaults: () => ({ channel: '网页' }),
    summary: (d) => `来自${d.channel}`,
  },
  retrieve: {
    label: '检索知识库',
    icon: DatabaseSearchIcon,
    outputs: [{ key: 'passages', label: '片段' }],
    exits: [{ id: 'out' }],
    input: true,
    defaults: () => ({ library: 'notes', topK: 4, query: '{{start.question}}' }),
    summary: (d) => `${labelOf(libraries, d.library)} · 取 ${d.topK} 段`,
  },
  llm: {
    label: '生成回答',
    icon: SparkleCircleIcon,
    outputs: [{ key: 'answer', label: '回答' }],
    exits: [{ id: 'out' }],
    input: true,
    defaults: () => ({ model: 'balanced', temperature: 0.4, prompt: '' }),
    summary: (d) => `${labelOf(models, d.model)}模型 · 温度 ${d.temperature}`,
  },
  branch: {
    label: '判断',
    icon: GitBranchIcon,
    outputs: [],
    exits: [
      { id: 'yes', label: '是' },
      { id: 'no', label: '否' },
    ],
    input: true,
    defaults: () => ({ condition: '回答里提到“退款”' }),
    summary: (d) => d.condition,
  },
  reply: {
    label: '发送回复',
    icon: MessageReplyIcon,
    outputs: [],
    exits: [],
    input: true,
    defaults: () => ({ content: '{{llm.answer}}' }),
    summary: (d) => d.content,
  },
  human: {
    label: '转人工',
    icon: HeadsetIcon,
    outputs: [],
    exits: [],
    input: true,
    defaults: () => ({ queue: 'support' }),
    summary: (d) => labelOf(queues, d.queue),
  },
}
