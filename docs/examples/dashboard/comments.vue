<script setup lang="ts">
import { DouDashboard } from '@dou-ui/dashboard'
import { DouCheckbox, type CommentThread } from 'dou-ui'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { widgets } from './widgets'

const me = { id: 'dai', name: '戴兜' }
const qing = { id: 'qing', name: '阿青' }
const minutes = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString()

const doc = ref({
  version: 1 as const,
  widgets: [
    {
      id: 'visits',
      type: 'stat',
      title: '今日访问',
      props: { value: 18240, suffix: '次' },
      place: { lg: { x: 0, y: 0, w: 4, h: 2 } },
    },
    {
      id: 'orders',
      type: 'stat',
      title: '今日订单',
      props: { value: 1326, suffix: '单' },
      place: { lg: { x: 4, y: 0, w: 4, h: 2 } },
      comments: ['orders-drop'],
    },
    {
      id: 'refunds',
      type: 'stat',
      title: '退款申请',
      props: { value: 12, suffix: '件' },
      place: { lg: { x: 8, y: 0, w: 4, h: 2 } },
    },
    {
      id: 'trend',
      type: 'trend',
      title: '近 10 天销售额',
      props: { points: [12, 18, 15, 22, 28, 24, 31, 36, 33, 40] },
      place: { lg: { x: 0, y: 2, w: 12, h: 3 } },
      comments: ['trend-peak'],
    },
  ],
})

const threads = ref<CommentThread[]>([
  {
    id: 'orders-drop',
    comments: [
      {
        id: 'o1',
        author: qing,
        body: '上海仓今天订单少了一成，是不是系统问题？',
        createdAt: minutes(70),
      },
      { id: 'o2', author: me, body: '下午停了两小时，已经恢复。', createdAt: minutes(35) },
    ],
  },
  {
    id: 'trend-peak',
    comments: [
      { id: 't1', author: qing, body: '第 8 天的高点是促销带来的吗？', createdAt: minutes(8) },
    ],
  },
])
const active = ref<string | null>(null)
const open = computed(() => threads.value.filter((thread) => !thread.resolved))
// 已解决的讨论也列出来，点开后可以在卡片上重新打开
const showResolved = ref(false)
const listed = computed(() => (showResolved.value ? threads.value : open.value))
const dashboard = useTemplateRef<InstanceType<typeof DouDashboard>>('dashboard')

// 每条讨论在哪个格子上，文档或评论变化时重新读取
const places = ref<Record<string, string>>({})
// 所在格子已删除的讨论打不开，列表里只做展示
const orphans = ref(new Set<string>())
const titleOf = (id: string) => doc.value.widgets.find((widget) => widget.id === id)?.title
function readPlaces() {
  const anchors = dashboard.value?.getCommentAnchors() ?? {}
  orphans.value = new Set(Object.keys(anchors).filter((id) => !anchors[id]))
  places.value = Object.fromEntries(
    Object.entries(anchors).map(([id, on]) => [
      id,
      on ? (titleOf(on.widget) ?? '格子') : '（格子已删除）',
    ]),
  )
}
onMounted(readPlaces)
watch([threads, doc], readPlaces, { flush: 'post' })
</script>

<template>
  <div class="dashboard-comments-demo">
    <DouDashboard
      ref="dashboard"
      v-model="doc"
      v-model:comments="threads"
      v-model:active-comment="active"
      :widgets="widgets"
      :author="me"
      :row-height="56"
      :gap="12"
      :breakpoints="{ lg: 560, md: 360, sm: 0 }"
      label="销售概览"
    />
    <aside class="dashboard-comments-demo__side" aria-label="评论">
      <div class="dashboard-comments-demo__head">
        <span class="dashboard-comments-demo__title">评论 {{ open.length }}</span>
        <DouCheckbox v-model="showResolved" size="sm">显示已解决</DouCheckbox>
      </div>
      <button
        v-for="thread in listed"
        :key="thread.id"
        type="button"
        class="dashboard-comments-demo__item"
        :class="{ 'is-active': thread.id === active }"
        :disabled="orphans.has(thread.id)"
        @click="active = thread.id"
      >
        <span class="dashboard-comments-demo__place">
          {{ places[thread.id] }}<template v-if="thread.resolved"> · 已解决</template>
        </span>
        <span class="dashboard-comments-demo__text">
          {{ thread.comments[0]?.author.name }}：{{ thread.comments[0]?.body }}
        </span>
        <span v-if="thread.comments.length > 1" class="dashboard-comments-demo__count">
          {{ thread.comments.length - 1 }} 条回复
        </span>
      </button>
      <p v-if="!listed.length" class="dashboard-comments-demo__empty">
        点格子标题栏上的评论按钮发起讨论。
      </p>
    </aside>
  </div>
</template>

<style scoped>
.dashboard-comments-demo {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 评论列表在仪表盘下方，一行放几张 */
.dashboard-comments-demo__side {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  min-width: 0;
}
.dashboard-comments-demo__head {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.dashboard-comments-demo__title {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-medium);
}
.dashboard-comments-demo__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background: none;
  color: var(--dou-color-text);
  font: inherit;
  font-size: var(--dou-font-size-sm);
  text-align: start;
  cursor: pointer;

  @media (hover: hover) {
    &:hover:enabled {
      background-color: color-mix(in oklab, currentColor 4%, transparent);
    }
  }

  &:disabled {
    cursor: default;
  }

  &.is-active {
    border-color: var(--dou-color-focus);
  }
}

.dashboard-comments-demo__place {
  padding-inline-start: 8px;
  border-inline-start: 2px solid var(--dou-color-focus);
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.dashboard-comments-demo__text {
  overflow-x: clip;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-comments-demo__count,
.dashboard-comments-demo__empty {
  margin: 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
