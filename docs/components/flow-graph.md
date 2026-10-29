# FlowGraph 流程图

按依赖关系从左到右展示一组节点和它们之间的连线。

<script setup>
import { ref } from 'vue'
import {
  BarChartIcon,
  ClipboardCheckIcon,
  CodeIcon,
  ListChecksIcon,
  PackageIcon,
  RocketIcon,
  SparkleIcon,
} from '@dou-ui/icons'

const releaseNodes = [
  { id: 'start', label: '开始', status: 'finish' },
  { id: 'perf', label: '性能评估', status: 'process' },
  { id: 'review', label: '技术方案评审及接口确认', status: 'finish', incomplete: true },
  { id: 'security', label: '安全技术评审', status: 'process' },
  { id: 'fe-est', label: '前端估分', status: 'finish' },
  { id: 'be-est', label: '后端估分', status: 'finish' },
  { id: 'fe-dev', label: '前端开发', status: 'finish' },
  { id: 'be-dev', label: '后端开发', status: 'finish' },
  { id: 'joint', label: '联调', status: 'finish' },
  { id: 'pentest', label: '安全渗透测试' },
  { id: 'intranet', label: '内网发布' },
  { id: 'public', label: '外网发布' },
  { id: 'launch', label: '全量上线', kind: 'milestone' },
]
const releaseEdges = [
  { from: 'start', to: 'perf' },
  { from: 'start', to: 'review' },
  { from: 'review', to: 'security' },
  { from: 'review', to: 'fe-est' },
  { from: 'review', to: 'be-est' },
  { from: 'perf', to: 'fe-dev' },
  { from: 'fe-est', to: 'fe-dev' },
  { from: 'be-est', to: 'be-dev' },
  { from: 'fe-dev', to: 'joint' },
  { from: 'be-dev', to: 'joint' },
  { from: 'security', to: 'pentest' },
  { from: 'joint', to: 'pentest' },
  { from: 'joint', to: 'intranet' },
  { from: 'joint', to: 'public' },
  { from: 'intranet', to: 'launch' },
  { from: 'public', to: 'launch' },
]
const owners = {
  perf: '林晓峰',
  security: '周启明',
  pentest: '周启明',
  intranet: '陈思远',
  public: '陈思远',
  launch: '林晓峰',
}
const current = ref('public')

const pipelineNodes = [
  { id: 'entry', label: '测试准入', icon: ClipboardCheckIcon, extra: '281.73M', status: 'finish' },
  { id: 'gen', label: '用例物料生成', icon: PackageIcon, extra: '50.56M', status: 'finish' },
  { id: 'check', label: '用例物料校验', icon: PackageIcon, extra: '5.87M', status: 'finish' },
  { id: 'publish', label: '用例发布', icon: RocketIcon, extra: '19.26M', status: 'finish' },
  {
    id: 'api',
    label: '接口增量自动化生成与执行',
    icon: CodeIcon,
    extra: '26.24M',
    status: 'process',
    progress: 64,
  },
  {
    id: 'regress',
    label: '接口回归自动化执行',
    icon: CodeIcon,
    extra: '38.11M',
    status: 'process',
    progress: 22,
  },
  { id: 'coverage', label: '增量代码测试覆盖率', icon: BarChartIcon },
  { id: 'result', label: '测试执行结果', icon: ListChecksIcon },
]
const pipelineEdges = [
  { from: 'entry', to: 'gen' },
  { from: 'gen', to: 'check' },
  { from: 'check', to: 'publish' },
  { from: 'publish', to: 'api' },
  { from: 'publish', to: 'regress' },
  { from: 'api', to: 'coverage' },
  { from: 'regress', to: 'coverage' },
  { from: 'coverage', to: 'result' },
]

