<script setup lang="ts">
import {
  defineFlowExtension,
  DouFlowControls,
  DouFlowEditor,
  flowKit,
  type FlowDocument,
  type FlowNode,
  type FlowSelection,
} from '@dou-ui/flow'
import { whiteboardKit } from '@dou-ui/flow/whiteboard'
import { DownloadIcon, HeartIcon } from '@dou-ui/icons'
import { useElementSize, type Tone } from 'dou-ui'
import { computed, ref, useTemplateRef } from 'vue'

// 每个人的便签用自己的颜色
const members: { name: string; tone: Tone }[] = [
  { name: '戴兜', tone: 'warning' },
  { name: '阿青', tone: 'success' },
  { name: '小林', tone: 'primary' },
]
const toneOf = (name: string) => members.find((m) => m.name === name)?.tone ?? 'neutral'
const me = ref('戴兜')

interface NoteData {
  [key: string]: unknown
  text?: string
  tone?: Tone
  author?: string
  votes?: string[]
}

let nextId = 1
/** A frame with notes in a column, each note written by `[author, text, votes]`. */
function frame(id: string, x: number, label: string, items: [string, string, string[]?][]) {
  const nodes: FlowNode[] = [
    { id, type: 'group', x, y: 64, width: 160, height: 472, data: { label } },
  ]
  items.forEach(([author, text, votes = []], i) =>
    nodes.push({
      id: `n${nextId++}`,
      type: 'sticky',
      parent: id,
      x: x + 16,
      y: 112 + i * 140,
      width: 128,
      height: 128,
      data: { text, author, tone: toneOf(author), votes } satisfies NoteData,
    }),
  )
  return nodes
}

const doc = ref<FlowDocument>({
  nodes: [
    {
      id: 'topic',
      type: 'text',
      x: 0,
      y: 0,
      width: 528,
      data: { text: '上海新店开业：怎么让更多人第一周就来？' },
    },
    ...frame('visit', 0, '到店体验', [
      ['阿青', '进门送一杯手冲', ['戴兜', '小林']],
      ['戴兜', '墙上留一块给顾客写便签', ['阿青']],
      ['小林', '周末上午加开烘焙课'],
    ]),
    ...frame('online', 184, '线上预热', [
      ['小林', '开业前三天每天发一张店里的照片', ['戴兜']],
      ['戴兜', '老会员转发得双倍积分', ['阿青', '小林']],
      ['阿青', '附近写字楼送试饮券', ['戴兜', '阿青', '小林']],
    ]),
    ...frame('day', 368, '开业当天', [
      ['阿青', '第一百位顾客全年免单'],
      ['小林', '门口放一台拍立得', ['戴兜']],
    ]),
  ],
  edges: [],
})
const selection = ref<FlowSelection>({ nodes: [], edges: [] })

const notes = computed(() =>
  doc.value.nodes.filter((node): node is FlowNode<NoteData> => node.type === 'sticky'),
)
/** Notes with votes, the most first. */
const ranking = computed(() =>
  notes.value
    .filter((node) => node.data?.votes?.length)
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    .sort((a, b) => b.data!.votes!.length - a.data!.votes!.length),
)

// 新贴的便签记下是谁贴的；选中便签后可以投票
const brainstorm = defineFlowExtension({
  name: 'brainstorm',
  transaction(tr) {
    for (const step of tr.steps) {
      if (step.type !== 'addNode' || step.node.type !== 'sticky' || step.node.data?.author) continue
      tr.updateData(step.node.id, { author: me.value, tone: toneOf(me.value), votes: [] })
    }
  },
  toolbarItems(ctx, nodes) {
    if (!nodes.every((node) => node.type === 'sticky')) return []
    const voted = nodes.every((node) => (node.data as NoteData).votes?.includes(me.value))
    return [
      {
        key: 'vote',
        label: voted ? '取消赞同' : '赞同',
        icon: HeartIcon,
        active: voted,
        run() {
          ctx.transact((tr) => {
            for (const node of nodes) {
              const votes = (node.data as NoteData).votes ?? []
              const others = votes.filter((name) => name !== me.value)
              tr.updateData(node.id, { votes: voted ? others : [...others, me.value] })
            }
          })
          ctx.announce(voted ? '已取消赞同' : '已赞同')
        },
      },
    ]
  },
})

const tool = ref<'select'>('select')
const extensions = [flowKit(), whiteboardKit({ tool }), brainstorm]

const editor = useTemplateRef('editor')

function focusNote(id: string) {
  selection.value = { nodes: [id], edges: [] }
  editor.value?.centerNode(id)
  resultsOpen.value = false
}

async function exportImage() {
  if (!editor.value) return
  const url = URL.createObjectURL(await editor.value.exportPNG())
  const a = document.createElement('a')
  a.href = url
  a.download = '开业活动头脑风暴.png'
  a.click()
  URL.revokeObjectURL(url)
}

const root = useTemplateRef('root')
const { width } = useElementSize(root)
const narrow = computed(() => width.value > 0 && width.value < 720)
const resultsOpen = ref(false)
</script>

