<script setup>
import { DouCodeEditor, css, defineCodeExtension } from '@dou-ui/code'
import { DouAvatar, DouButton } from 'dou-ui'
import { h, ref } from 'vue'

const code = ref(`.card {
  color: #2b2f36;
  background: #f4f5f7;
  border: 1px solid #c9ced6;
}

.card.is-active {
  border-color: #3d6fd9;
}
`)

// 颜色值前面放一个色块，色块不是文字，光标会跳过它
const swatches = defineCodeExtension({
  name: 'swatches',
  decorations(editor) {
    const out = []
    for (let n = editor.visible.from; n <= editor.visible.to; n++) {
      const line = editor.doc.line(n)
      for (const match of line.text.matchAll(/#[0-9a-f]{6}\b/gi))
        out.push({
          type: 'inline',
          pos: line.from + match.index,
          width: 18,
          render: () => h('span', { class: 'demo-swatch', style: { background: match[0] } }),
        })
    }
    return out
  },
})

// 行间的审阅评论；位置随修改移动
const comments = ref([
  {
    id: '1',
    pos: code.value.indexOf('border: 1px'),
    author: '戴兜',
    text: '边框是不是浅了一点？',
  },
])

function onTransaction(result) {
  comments.value = comments.value.map((comment) => ({
    ...comment,
    pos: result.changes.mapPos(comment.pos),
  }))
}

const review = defineCodeExtension({
  name: 'review',
  widgets: () =>
    comments.value.map((comment) => ({
      id: comment.id,
      pos: comment.pos,
      height: 64,
      label: `${comment.author}的评论：${comment.text}`,
      render: () =>
        h('div', { class: 'demo-comment' }, [
          h(DouAvatar, { name: comment.author, size: 'sm' }),
          h('div', { class: 'demo-comment-body' }, [
            h('div', { class: 'demo-comment-author' }, comment.author),
            h('div', comment.text),
          ]),
          h(
            DouButton,
            {
              size: 'sm',
              variant: 'outline',
              onClick: () => {
                comments.value = comments.value.filter((c) => c.id !== comment.id)
              },
            },
            () => '解决',
          ),
        ]),
    })),
})

const extensions = [swatches, review]
</script>

<template>
  <DouCodeEditor
    v-model="code"
    :language="css"
    :extensions="extensions"
    aria-label="小部件示例"
    @transaction="onTransaction"
  />
</template>

<style scoped>
:deep(.demo-swatch) {
  display: inline-block;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  margin: 4px 6px 0 0;
  border: 1px solid var(--dou-color-border);
  border-radius: 3px;
  vertical-align: top;
}
:deep(.demo-comment) {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 4px 12px 4px 0;
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
:deep(.demo-comment-author) {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-xs);
}
</style>
