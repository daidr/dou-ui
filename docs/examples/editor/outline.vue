<script setup lang="ts">
import {
  DouEditor,
  type EditorDocument,
  type PartialBlock,
  type EditorSelection,
} from '@dou-ui/editor'
import { computed, ref, useTemplateRef } from 'vue'

const editor = useTemplateRef('editor')

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { id: 'plan', type: 'heading', props: { level: 2 }, content: '上海站活动方案' },
    { id: 'goal', type: 'heading', props: { level: 3 }, content: '目标' },
    { content: '让新用户在一个下午里做出第一个页面。' },
    { id: 'agenda', type: 'heading', props: { level: 3 }, content: '日程' },
    { type: 'numberedItem', content: '签到与分组' },
    { type: 'numberedItem', content: '动手环节' },
    { type: 'numberedItem', content: '作品展示' },
    { id: 'budget', type: 'heading', props: { level: 3 }, content: '预算' },
    { content: '场地由合作方提供，物料另行申请。' },
  ],
})

// written as a string here, read back from the editor as runs of text
const textOf = (content: unknown) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((item) => (item.type === 'text' ? item.text : '')).join('')
      : ''

const headings = computed(() =>
  doc.value.blocks
    .filter((block) => block.type === 'heading')
    .map((block) => ({
      id: block.id!,
      level: Number(block.props?.level ?? 1),
      text: textOf(block.content),
    })),
)

// the heading of the section the cursor is in
const active = ref<string | null>(null)

function onSelection(selection: EditorSelection) {
  const ids = doc.value.blocks.map((block) => block.id)
  const at = selection.block ? ids.indexOf(selection.block) : -1
  active.value = null
  for (let i = at; i >= 0; i--) {
    if (doc.value.blocks[i]!.type === 'heading') {
      active.value = doc.value.blocks[i]!.id!
      break
    }
  }
}
</script>

<template>
  <div class="outline-demo">
    <nav class="outline-demo__nav" aria-label="目录">
      <DouButton
        v-for="item in headings"
        :key="item.id"
        size="sm"
        variant="ghost"
        :class="{ 'is-active': item.id === active }"
        :aria-current="item.id === active ? 'location' : undefined"
        :style="{ paddingInlineStart: `${(item.level - 2) * 12 + 8}px` }"
        @click="editor?.focusBlock(item.id)"
      >
        {{ item.text || '无标题' }}
      </DouButton>
    </nav>
    <DouEditor
      ref="editor"
      v-model="doc"
      aria-label="活动方案"
      class="outline-demo__editor"
      @update:selection="onSelection"
    />
  </div>
</template>

<style scoped>
.outline-demo {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 16px;
}

.outline-demo__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-inline-end: 1px solid var(--dou-color-border);
  padding-inline-end: 8px;

  & .dou-button {
    justify-content: flex-start;
    color: var(--dou-color-text-secondary);
    font-weight: 400;

    &.is-active {
      color: var(--dou-color-text);
      font-weight: 600;
    }

    @media (pointer: coarse) {
      min-height: 40px;
    }
  }
}

@media (max-width: 640px) {
  .outline-demo {
    grid-template-columns: minmax(0, 1fr);
  }

  .outline-demo__nav {
    border-inline-end: 0;
    border-block-end: 1px solid var(--dou-color-border);
    padding-inline-end: 0;
    padding-block-end: 8px;
  }
}
</style>
