<script setup lang="ts">
import { DouEditor, type EditorTransactionResult } from '@dou-ui/editor'
import { computed, ref, useTemplateRef } from 'vue'

const editor = useTemplateRef('editor')

const blocks = ref([
  { id: 'title', type: 'heading', props: { level: 3 }, content: '周会纪要' },
  { id: 'who', content: '参加：戴兜、阿青、小林' },
  { id: 'todo-1', type: 'checkItem', content: '整理上周的反馈' },
  { id: 'todo-2', type: 'checkItem', content: '确定上海站的场地' },
])

// the block with the cursor, from the `selectionChange` event
const current = ref<string | null>(null)
const last = ref('')

const currentLabel = computed(() => {
  if (!current.value) return '没有'
  const text = editor.value?.getBlock(current.value)?.content
  const first = text?.[0]
  return first?.type === 'text' ? `“${first.text.slice(0, 8)}”` : '空块'
})

function addTodo() {
  const [id] = editor.value!.insertBlocks([{ type: 'checkItem', content: '新的待办' }])
  if (id) editor.value!.focusBlock(id)
}

function toHeading() {
  if (current.value)
    editor.value!.updateBlock(current.value, { type: 'heading', props: { level: 3 } })
}

function moveUp() {
  const id = current.value
  if (!id) return
  const list = blocks.value.map((block) => block.id)
  const index = list.indexOf(id)
  if (index > 0) editor.value!.moveBlocks([id], { before: list[index - 1]! })
}

const kinds = { added: '新增', removed: '删除', updated: '修改', moved: '移动' } as const

function onTransaction({ changes }: EditorTransactionResult) {
  last.value = (Object.keys(kinds) as (keyof typeof kinds)[])
    .filter((kind) => changes[kind].length)
    .map((kind) => `${kinds[kind]} ${changes[kind].length} 个块`)
    .join('，')
}
</script>

<template>
  <div class="editing-actions">
    <DouButton size="sm" @click="addTodo">插入待办</DouButton>
    <DouButton size="sm" :disabled="!current" @click="toHeading">转为标题</DouButton>
    <DouButton size="sm" :disabled="!current" @click="moveUp">上移</DouButton>
    <DouButton size="sm" variant="ghost" @click="editor?.undo()">撤销</DouButton>
  </div>
  <DouEditor
    ref="editor"
    v-model="blocks"
    aria-label="周会纪要"
    @selection-change="current = $event.block"
    @transaction="onTransaction"
  />
  <p class="editing-status">光标所在：{{ currentLabel }}　最近一次修改：{{ last || '—' }}</p>
</template>

<style scoped>
.editing-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.editing-status {
  margin: 0;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