const cardNodes = [
  {
    id: 'ios',
    label: 'iOS 开发',
    extra: '12 人日',
    description: '设计专项优化与体验问题修复',
    descriptionTone: 'danger',
    status: 'process',
    progress: 30,
  },
  {
    id: 'contract',
    label: '财务法务正式合同确认',
    description: '金额确认后完善报价单并审批',
    status: 'process',
  },
  { id: 'plan', label: '测试计划', description: '0 个用例', status: 'wait' },
  { id: 'done', label: '准出', kind: 'milestone' },
]
const cardEdges = [
  { from: 'ios', to: 'plan' },
  { from: 'contract', to: 'plan' },
  { from: 'plan', to: 'done' },
]

const blockedNodes = [
  { id: 'a', label: '需求澄清', status: 'process' },
  { id: 'b', label: '技术方案', status: 'finish' },
  { id: 'c', label: '开发', status: 'process' },
  { id: 'd', label: '测试', status: 'process' },
]
const blockedEdges = [
  { from: 'a', to: 'c' },
  { from: 'b', to: 'c' },
  { from: 'c', to: 'd' },
]
const zoom = ref(1)
const graph = ref()
</script>

## 基础用法

`nodes` 是节点，`edges` 是连线，`from` 指向 `to`。节点按依赖深度分列，跨列的连线从节点之间的空隙穿过。

<div class="demo">
  <DouFlowGraph :nodes="releaseNodes" :edges="releaseEdges" />
</div>

```vue
<script setup>
const nodes = [
  { id: 'start', label: '开始', status: 'finish' },
  { id: 'perf', label: '性能评估', status: 'process' },
  { id: 'review', label: '技术方案评审及接口确认', status: 'finish', incomplete: true },
  // ...
  { id: 'launch', label: '全量上线', kind: 'milestone' },
]
const edges = [
  { from: 'start', to: 'perf' },
  { from: 'start', to: 'review' },
  // ...
]
</script>

<template>
  <DouFlowGraph :nodes="nodes" :edges="edges" />
</template>
```

连线必须构成有向无环图。成环的那条连线会被忽略。

## 状态与类型

`status` 有五种：`wait` 未开始、`process` 进行中、`finish` 已完成、`error` 出错、`blocked` 依赖项未完成。未开始的节点标题会变淡。

`kind: 'milestone'` 把状态点换成旗帜，表示里程碑。`incomplete` 在节点右端加一个标记，表示还有未完成的子任务。

`auto-blocked` 让组件自己推断：进行中的节点只要有前驱没完成，就显示为 `blocked`。

<div class="demo">
  <DouFlowGraph :nodes="blockedNodes" :edges="blockedEdges" auto-blocked legend />
</div>

```vue
<DouFlowGraph :nodes="nodes" :edges="edges" auto-blocked legend />
```

## 节点内容

`icon` 放在标题前，`extra` 放在标题后，适合耗时、大小这类短数值。`progress`（0–100）在节点底部显示一条进度。标题放不下时会截断，`extra` 最多占一半宽度。

<div class="demo">
  <DouFlowGraph :nodes="pipelineNodes" :edges="pipelineEdges" node-width="auto" />
</div>

```vue
<script setup>
import { CodeIcon, PackageIcon } from '@dou-ui/icons'

const nodes = [
  { id: 'gen', label: '用例物料生成', icon: PackageIcon, extra: '50.56M', status: 'finish' },
  {
    id: 'api',
    label: '接口增量自动化生成与执行',
    icon: CodeIcon,
    extra: '26.24M',
    status: 'process',
    progress: 64,
  },
  // ...
]
</script>

<template>
  <DouFlowGraph :nodes="nodes" :edges="edges" node-width="auto" />
</template>
```

默认 `node-width="column"`，同一列的节点等宽；`auto` 让每个节点按内容决定宽度；传数字则所有节点固定宽度。

## 卡片

有 `description` 的节点会变成两行的卡片，第二行是说明文字。`descriptionTone` 给说明加上浅色底，用来提醒。`shape` 可以强制指定 `pill` 或 `card`。

<div class="demo">
  <DouFlowGraph :nodes="cardNodes" :edges="cardEdges" />
