<script setup>
import {
  BugIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  GitMergeIcon,
  LayersIcon,
  MaximizeIcon,
  PaletteIcon,
  RocketIcon,
  RouteIcon,
  ServerIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  StoreIcon,
} from '@dou-ui/icons'
import { computed, ref } from 'vue'

const nodes = [
  {
    id: 'review',
    label: '需求评审',
    icon: ClipboardCheckIcon,
    status: 'finish',
    description: '12 条需求已排期',
  },
  { id: 'design', label: '交互设计', icon: PaletteIcon, extra: '24 页', status: 'finish' },
  { id: 'api', label: '接口开发', icon: ServerIcon, extra: '3 天', status: 'finish' },
  {
    id: 'ios',
    label: 'iOS 开发',
    icon: SmartphoneIcon,
    extra: '18/20',
    status: 'process',
    progress: 90,
  },
  {
    id: 'android',
    label: 'Android 开发',
    icon: SmartphoneIcon,
    extra: '13/20',
    status: 'process',
    progress: 65,
  },
  {
    id: 'copy',
    label: '文案翻译',
    icon: FileTextIcon,
    status: 'process',
    incomplete: true,
  },
  { id: 'integrate', label: '前后端联调', icon: GitMergeIcon, status: 'process' },
  {
    id: 'test',
    label: '回归测试',
    icon: BugIcon,
    status: 'error',
    description: '3 个用例失败',
    descriptionTone: 'danger',
    comments: 4,
  },
  {
    id: 'security',
    label: '安全审计',
    icon: ShieldCheckIcon,
    status: 'finish',
    description: '无高危问题',
    descriptionTone: 'success',
  },
  { id: 'assets', label: '商店素材', icon: LayersIcon, status: 'wait', comments: 2 },
  { id: 'store', label: '提交商店审核', icon: StoreIcon },
  { id: 'gray', label: '灰度 10%', icon: RouteIcon },
  { id: 'launch', label: '全量上线', icon: RocketIcon, kind: 'milestone' },
  { id: 'retro', label: '复盘', kind: 'milestone', disabled: true },
]

const critical = new Set([
  'review>ios',
  'ios>integrate',
  'integrate>test',
  'test>store',
  'store>gray',
  'gray>launch',
])
const links = [
  ['review', 'api'],
  ['review', 'ios'],
  ['review', 'android'],
  ['design', 'ios'],
  ['design', 'android'],
  ['design', 'copy'],
  ['api', 'integrate'],
  ['api', 'security'],
  ['ios', 'integrate'],
  ['android', 'integrate'],
  ['copy', 'assets'],
  ['integrate', 'test'],
  ['test', 'store'],
  ['security', 'store'],
  ['assets', 'store'],
  ['store', 'gray'],
  ['gray', 'launch'],
  ['launch', 'retro'],
]

const onlyCritical = ref(false)
const edges = computed(() =>
  links.map(([from, to]) => {
    const key = `${from}>${to}`
    const status = critical.has(key) ? 'active' : onlyCritical.value ? 'muted' : 'default'
    return { from, to, status }
  }),
)

const owners = {
  review: '戴兜',
  ios: '戴兜',
  integrate: '戴兜',
  test: '戴兜',
  launch: '戴兜',
}
const statusText = {
  wait: '未开始',
  process: '进行中',
  finish: '已完成',
  error: '出错',
  blocked: '依赖项未完成',
}
const statusTone = { finish: 'success', process: 'primary', error: 'danger', blocked: 'warning' }

const selected = ref(['test'])
const hovered = ref(null)
const zoom = ref(0.8)
const graph = ref()
const labelOf = (id) => nodes.find((node) => node.id === id)?.label
</script>

<template>
  <DouNodeGraph
    ref="graph"
    v-model:selected="selected"
    v-model:hovered="hovered"
    v-model:zoom="zoom"
    class="framed"
    :nodes="nodes"
    :edges="edges"
    :height="236"
    size="sm"
    node-width="auto"
    selectable="multiple"
    auto-blocked
    zoomable
    legend
    label="App 2.0 发布流程"
  >
    <template #toolbar>
      <button
        type="button"
        class="dou-node-graph__tool"
        :aria-pressed="onlyCritical"
        @click="onlyCritical = !onlyCritical"
      >
        {{ onlyCritical ? '显示全部' : '关键路径' }}
      </button>
    </template>
    <template #corner="{ node }">
      <span v-if="node.comments" class="comments" :aria-label="`${node.comments} 条评论`">
        {{ node.comments }}
      </span>
    </template>
    <template #detail="{ node, status }">
      <div class="detail">
        <div class="detail__head">
          <strong class="detail__title">{{ node.label }}</strong>
          <DouTag :tone="statusTone[status] ?? 'neutral'" size="sm">
            {{ statusText[status] }}
          </DouTag>
        </div>
        <DouProgress v-if="node.progress != null" :value="node.progress" size="sm" />
        <DouUser v-if="owners[node.id]" :name="owners[node.id]" description="负责人" size="sm" />
        <DouText v-else variant="tertiary" size="sm">暂未分配负责人</DouText>
      </div>
    </template>
  </DouNodeGraph>
  <DouSpace wrap>
    <DouButton size="sm" variant="outline" @click="graph.fit()">
      <template #icon><MaximizeIcon /></template>
      适应画布
    </DouButton>
    <DouButton size="sm" variant="outline" @click="graph.scrollToNode('launch')">
      定位到全量上线
    </DouButton>
    <DouText variant="secondary">
      选中：{{ selected.map(labelOf).join('、') || '无' }} · 悬停：{{ labelOf(hovered) ?? '无' }} ·
      缩放：{{ Math.round(zoom * 100) }}%
    </DouText>
  </DouSpace>
</template>

<style scoped>
.framed {
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}

.comments {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--dou-color-danger);
  box-shadow: 0 0 0 2px var(--dou-color-bg-surface);
  color: var(--dou-color-danger-on);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 220px;
}

.detail__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail__title {
  flex: 1;
}
</style>
