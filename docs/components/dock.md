# Dock 停靠面板

几组标签页，用分隔线拼在一起；把标签拖到另一组，或者拖到一组的边缘拆出新的一组。适合同时打开好几样东西、边看边对照的工作区。

## 基础用法

<DocDemo src="dock/basic" style="padding: 0; height: 420px; overflow: hidden" />

`v-model` 是布局：分割（`type: 'split'`）把两部分左右（`direction: 'horizontal'`）或上下（`'vertical'`）分开，`size` 是 `start` 占的百分比；组（`type: 'group'`）是一行标签，`tabs` 按顺序列出标签的值，`active` 是选中的那个。三部分以上就像例子里这样嵌套。Dock 撑满父元素，记得给父元素一个高度。

布局里只有 id 和数字，可以直接 `JSON.stringify` 存起来，下次原样恢复。每个标签的文字、图标、是否可关闭放在 `panels` 里，按 `value` 对应；内容由默认插槽渲染，参数是 `{ value }`。

## 拖动

- 拖到某组的**标签行**：和 [Tabs 的拖动排序](./tabs#拖动排序)一样，插入线标出位置，放下后标签移到那里。
- 拖到某组**内容区的边缘**（上、下、左、右各约四分之一）：高亮那一侧将被新组占据的一半，放下后标签在那一侧拆成新的一组，原来的组让出一半位置。
- 拖到**内容区中间**：整块高亮，放下后标签放到这一组的最后。

拖动产生的改动由 Dock 自己完成并通过 `v-model` 写回，同时发出 `move` 或 `split` 告诉你发生了什么。组里的标签拖空后，这一组会自动去掉，它让出的位置并给旁边那部分。只剩一个标签的组不能拖到自己的边缘（那样只会原地重建一次）。

标签移到别的组时，它的内容会重新渲染，需要保留的状态请放在你的数据里。

## 用菜单或按钮拆分

拖动之外，也可以用导出的函数改布局，比如做“向右拆分”“移到…”菜单，或者给键盘用户一个跨组移动的入口。这些函数返回新的布局，不改动传入的那个：

| 函数                                                 | 作用                                                   |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `moveDockTab(layout, value, groupId, index?)`        | 把标签移到某组的 `index`（不设时放到最后），并选中它   |
| `splitDockTab(layout, value, groupId, side, newId?)` | 把标签拆到某组的 `'top'` `'right'` `'bottom'` `'left'` |
| `removeDockTab(layout, value)`                       | 去掉标签                                               |
| `selectDockTab(layout, value)`                       | 选中标签                                               |
| `findDockGroup(layout, value)`                       | 标签所在的组                                           |
| `dockGroups(layout)`                                 | 所有的组，从左上开始                                   |
| `nextDockGroupId(layout)`                            | 还没用过的组 id：`group-1`、`group-2`……                |

和 Tabs 一样，关闭按钮只发出 `remove`，由你来去掉（可以先确认），用 `removeDockTab` 即可。所有标签都关掉后保留一个空组，显示 `empty` 插槽。

<DocDemo src="dock/actions" style="padding: 0; height: 360px; overflow: hidden" />

## 键盘与读屏

每组就是一个 [Tabs](./tabs#键盘与读屏)：方向键切换标签，`Alt` 加方向键在组内挪动标签，`Delete` 关闭可关闭的标签。分隔线是 [Splitter](./splitter#键盘与读屏) 的分隔线，聚焦后用方向键调整大小。跨组移动没有默认快捷键，请用上面的函数做成菜单。

## API

### Dock Props

| 名称         | 说明                                       | 类型                           | 默认值            |
| ------------ | ------------------------------------------ | ------------------------------ | ----------------- |
| `modelValue` | 布局，配合 `v-model`                       | `DockNode`                     | —                 |
| `panels`     | 每个标签的文字、图标和选项                 | `DockPanel[]`                  | `[]`              |
| `size`       | 标签的尺寸，默认取表单或全局配置           | `'sm' \| 'md' \| 'lg'`         | `'md'`            |
| `closable`   | 每个标签显示关闭按钮                       | `boolean`                      | `false`           |
| `addable`    | 每组的标签行末尾显示新增按钮               | `boolean`                      | `false`           |
| `minSize`    | 拖动分隔线时每部分的最小尺寸，数字为百分比 | `number \| string`             | `'120px'`         |
| `createId`   | 拆出新组时生成它的 id                      | `(layout: DockNode) => string` | `nextDockGroupId` |

### Dock Events

| 名称                | 说明                               | 参数                                            |
| ------------------- | ---------------------------------- | ----------------------------------------------- |
| `update:modelValue` | 布局变化                           | `(layout: DockNode)`                            |
| `move`              | 标签被拖到组内的新位置，或另一组里 | `(event: { value, from, to, index })`           |
| `split`             | 标签被拖到某组边缘，拆出了新的一组 | `(event: { value, from, target, side, group })` |
| `remove`            | 点击关闭按钮，或按 `Delete`        | `(value: string \| number, group: string)`      |
| `add`               | 点击某组的新增按钮                 | `(group: string)`                               |

`move` 的 `from` 和 `to` 是组的 id，`index` 是标签在那一组里的位置；`split` 的 `target` 是被拖到边缘的那一组，`group` 是新组的 id。

### Dock Slots

| 名称      | 说明                                       |
| --------- | ------------------------------------------ |
| `default` | 标签的内容，参数为 `{ value }`             |
| `label`   | 替换标签文字，参数为 `{ value, selected }` |
| `empty`   | 没有任何标签时显示                         |

### 类型

```ts
type DockNode = DockSplit | DockGroup

interface DockSplit {
  type: 'split'
  direction: 'horizontal' | 'vertical'
  size?: number // start 占的百分比，默认 50
  start: DockNode
  end: DockNode
}

interface DockGroup {
  type: 'group'
  id: string
  tabs: (string | number)[]
  active?: string | number
}

interface DockPanel {
  value: string | number
  label?: string
  icon?: Component
  closable?: boolean
  disabled?: boolean
}
```