</div>

```vue
<script setup>
const nodes = [
  {
    id: 'ios',
    label: 'iOS 开发',
    extra: '12 人日',
    description: '设计专项优化与体验问题修复',
    descriptionTone: 'danger',
    status: 'process',
    progress: 30,
  },
  // ...
]
</script>
```

## 选中与悬停

点击节点选中它，配合 `v-model:selected`。`selectable="multiple"` 可以多选，`false` 关闭选择。

悬停节点时，它的上下游链路保持原样，其余部分变淡。`highlight="selected"` 改为高亮选中节点的链路，`none` 关闭高亮。

`detail` 插槽的内容会在悬停时以弹出层显示。也可以监听 `node-enter` 和 `node-leave`，参数里有节点数据和节点元素，用来自己控制弹出层。

<div class="demo demo--column">
  <DouFlowGraph v-model:selected="current" :nodes="releaseNodes" :edges="releaseEdges">
    <template #detail="{ node, status }">
      <div style="display: flex; align-items: center; gap: 12px; min-width: 220px">
        <strong style="flex: 1">{{ node.label }}</strong>
        <DouTag :tone="{ finish: 'success', process: 'warning', error: 'danger' }[status] ?? 'neutral'" size="sm">
          {{ { wait: '未开始', process: '进行中', finish: '已完成', error: '出错', blocked: '依赖项未完成' }[status] }}
        </DouTag>
        <DouUser v-if="owners[node.id]" :name="owners[node.id]" size="sm" />
      </div>
    </template>
  </DouFlowGraph>
  <DouText variant="secondary">选中：{{ current ?? '无' }}</DouText>
</div>

```vue
<DouFlowGraph v-model:selected="current" :nodes="nodes" :edges="edges">
  <template #detail="{ node, status }">
    <strong>{{ node.label }}</strong>
    <DouTag size="sm">{{ statusText[status] }}</DouTag>
    <DouUser :name="owners[node.id]" size="sm" />
  </template>
</DouFlowGraph>
```

## 插槽

节点的每个部分都有插槽：`status` 状态点、`icon` 图标、`label` 标题、`extra` 附加信息、`description` 第二行、`corner` 右上角。`node` 插槽接管节点的全部内容，外框、位置和选中状态仍由组件处理。插槽参数是 `{ node, status, selected, hovered }`。

下面用 `corner` 在右上角放一个圆形按钮。点击它不会选中节点。

<div class="demo">
  <DouFlowGraph :nodes="pipelineNodes" :edges="pipelineEdges" node-width="auto">
    <template #corner="{ node }">
      <button
        type="button"
        :aria-label="`${node.label}：智能分析`"
        :style="{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          padding: 0,
          border: '1px solid var(--dou-color-border)',
          borderRadius: '50%',
          background: 'var(--dou-color-bg-surface)',
          boxShadow: 'var(--dou-shadow-sm)',
          color: node.status === 'finish' ? 'var(--dou-color-success)' : 'var(--dou-color-text-tertiary)',
          cursor: 'pointer',
        }"
      >
        <SparkleIcon style="width: 12px; height: 12px" />
      </button>
    </template>
  </DouFlowGraph>
</div>

```vue
<DouFlowGraph :nodes="nodes" :edges="edges">
  <template #corner="{ node }">
    <button type="button" class="ai-button" :aria-label="`${node.label}：智能分析`">
      <SparkleIcon />
    </button>
  </template>
</DouFlowGraph>
```

## 平移与缩放

图比容器大时，可以拖动、滚动或在触控板上滑动来平移，`pannable` 默认开启。普通滚轮纵向移动，按住 Shift 横向移动；移到边缘后页面会继续滚动。

`zoomable` 开启缩放：按住 Ctrl 或 ⌘ 滚动滚轮，或在触控板上捏合，右上角也会出现缩放按钮。缩放比例可以用 `v-model:zoom` 绑定。`height` 固定容器高度，默认和图一样高。`legend` 在工具栏加一个图例按钮。

