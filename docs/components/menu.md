# Menu 导航菜单

应用的侧边栏或顶部导航。行的样式和树一致：二级灰色的文字，悬停变墨色并铺一层极淡的底色；当前页面的底色稍深，字重加粗。收起的子菜单如果包含当前页面，它自己的文字也是墨色，回去的路始终看得见。

<script setup>
import { h, ref } from 'vue'
const icon = (d) => () =>
  h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [h('path', { d })])
const items = [
  { key: 'overview', label: '概览', icon: icon('M2.5 2.5h4.5v4.5h-4.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5h-4.5zM9 9h4.5v4.5H9z') },
  {
    key: 'deployments',
    label: '部署',
    icon: icon('M8 2l5.5 3v6L8 14l-5.5-3V5zM8 8v6M8 8l5.5-3M8 8L2.5 5'),
    children: [
      { key: 'production', label: '生产环境' },
      { key: 'preview', label: '预览环境' },
      { key: 'rollback', label: '回滚记录', disabled: true },
    ],
  },
  { key: 'logs', label: '日志', icon: icon('M3 3.5h10M3 6.5h10M3 9.5h6M3 12.5h8') },
  {
    type: 'group',
    label: '设置',
    children: [
      { key: 'domains', label: '域名', icon: icon('M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12') },
      { key: 'members', label: '成员', icon: icon('M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4') },
    ],
  },
]
const current = ref('production')
const collapsed = ref(false)
</script>

## 侧边导航

菜单由 `items` 数据驱动。带 `children` 的项是子菜单，在原地展开；`type: 'group'` 是带标题的分组，`type: 'divider'` 是分隔线。`v-model` 绑定当前项的 `key`；没有绑定 `v-model:expanded` 时，当前项所在的子菜单一开始就是展开的。

<div class="demo">
  <DouMenu v-model="current" :items="items" style="width: 220px" />
</div>

```vue
<script setup>
const items = [
  { key: 'overview', label: '概览', icon: OverviewIcon },
  {
    key: 'deployments',
    label: '部署',
    icon: DeployIcon,
    children: [
      { key: 'production', label: '生产环境' },
      { key: 'preview', label: '预览环境' },
      { key: 'rollback', label: '回滚记录', disabled: true },
    ],
  },
  { type: 'group', label: '设置', children: [/* … */] },
]
const current = ref('production')
</script>

<template>
  <DouMenu v-model="current" :items="items" />
</template>
```

项上写 `href` 时渲染为链接；配合路由时通常不写 `href`，而是在 `select` 事件里跳转。`accordion` 让同一层最多展开一个子菜单。

## 折叠

`collapsed` 把菜单收成一列图标：叶子项悬停时用文字提示显示名称，子菜单改为向右弹出。没有图标的项显示名称的首字。

<div class="demo">
  <DouMenu v-model="current" :items="items" :collapsed="collapsed" :style="{ width: collapsed ? 'auto' : '220px' }" />
  <DouButton size="sm" variant="outline" @click="collapsed = !collapsed">{{ collapsed ? '展开' : '折叠' }}</DouButton>
</div>

```vue
<DouMenu v-model="current" :items="items" :collapsed="collapsed" />
```

## 水平

`mode="horizontal"` 排成一行，压在一道细线上，当前项（或包含当前项的子菜单）带墨色下划线，和标签页一致。子菜单向下弹出；分组在横排里只留一道竖线分隔。

<div class="demo demo--column">
  <DouMenu v-model="current" :items="items" mode="horizontal" />
</div>

```vue
<DouMenu v-model="current" :items="items" mode="horizontal" />
```

弹出的子菜单直接复用 [Dropdown](./dropdown)：更深一层的子菜单和分组都摊平成带小标题的一段，当前项后面带一个对勾。

## 自定义标签

`label` 插槽替换每一项的文字，比如加上计数，参数为 `{ item, selected }`。

```vue
<DouMenu v-model="current" :items="items">
  <template #label="{ item }">
    {{ item.label }}
    <DouBadge v-if="item.key === 'logs'" :value="3" />
  </template>
</DouMenu>
```

## 键盘与读屏

菜单渲染为 `<nav>` 里的列表，属于网站导航而不是应用菜单，所以不使用 `menu` 角色；需要时给它加 `aria-label`。当前项带 `aria-current="page"`，子菜单的开关是带 `aria-expanded` 与 `aria-controls` 的按钮，分组是带名称的 `role="group"`。

除了 `Tab`，竖向菜单里 `↑` `↓` 在可见的项之间移动，`Home` / `End` 跳到首尾，`→` 展开子菜单，`←` 收起或回到上一级；水平菜单里 `←` `→` 移动，`↓` 打开子菜单。

## API

### Props

| 名称         | 说明                                  | 类型                         | 默认值       |
| ------------ | ------------------------------------- | ---------------------------- | ------------ |
| `items`      | 菜单数据                              | `MenuOption[]`               | `[]`         |
| `modelValue` | 当前项的 `key`，配合 `v-model`        | `string \| number`           | —            |
| `expanded`   | 展开的子菜单，配合 `v-model:expanded` | `(string \| number)[]`       | 当前项的上级 |
| `mode`       | 方向                                  | `'vertical' \| 'horizontal'` | `'vertical'` |
| `collapsed`  | 竖向时收成一列图标                    | `boolean`                    | `false`      |
| `accordion`  | 同一层最多展开一个子菜单              | `boolean`                    | `false`      |

### MenuOption

`MenuOption` 是以下三种之一：

| 类型                | 字段                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `MenuItemOption`    | `key`、`label`、`icon?: Component`、`disabled?`、`href?`、`children?` |
| `MenuGroupOption`   | `type: 'group'`、`label`、`children`                                  |
| `MenuDividerOption` | `type: 'divider'`                                                     |

### Events

| 名称                | 说明                   | 参数                                            |
| ------------------- | ---------------------- | ----------------------------------------------- |
| `update:modelValue` | 当前项变化             | `(key: string \| number)`                       |
| `update:expanded`   | 展开的子菜单变化       | `(keys: (string \| number)[])`                  |
| `select`            | 选中了一个没有子项的项 | `(key: string \| number, item: MenuItemOption)` |

### Slots

| 名称    | 说明                                          |
| ------- | --------------------------------------------- |
| `label` | 替换每一项的文字，参数为 `{ item, selected }` |

### CSS 变量

| 变量                     | 说明         |
| ------------------------ | ------------ |
| `--dou-menu-item-height` | 行高         |
| `--dou-menu-indent`      | 每一级的缩进 |
| `--dou-menu-selected-bg` | 当前项的底色 |
