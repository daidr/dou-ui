<script setup>
import {
  CalendarIcon,
  ListChecksIcon,
  MessageIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from '@dou-ui/icons'
import { dialog, useElementSize } from 'dou-ui'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

const labels = {
  design: { text: '设计', tone: 'primary' },
  web: { text: '前端', tone: 'neutral' },
  bug: { text: '缺陷', tone: 'danger' },
  docs: { text: '文档', tone: 'neutral' },
}
const people = ['戴兜', '林舟', '陈一']

// 示例数据
let nextId = 20
const card = (title, extra = {}) => ({
  id: nextId++,
  title,
  description: '',
  labels: [],
  owner: null,
  due: null,
  comments: 0,
  checklist: null,
  ...extra,
})
const board = ref({ name: '官网改版 · 第 4 周' })
const columns = ref([
  {
    id: 'todo',
    title: '待处理',
    cards: [
      card('首页首屏改为组件墙', { labels: ['design'], owner: '戴兜', due: '11-04', comments: 3 }),
      card('移动端导航抽屉支持滑动关闭', { labels: ['web'], owner: '林舟' }),
      card('补充上海节点的部署说明', { labels: ['docs'], due: '11-06' }),
    ],
  },
  {
    id: 'doing',
    title: '进行中',
    cards: [
      card('价格页对比表', {
        labels: ['design', 'web'],
        owner: '戴兜',
        due: '11-01',
        checklist: [2, 5],
        description: '三档方案并排展示，窄屏时改为可左右滑动的卡片。',
      }),
      card('暗色主题下代码块对比度不足', { labels: ['bug'], owner: '陈一', comments: 1 }),
    ],
  },
  {
    id: 'review',
    title: '评审中',
    cards: [card('更新日志页面', { labels: ['web', 'docs'], owner: '林舟', checklist: [4, 4] })],
  },
  {
    id: 'done',
    title: '已完成',
    cards: [card('页脚链接整理', { labels: ['web'], owner: '戴兜', comments: 2 })],
  },
])

/* 新建 */
const editingId = ref(null)
async function addCard(column) {
  const created = card('')
  column.cards.push(created)
  editingId.value = created.id
  await nextTick()
}
function onCardTitle(column, item, submitted) {
  editingId.value = null
  if (!submitted || !item.title.trim()) column.cards.splice(column.cards.indexOf(item), 1)
}

/* 详情抽屉：窄时从底部弹出 */
const root = useTemplateRef('root')
const { width } = useElementSize(root, { initial: { width: 1024, height: 0 } })
const narrow = computed(() => width.value < 640)
const openId = ref(null)
const drawerOpen = ref(false)
const located = computed(() => {
  for (const column of columns.value) {
    const item = column.cards.find((c) => c.id === openId.value)
    if (item) return { column, item }
  }
  return null
})
const detail = computed(() => located.value?.item)
const statusOf = computed({
  get: () => located.value?.column.id,
  set: (id) => moveTo(located.value.item, id),
})
const statusOptions = computed(() => columns.value.map((c) => ({ value: c.id, label: c.title })))

// 拖动后松手不算点击
let down = null
function onCardDown(event) {
  down = { x: event.clientX, y: event.clientY }
}
function onCardClick(event, item) {
  if (editingId.value === item.id) return
  if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) return
  openCard(item)
}
function openCard(item) {
  openId.value = item.id
  drawerOpen.value = true
}

function moveTo(item, columnId) {
  const from = columns.value.find((c) => c.cards.includes(item))
  const to = columns.value.find((c) => c.id === columnId)
  if (!from || !to || from === to) return
  from.cards.splice(from.cards.indexOf(item), 1)
  to.cards.push(item)
}

async function remove(item) {
  const ok = await dialog.confirm({
    title: '删除任务',
    content: `“${item.title}”删除后无法恢复。`,
    tone: 'danger',
    confirmText: '删除',
  })
  if (!ok) return
  const column = columns.value.find((c) => c.cards.includes(item))
  column.cards.splice(column.cards.indexOf(item), 1)
  if (openId.value === item.id) drawerOpen.value = false
}

function onAction(value, item) {
  if (value === 'open') openCard(item)
  else if (value === 'delete') void remove(item)
  else moveTo(item, value)
}

const notEmpty = (value) => (value.trim() ? true : '名称不能为空')
</script>