<div class="demo demo--column">
  <DouFlowGraph
    ref="graph"
    v-model:zoom="zoom"
    :nodes="releaseNodes"
    :edges="releaseEdges"
    :height="240"
    zoomable
    legend
    style="border: 1px solid var(--dou-color-border); border-radius: var(--dou-radius-container); max-width: 560px"
  />
  <DouSpace>
    <DouButton size="sm" variant="outline" @click="graph.fit()">适应画布</DouButton>
    <DouButton size="sm" variant="outline" @click="graph.scrollToNode('launch')">定位到全量上线</DouButton>
    <DouText variant="secondary">缩放：{{ Math.round(zoom * 100) }}%</DouText>
  </DouSpace>
</div>

```vue
<DouFlowGraph
  ref="graph"
  v-model:zoom="zoom"
  :nodes="nodes"
  :edges="edges"
  :height="240"
  zoomable
  legend
/>
<DouButton @click="graph.fit()">适应画布</DouButton>
<DouButton @click="graph.scrollToNode('launch')">定位到全量上线</DouButton>
```

图例也可以单独使用：`<DouFlowGraphLegend :nodes="nodes" />` 只列出这些节点用到的类型和状态，不传 `nodes` 则列出全部。

<div class="demo">
  <DouFlowGraphLegend />
</div>

## 键盘与读屏

每个节点都是一个按钮，可选择时带 `aria-pressed`。节点的读屏文字包含名称、类型、状态、进度和它依赖的节点，比如"联调，已完成，依赖 前端开发，后端开发"，不靠颜色传达状态。

整张图只占一个 Tab 位置。进入后用 ← → 移到前驱或后继，↑ ↓ 在同一列内移动，Enter 或空格选中。焦点移到视野外的节点时，图会自动平移过去。

## API

### Props

| 名称             | 说明                                         | 类型                              | 默认值     |
| ---------------- | -------------------------------------------- | --------------------------------- | ---------- |
| `nodes`          | 节点                                         | `FlowNode[]`                      | —          |
| `edges`          | 连线                                         | `FlowEdge[]`                      | —          |
| `selected`       | 选中的节点，`v-model:selected`               | `string \| string[] \| null`      | `null`     |
| `selectable`     | 是否可选，`multiple` 为多选                  | `boolean \| 'multiple'`           | `true`     |
| `size`           | 尺寸，单行节点高 28 / 32 / 40                | `'sm' \| 'md' \| 'lg'`            | 跟随全局   |
| `node-width`     | 节点宽度：同列等宽、按内容、固定值           | `'column' \| 'auto' \| number`    | `'column'` |
| `max-node-width` | 节点最大宽度，超出时截断标题                 | `number`                          | `320`      |
| `column-gap`     | 列间距                                       | `number`                          | 按尺寸     |
| `row-gap`        | 行间距                                       | `number`                          | 按尺寸     |
| `highlight`      | 高亮哪个节点的上下游链路                     | `'none' \| 'hover' \| 'selected'` | `'hover'`  |
| `auto-blocked`   | 自动把前驱未完成的进行中节点显示为 `blocked` | `boolean`                         | `false`    |
| `pannable`       | 是否可以平移                                 | `boolean`                         | `true`     |
| `zoomable`       | 是否可以缩放                                 | `boolean`                         | `false`    |
| `zoom`           | 缩放比例，`v-model:zoom`                     | `number`                          | `1`        |
| `min-zoom`       | 最小缩放比例                                 | `number`                          | `0.25`     |
| `max-zoom`       | 最大缩放比例                                 | `number`                          | `2`        |
| `legend`         | 在工具栏显示图例按钮                         | `boolean`                         | `false`    |
| `height`         | 容器高度，数字单位为 px                      | `string \| number`                | 和图一样高 |
| `label`          | 读屏用的名称                                 | `string`                          | `'流程图'` |

### FlowNode

