# Tabs 标签页

在同一块区域里切换几组内容。标签是一排安静的文字，压在一道细线上；选中的那一个变成墨色，下方一条短短的墨线在标签之间滑动。悬停时标签后面铺一层极淡的底色，和幽灵按钮一致。

<script setup>
import { ref } from 'vue'
const tab = ref('overview')
const tab2 = ref('deployments')
</script>

## 基础用法

<div class="demo demo--column">
  <DouTabs v-model="tab">
    <DouTabPanel value="overview" label="概览">项目的基本信息与最近一次部署。</DouTabPanel>
    <DouTabPanel value="deployments" label="部署">所有部署记录，按时间倒序。</DouTabPanel>
    <DouTabPanel value="logs" label="日志">实时运行日志。</DouTabPanel>
    <DouTabPanel value="billing" label="账单" disabled>账单</DouTabPanel>
    <DouTabPanel value="settings" label="设置">域名、环境变量与权限。</DouTabPanel>
  </DouTabs>
</div>

```vue
<DouTabs v-model="tab">
  <DouTabPanel value="overview" label="概览">…</DouTabPanel>
  <DouTabPanel value="deployments" label="部署">…</DouTabPanel>
  <DouTabPanel value="billing" label="账单" disabled>…</DouTabPanel>
</DouTabs>
```

不绑定 `v-model` 时默认选中第一个可用的标签。面板在第一次显示时才渲染，之后切走也会保留，切回来是即时的，状态也还在。

## 自定义标签与额外内容

面板的 `label` 插槽替换标签文字，比如加上图标或计数，插槽参数为 `{ selected }`。`DouTabs` 的 `extra` 插槽放在标签行的末尾。

<div class="demo demo--column">
  <DouTabs v-model="tab2">
    <DouTabPanel value="deployments">
      <template #label>部署 <DouBadge :value="12" /></template>
      12 条部署记录。
    </DouTabPanel>
    <DouTabPanel value="issues">
      <template #label>告警 <DouBadge :value="2" tone="danger" /></template>
      2 条未处理的告警。
    </DouTabPanel>
    <DouTabPanel value="members" label="成员">3 位成员。</DouTabPanel>
    <template #extra><DouButton size="sm" variant="outline">新建部署</DouButton></template>
  </DouTabs>
</div>

```vue
<DouTabs v-model="tab">
  <DouTabPanel value="deployments">
    <template #label>部署 <DouBadge :value="12" /></template>
    …
  </DouTabPanel>
  <template #extra><DouButton size="sm" variant="outline">新建部署</DouButton></template>
</DouTabs>
```

## 尺寸

<div class="demo demo--column">
  <DouTabs v-for="size in ['sm', 'md', 'lg']" :key="size" :size="size" model-value="a">
    <DouTabPanel value="a" :label="size" />
    <DouTabPanel value="b" label="部署" />
    <DouTabPanel value="c" label="设置" />
  </DouTabs>
</div>

## 键盘与读屏

标签行带 `role="tablist"`，每个标签是 `role="tab"` 的按钮，通过 `aria-controls` 指向自己的 `role="tabpanel"` 面板。只有选中的标签在 `Tab` 顺序里；`←` `→` 在标签之间移动并跳过禁用项，到头后回绕，`Home` / `End` 跳到首尾。

默认 `activation="auto"`：方向键移到哪个标签就立即选中它。面板渲染较慢时用 `activation="manual"`，方向键只移动焦点，按 `Enter` 或 `Space` 才选中。

## API

### Tabs Props

| 名称         | 说明                                 | 类型                   | 默认值         |
| ------------ | ------------------------------------ | ---------------------- | -------------- |
| `modelValue` | 选中面板的值，配合 `v-model`         | `string \| number`     | 第一个可用面板 |
| `size`       | 尺寸，默认取表单或全局配置           | `'sm' \| 'md' \| 'lg'` | `'md'`         |
| `activation` | 方向键移到标签时立即选中，还是等确认 | `'auto' \| 'manual'`   | `'auto'`       |

### Tabs Events

| 名称                | 说明               | 参数                        |
| ------------------- | ------------------ | --------------------------- |
| `update:modelValue` | 选中的面板变化     | `(value: string \| number)` |
| `change`            | 用户选了另一个标签 | `(value: string \| number)` |

### Tabs Slots

| 名称      | 说明             |
| --------- | ---------------- |
| `default` | `DouTabPanel`    |
| `extra`   | 标签行末尾的内容 |

### TabPanel Props

| 名称       | 说明     | 类型               | 默认值  |
| ---------- | -------- | ------------------ | ------- |
| `value`    | 面板的值 | `string \| number` | —       |
| `label`    | 标签文字 | `string`           | `value` |
| `disabled` | 禁用     | `boolean`          | `false` |

### TabPanel Slots

| 名称      | 说明                                |
| --------- | ----------------------------------- |
| `default` | 面板内容                            |
| `label`   | 替换标签文字，参数为 `{ selected }` |

### CSS 变量

| 变量                   | 说明           |
| ---------------------- | -------------- |
| `--dou-tabs-height`    | 标签高度       |
| `--dou-tabs-padding-x` | 标签水平内边距 |
| `--dou-tabs-indicator` | 下划线颜色     |