<template>
  <div ref="root" class="kanban">
    <header class="top">
      <h2 class="name"><DouEditable v-model="board.name" :validate="notEmpty" /></h2>
      <DouAvatarGroup size="sm" :max="3">
        <DouAvatar v-for="person in people" :key="person" :name="person" />
      </DouAvatarGroup>
    </header>

    <div class="columns">
      <section v-for="column in columns" :key="column.id" class="column">
        <header class="column-head">
          <DouEditable v-model="column.title" class="column-title" :validate="notEmpty" />
          <span class="count">{{ column.cards.length }}</span>
          <DouButton
            variant="ghost"
            size="sm"
            :aria-label="`在“${column.title}”中新建任务`"
            @click="addCard(column)"
          >
            <PlusIcon />
          </DouButton>
        </header>

        <DouSortable
          v-model="column.cards"
          group="kanban"
          class="list"
          :item-label="(item) => item.title || '新任务'"
          :disabled="editingId !== null"
        >
          <template #default="{ item }">
            <article class="card" @pointerdown="onCardDown" @click="onCardClick($event, item)">
              <div v-if="item.labels.length" class="labels">
                <DouTag
                  v-for="label in item.labels"
                  :key="label"
                  size="sm"
                  :tone="labels[label].tone"
                >
                  {{ labels[label].text }}
                </DouTag>
              </div>
              <DouEditable
                v-if="editingId === item.id"
                v-model="item.title"
                :editing="true"
                placeholder="任务名称"
                @submit="onCardTitle(column, item, true)"
                @cancel="onCardTitle(column, item, false)"
              />
              <div v-else class="title">{{ item.title }}</div>
              <footer v-if="editingId !== item.id" class="meta">
                <span v-if="item.due" class="meta-item">
                  <DouIcon><CalendarIcon /></DouIcon>{{ item.due }}
                </span>
                <span
                  v-if="item.checklist"
                  class="meta-item"
                  :class="{ done: item.checklist[0] === item.checklist[1] }"
                >
                  <DouIcon><ListChecksIcon /></DouIcon>{{ item.checklist[0] }}/{{
                    item.checklist[1]
                  }}
                </span>
                <span v-if="item.comments" class="meta-item">
                  <DouIcon><MessageIcon /></DouIcon>{{ item.comments }}
                </span>
                <span class="meta-end">
                  <DouAvatar v-if="item.owner" :name="item.owner" :size="20" />
                  <DouDropdown placement="bottom-end" @select="onAction($event, item)">
                    <DouButton
                      variant="ghost"
                      size="sm"
                      class="more"
                      :aria-label="`${item.title} 的更多操作`"
                      @click.stop
                    >
                      <MoreHorizontalIcon />
                    </DouButton>
                    <template #menu>
                      <DouDropdownItem value="open">查看详情</DouDropdownItem>
                      <DouDropdownSub title="移到">
                        <DouDropdownItem
                          v-for="target in columns"
                          :key="target.id"
                          :value="target.id"
                          :disabled="target === column"
                        >
                          {{ target.title }}
                        </DouDropdownItem>
                      </DouDropdownSub>
                      <DouDropdownItem value="delete" tone="danger" divided>删除</DouDropdownItem>
                    </template>
                  </DouDropdown>
                </span>
              </footer>
            </article>
          </template>
          <template #empty>
            <div class="drop">拖到这里</div>
          </template>
        </DouSortable>
      </section>
    </div>

    <DouDrawer
      v-model:open="drawerOpen"
      :placement="narrow ? 'bottom' : 'right'"
      :size="narrow ? undefined : 400"
      :swipeable="narrow"
      :snap-points="narrow ? ['60%', '100%'] : undefined"
      title="任务详情"
      @closed="openId = null"
    >
      <div v-if="detail" class="detail">
        <h3 class="detail-title">
          <DouEditable v-model="detail.title" :validate="notEmpty" multiline />
        </h3>
        <dl class="fields">
          <dt>状态</dt>
          <dd><DouSelect v-model="statusOf" :options="statusOptions" size="sm" /></dd>
          <dt>负责人</dt>
          <dd>
            <DouUser v-if="detail.owner" :name="detail.owner" size="sm" />
            <DouText v-else variant="tertiary">未指派</DouText>
          </dd>
          <dt>截止</dt>
          <dd>
            <DouText :variant="detail.due ? 'secondary' : 'tertiary'">
              {{ detail.due ?? '未设置' }}
            </DouText>
          </dd>
          <dt>标签</dt>
          <dd class="labels">
            <DouTag
              v-for="label in detail.labels"
              :key="label"
              size="sm"
              :tone="labels[label].tone"
            >
              {{ labels[label].text }}
            </DouTag>
            <DouText v-if="!detail.labels.length" variant="tertiary">无</DouText>
          </dd>
        </dl>
        <section>
          <h4 class="section-title">描述</h4>
          <DouEditable v-model="detail.description" placeholder="添加描述" multiline />
        </section>
      </div>
      <template #footer>
        <DouButton variant="outline" tone="danger" @click="remove(detail)">删除</DouButton>
      </template>
    </DouDrawer>
  </div>
</template>

<style scoped>
.kanban {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-width: 0;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.name {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-lg);
  font-weight: var(--dou-font-weight-bold);
  line-height: 28px;
  letter-spacing: normal;
}

.columns {
  display: grid;
  grid-auto-columns: minmax(196px, 1fr);
  grid-auto-flow: column;
  gap: 12px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scroll-padding: 0 4px;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-muted);
  scroll-snap-align: start;
}

.column-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding-left: 6px;
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-medium);
}
.column-title {
  flex: 0 1 auto;
  min-width: 0;
}
.count {
  flex: 1 1 auto;
  color: var(--dou-color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 48px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-sm);
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
  line-height: var(--dou-font-line-height);
  cursor: pointer;
  transition: border-color var(--dou-motion-duration-fast) var(--dou-motion-easing);
}
.card:hover {
  border-color: var(--dou-color-border-strong);
}

.labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.title {
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
  font-variant-numeric: tabular-nums;
}
.meta-item {
  display: inline-flex;
  white-space: nowrap;
  align-items: center;
  gap: 4px;
}
.meta-item.done {
  color: var(--dou-color-success);
}
.meta-end {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.more {
  margin-right: -6px;
}

.drop {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  border: 1px dashed var(--dou-color-border-strong);
  border-radius: var(--dou-radius-control);
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.detail-title {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-md);
  font-weight: var(--dou-font-weight-medium);
  line-height: var(--dou-font-line-height);
  letter-spacing: normal;
}
.fields {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 12px 16px;
  margin: 0;
}
.fields dt {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
.fields dd {
  min-width: 0;
  margin: 0;
}
.section-title {
  margin: 0 0 8px;
  padding: 0;
  border: 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
  font-weight: var(--dou-font-weight-regular);
  line-height: var(--dou-font-line-height);
  letter-spacing: normal;
}

@container (max-width: 640px) {
  .columns {
    grid-auto-columns: 82cqi;
  }
}
</style>