| 字段              | 说明                       | 类型                                                           |
| ----------------- | -------------------------- | -------------------------------------------------------------- |
| `id`              | 唯一标识                   | `string`                                                       |
| `label`           | 标题                       | `string`                                                       |
| `kind`            | 类型                       | `'task' \| 'milestone'`                                        |
| `status`          | 状态，默认 `wait`          | `'wait' \| 'process' \| 'finish' \| 'error' \| 'blocked'`      |
| `icon`            | 标题前的图标               | `Component`                                                    |
| `extra`           | 标题后的附加信息           | `string \| number`                                             |
| `description`     | 第二行说明，节点会变成卡片 | `string`                                                       |
| `descriptionTone` | 说明的语义色               | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` |
| `shape`           | 强制单行或卡片             | `'pill' \| 'card'`                                             |
| `progress`        | 进度，0–100                | `number`                                                       |
| `incomplete`      | 含未完成子任务             | `boolean`                                                      |
| `disabled`        | 不可选中                   | `boolean`                                                      |

其他字段会原样传给插槽。

### FlowEdge

| 字段     | 说明                                  | 类型                               |
| -------- | ------------------------------------- | ---------------------------------- |
| `from`   | 起点节点的 `id`                       | `string`                           |
| `to`     | 终点节点的 `id`                       | `string`                           |
| `status` | `active` 加深连线，`muted` 显示为虚线 | `'default' \| 'active' \| 'muted'` |

### Events

| 名称             | 说明                                   | 参数                                  |
| ---------------- | -------------------------------------- | ------------------------------------- |
| `node-click`     | 点击节点                               | `(node: FlowNode, event: MouseEvent)` |
| `node-dblclick`  | 双击节点                               | `(node: FlowNode, event: MouseEvent)` |
| `node-enter`     | 指针移入节点                           | `(node: FlowNode, el: HTMLElement)`   |
| `node-leave`     | 指针移出节点                           | `(node: FlowNode, el: HTMLElement)`   |
| `update:hovered` | 悬停的节点变化，可用 `v-model:hovered` | `(id: string \| null)`                |

### Slots

| 名称          | 说明               | 参数                |
| ------------- | ------------------ | ------------------- |
| `node`        | 节点的全部内容     | `FlowNodeSlotProps` |
| `status`      | 状态点             | `FlowNodeSlotProps` |
| `icon`        | 图标               | `FlowNodeSlotProps` |
| `label`       | 标题               | `FlowNodeSlotProps` |
| `extra`       | 附加信息           | `FlowNodeSlotProps` |
| `description` | 卡片的第二行       | `FlowNodeSlotProps` |
| `corner`      | 右上角             | `FlowNodeSlotProps` |
| `detail`      | 悬停时弹出的内容   | `FlowNodeSlotProps` |
| `toolbar`     | 工具栏里的其他按钮 | —                   |
| `legend`      | 图例弹出层的内容   | —                   |
| `empty`       | 没有节点时显示     | —                   |

### Methods

| 名称           | 说明                                       | 类型                     |
| -------------- | ------------------------------------------ | ------------------------ |
| `scrollToNode` | 平移到节点                                 | `(id: string) => void`   |
| `fit`          | 显示整张图：可缩放时缩小到放得下，否则居中 | `() => void`             |
| `zoomTo`       | 缩放到指定比例                             | `(zoom: number) => void` |
| `resetView`    | 回到 100% 和起点                           | `() => void`             |
| `relayout`     | 重新测量节点并布局，比如字体加载之后       | `() => void`             |

### FlowGraphLegend Props

| 名称    | 说明                           | 类型                    | 默认值       |
| ------- | ------------------------------ | ----------------------- | ------------ |
| `nodes` | 只列出这些节点用到的类型和状态 | `FlowNode[]`            | 列出全部     |
| `items` | 自定义图例项                   | `FlowGraphLegendItem[]` | —            |
| `title` | 标题                           | `string`                | `'节点图例'` |