<template>
  <div ref="root" class="brainstorm" :class="{ 'is-narrow': narrow }">
    <header class="brainstorm__bar">
      <span class="brainstorm__name">开业活动头脑风暴</span>
      <DouSegmentedControl
        v-model="me"
        :options="members.map((m) => m.name)"
        size="sm"
        :block="narrow"
        class="brainstorm__members"
        aria-label="以谁的身份贴便签"
      >
        <template #option="{ option }">
          <span class="brainstorm__member">
            <span class="brainstorm__dot" :class="`is-${toneOf(String(option.value))}`" />
            {{ option.label ?? option.value }}
          </span>
        </template>
      </DouSegmentedControl>
      <DouButton v-if="narrow" size="sm" variant="outline" @click="resultsOpen = true">
        投票结果
      </DouButton>
      <DouButton
        v-if="narrow"
        size="sm"
        variant="outline"
        aria-label="导出图片"
        @click="exportImage"
      >
        <DownloadIcon />
      </DouButton>
      <DouButton v-else size="sm" variant="outline" @click="exportImage">
        <template #leading><DownloadIcon /></template>
        导出图片
      </DouButton>
    </header>
    <div class="brainstorm__body">
      <DouFlowEditor
        ref="editor"
        v-model="doc"
        v-model:selection="selection"
        :extensions="extensions"
        fit-view
        aria-label="开业活动头脑风暴白板"
        class="brainstorm__canvas"
        style="height: 100%"
      >
        <DouFlowControls />
      </DouFlowEditor>
      <aside v-if="!narrow" class="brainstorm__results">
        <div class="brainstorm__results-title">投票结果</div>
        <ol v-if="ranking.length" class="brainstorm__list">
          <li v-for="item in ranking" :key="item.id">
            <button type="button" class="brainstorm__item" @click="focusNote(item.id)">
              <span class="brainstorm__dot" :class="`is-${item.data?.tone ?? 'warning'}`" />
              <span class="brainstorm__text">{{ item.data?.text }}</span>
              <span class="brainstorm__votes">{{ item.data?.votes?.length }} 票</span>
            </button>
          </li>
        </ol>
        <DouEmpty v-else size="sm" description="选中便签后，点工具栏里的赞同投票" />
      </aside>
    </div>
    <DouDrawer
      v-if="narrow"
      v-model:open="resultsOpen"
      placement="bottom"
      title="投票结果"
      size="60%"
      swipeable
    >
      <ol v-if="ranking.length" class="brainstorm__list">
        <li v-for="item in ranking" :key="item.id">
          <button type="button" class="brainstorm__item" @click="focusNote(item.id)">
            <span class="brainstorm__dot" :class="`is-${item.data?.tone ?? 'warning'}`" />
            <span class="brainstorm__text">{{ item.data?.text }}</span>
            <span class="brainstorm__votes">{{ item.data?.votes?.length }} 票</span>
          </button>
        </li>
      </ol>
      <DouEmpty v-else size="sm" description="选中便签后，点工具栏里的赞同投票" />
    </DouDrawer>
  </div>
</template>

<style scoped>
.brainstorm {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-surface);
}

.brainstorm__bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  min-height: 48px;
  padding: 8px 12px 8px 16px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--dou-color-border);
}

.brainstorm__name {
  flex: 1;

  min-width: 0;
  overflow-x: clip;
  font-weight: var(--dou-font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-narrow .brainstorm__members {
  flex-basis: 100%;
  order: 1;
}

.brainstorm__member {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.brainstorm__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: var(--dou-radius-full);
  background-color: color-mix(in oklab, var(--dot) 70%, var(--dou-color-bg-surface));

  &.is-warning {
    --dot: var(--dou-color-warning);
  }
  &.is-success {
    --dot: var(--dou-color-success);
  }
  &.is-primary {
    --dot: var(--dou-color-primary);
  }
  &.is-neutral,
  &.is-danger {
    --dot: var(--dou-color-text-tertiary);
  }
}

.brainstorm__body {
  display: flex;
  height: 600px;
}

.brainstorm__canvas {
  flex: 1;
  min-width: 0;
  border: 0;
  border-radius: 0;
}

.brainstorm__results {
  display: flex;
  flex-direction: column;
  width: 264px;
  overflow-y: auto;
  border-left: 1px solid var(--dou-color-border);
}

.brainstorm__results > :deep(.dou-empty) {
  margin: auto;
  padding: 0 16px;
}

.brainstorm__results-title {
  display: flex;
  flex: none;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--dou-color-border-subtle);
  font-weight: var(--dou-font-weight-medium);
}

.brainstorm__list {
  margin: 0;
  padding: 8px;
  list-style: none;
}

.brainstorm__item {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 36px;
  padding: 6px 8px;
  box-sizing: border-box;
  border: 0;
  border-radius: var(--dou-radius-control);
  background: none;
  color: var(--dou-color-text);
  font: inherit;
  text-align: start;
  cursor: pointer;

  &:hover {
    background-color: var(--dou-color-bg-muted);
  }
  &:focus-visible {
    outline: 2px solid var(--dou-color-focus);
    outline-offset: -2px;
  }
}

.brainstorm__text {
  flex: 1;
  min-width: 0;
}

.brainstorm__votes {
  flex: none;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
  font-variant-numeric: tabular-nums;
}

@media (width < 720px) {
  .brainstorm__body {
    height: 480px;
  }
}
</style>
