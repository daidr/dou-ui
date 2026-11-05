<script setup>
import { DouCodeDiff, javascript } from '@dou-ui/code'
import { MessageCircleIcon } from '@dou-ui/icons'
import { DouAvatar, DouButton } from 'dou-ui'
import { computed, h, ref } from 'vue'

const original = `export function shippingFee(order) {
  if (order.total >= 99) return 0
  let fee = 6
  if (order.city !== '上海') fee += 4
  return fee
}
`

const modified = ref(`export function shippingFee(order, options = {}) {
  if (order.total >= 99 || options.member) return 0
  let fee = 6
  if (order.city !== '上海') fee += REMOTE_FEE
  return fee
}
`)

// 评论记在某一侧的某一行；整段改动的说明横跨两栏
const comments = ref([
  { id: 1, side: 'modified', line: 2, author: '戴兜', text: '会员免运费要写进帮助文档。' },
  {
    id: 2,
    side: 'original',
    line: 4,
    author: '阿青',
    text: '偏远地区加价改成常量 REMOTE_FEE，金额从 4 元调整为 8 元。',
    span: 'both',
  },
])
let nextId = 3

// 点击行号左侧的格子，在那一侧的那一行加一条评论
const gutters = computed(() => [
  {
    name: 'comments',
    markers: comments.value.map((comment) => ({
      side: comment.side,
      line: comment.line,
      icon: MessageCircleIcon,
      title: `${comment.author}的评论`,
    })),
    onPress(line, event, side) {
      comments.value = [
        ...comments.value,
        { id: nextId++, side, line, author: '戴兜', text: `第 ${line} 行的新评论。` },
      ]
    },
  },
])

const widgets = computed(() =>
  comments.value.map((comment) => ({
    id: String(comment.id),
    side: comment.side,
    line: comment.line,
    span: comment.span,
    height: 58,
    label: `${comment.author}的评论：${comment.text}`,
    render: () =>
      h('div', { class: 'demo-comment' }, [
        h(DouAvatar, { name: comment.author, size: 'sm' }),
        h('div', { class: 'demo-comment-body' }, [
          h('div', { class: 'demo-comment-head' }, [
            h('span', { class: 'demo-comment-author' }, comment.author),
            h(
              DouButton,
              {
                size: 'xs',
                variant: 'ghost',
                onClick: () => {
                  comments.value = comments.value.filter((c) => c.id !== comment.id)
                },
              },
              () => '解决',
            ),
          ]),
          h('div', comment.text),
        ]),
      ]),
  })),
)
</script>

<template>
  <DouCodeDiff
    v-model="modified"
    :original="original"
    :language="javascript"
    :gutters="gutters"
    :widgets="widgets"
    :collapse-unchanged="false"
  />
</template>

<style scoped>
:deep(.demo-comment) {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 4px 12px;
  padding: 8px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-surface);
}
:deep(.demo-comment-body) {
  flex: 1;
  min-width: 0;
  color: var(--dou-color-text);
}
:deep(.demo-comment-head) {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}
:deep(.demo-comment-author) {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
