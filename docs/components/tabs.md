# Tabs 标签页

在同一块区域里切换几组内容。标签是一排安静的文字，压在一道细线上；选中的那一个变成墨色，下方一条短短的墨线在标签之间滑动。悬停时标签后面铺一层极淡的底色，和幽灵按钮一致。

<script setup>
import { ref } from 'vue'
const tab = ref('overview')
const tab2 = ref('deployments')
const tab3 = ref('sh')
const tab4 = ref('profile')
const tab5 = ref('draft')
const pages = ref([
  { value: 'sh', label: '上海' },
  { value: 'bj', label: '北京' },
  { value: 'sz', label: '深圳' },
])
let next = 1
function addPage() {
  const value = `new-${next}`
  pages.value.push({ value, label: `新页面 ${next++}` })
  tab3.value = value
}
function removePage(value) {
  const index = pages.value.findIndex((page) => page.value === value)
  pages.value.splice(index, 1)
  if (tab3.value === value) tab3.value = pages.value[Math.max(0, index - 1)]?.value
}
const saved = ref(false)
const confirmLeave = () => saved.value || window.confirm('草稿还没保存，确定离开吗？')
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

## 可关闭与新增

`closable` 给每个标签加一个关闭按钮，`addable` 在标签行末尾加一个新增按钮。组件只发出 `remove` 和 `add`，增删面板由你来做，这样关闭前可以先确认、新建时可以先起名。面板自己的 `closable` 优先，适合让某个标签常驻。

<div class="demo demo--column">
  <DouTabs v-model="tab3" closable addable @remove="removePage" @add="addPage">
    <DouTabPanel v-for="page in pages" :key="page.value" :value="page.value" :label="page.label">{{ page.label }}的内容。</DouTabPanel>
  </DouTabs>
</div>

```vue
<script setup lang="ts">
const pages = ref([
  { value: 'sh', label: '上海' },
  { value: 'bj', label: '北京' },
])
function removePage(value: string) {
  const index = pages.value.findIndex((page) => page.value === value)
  pages.value.splice(index, 1)
  if (tab.value === value) tab.value = pages.value[Math.max(0, index - 1)]?.value
}
</script>

<template>
  <DouTabs v-model="tab" closable addable @remove="removePage" @add="addPage">
    <DouTabPanel v-for="page in pages" :key="page.value" :value="page.value" :label="page.label">
      …
    </DouTabPanel>
  </DouTabs>
</template>
```

关闭按钮不在 `Tab` 顺序里（标签本身已经是按钮，里面不能再放按钮）；焦点在可关闭的标签上时按 `Delete` 或 `Backspace` 关闭它，标签通过 `aria-keyshortcuts` 告诉读屏这个快捷键。

## 竖排

`placement="start"` 把标签竖排在面板左侧，`"end"` 放在右侧。指示线移到标签列的边上，方向键改为 `↑` `↓`。

<div class="demo demo--column">
  <DouTabs v-model="tab4" placement="start">
    <DouTabPanel value="profile" label="个人资料">头像、昵称与所在城市。</DouTabPanel>
    <DouTabPanel value="security" label="账号安全">密码、两步验证与登录设备。</DouTabPanel>
    <DouTabPanel value="notify" label="通知">邮件与站内信的推送规则。</DouTabPanel>
  </DouTabs>
</div>

```vue
<DouTabs v-model="tab" placement="start">…</DouTabs>
```

## 离开前确认

`before-leave` 在切换前调用，参数是要去的值和当前的值；返回 `false`（或 resolve 为 `false`）就留在当前标签。

<div class="demo demo--column">
  <DouCheckbox v-model="saved">草稿已保存</DouCheckbox>
  <DouTabs v-model="tab5" :before-leave="confirmLeave">
    <DouTabPanel value="draft" label="草稿">还没保存的草稿。</DouTabPanel>
    <DouTabPanel value="preview" label="预览">预览效果。</DouTabPanel>
  </DouTabs>
</div>

```vue
<DouTabs
  v-model="tab"
  :before-leave="() => saved || confirm('草稿还没保存，确定离开吗？')"
>…</DouTabs>
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

标签行带 `role="tablist"`，每个标签是 `role="tab"` 的按钮，通过 `aria-controls` 指向自己的 `role="tabpanel"` 面板。只有选中的标签在 `Tab` 顺序里；`←` `→` 在标签之间移动并跳过禁用项，到头后回绕，`Home` / `End` 跳到首尾；竖排时方向键是 `↑` `↓`，标签行带 `aria-orientation="vertical"`。

默认 `activation="auto"`：方向键移到哪个标签就立即选中它。面板渲染较慢时用 `activation="manual"`，方向键只移动焦点，按 `Enter` 或 `Space` 才选中。

## API

### Tabs Props

| 名称          | 说明                                 | 类型                                             | 默认值         |
| ------------- | ------------------------------------ | ------------------------------------------------ | -------------- |
| `modelValue`  | 选中面板的值，配合 `v-model`         | `string \| number`                               | 第一个可用面板 |
| `size`        | 尺寸，默认取表单或全局配置           | `'sm' \| 'md' \| 'lg'`                           | `'md'`         |
| `activation`  | 方向键移到标签时立即选中，还是等确认 | `'auto' \| 'manual'`                             | `'auto'`       |
| `placement`   | 标签的位置                           | `'top' \| 'start' \| 'end'`                      | `'top'`        |
| `closable`    | 每个标签显示关闭按钮                 | `boolean`                                        | `false`        |
| `addable`     | 标签行末尾显示新增按钮               | `boolean`                                        | `false`        |
| `beforeLeave` | 切换前调用，返回 `false` 时不切换    | `(next, current) => boolean \| Promise<boolean>` | —              |

### Tabs Events

| 名称                | 说明                                        | 参数                        |
| ------------------- | ------------------------------------------- | --------------------------- |
| `update:modelValue` | 选中的面板变化                              | `(value: string \| number)` |
| `change`            | 用户选了另一个标签                          | `(value: string \| number)` |
| `remove`            | 点击关闭按钮，或在可关闭的标签上按 `Delete` | `(value: string \| number)` |
| `add`               | 点击新增按钮                                | —                           |

### Tabs Slots

| 名称      | 说明             |
| --------- | ---------------- |
| `default` | `DouTabPanel`    |
| `extra`   | 标签行末尾的内容 |

### TabPanel Props

| 名称       | 说明                                  | 类型               | 默认值  |
| ---------- | ------------------------------------- | ------------------ | ------- |
| `value`    | 面板的值                              | `string \| number` | —       |
| `label`    | 标签文字                              | `string`           | `value` |
| `disabled` | 禁用                                  | `boolean`          | `false` |
| `closable` | 显示关闭按钮，覆盖 Tabs 的 `closable` | `boolean`          | —       |

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
