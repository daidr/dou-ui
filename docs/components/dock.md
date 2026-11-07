# Dock 停靠面板

几组标签页，用分隔线拼在一起；把标签拖到另一组，或者拖到一组的边缘拆出新的一组。适合同时打开好几样东西、边看边对照的工作区。

## 基础用法

<DocDemo src="dock/basic" style="padding: 0; height: 420px; overflow: hidden" />

`v-model` 是布局：分割（`type: 'split'`）把两部分左右（`direction: 'horizontal'`）或上下（`'vertical'`）分开，`size` 是 `start` 占的百分比；组（`type: 'group'`）是一行标签，`tabs` 按顺序列出标签的值，`active` 是选中的那个。三部分以上就像例子里这样嵌套。Dock 撑满父元素，父元素需要有确定的高度。

布局里只有 id 和数字，可以直接 `JSON.stringify` 存起来，下次原样恢复。每个标签的文字、图标、是否可关闭放在 `panels` 里，按 `value` 对应；内容由默认插槽渲染，参数是 `{ value }`。

## 拖动

- 拖到某组的**标签行**：和 [Tabs 的拖动排序](./tabs#拖动排序)一样，插入线标出位置，放下后标签移到那里。
- 拖到某组**内容区的边缘**（上、下、左、右各约四分之一）：高亮那一侧将被新组占据的一半，放下后标签在那一侧拆成新的一组，原来的组让出一半位置。
- 拖到**内容区中间**：整块高亮，放下后标签放到这一组的最后。

拖动产生的改动由 Dock 自己完成并通过 `v-model` 写回，同时发出 `move` 或 `split` 告诉你发生了什么。组里的标签拖空后，这一组会自动去掉，它让出的位置并给旁边那部分。只剩一个标签的组不能拖到自己的边缘。

拆分、合并时，没有被拖动的组原样保留，内容的状态和滚动位置都不变。被拖动的那个标签换到了另一组，它的内容会重新渲染，需要保留的状态请放在你的数据里。

只能在同一个 Dock 里拖动：不能拖到另一个 Dock，也不能和单独的 `DouTabs` 互相拖。`draggable` 设为 `false` 关掉整个 Dock 的拖动；`panels` 里某个标签的 `draggable: false` 只让这个标签拖不动（也就不能被拆走），别的标签仍可以挪到它前后。

## 用菜单或按钮拆分

拖动之外，也可以用导出的函数改布局，比如做“向右拆分”“移到…”菜单，或者给键盘用户一个跨组移动的入口。每组的按钮放在 `extra` 插槽里，它在每组标签行的末尾，参数 `{ group }` 是这一组，可以按 `group.active` 显示随当前标签变化的操作。这些函数返回新的布局，不改动传入的那个：

| 函数                                                 | 作用                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `moveDockTab(layout, value, groupId, index?)`        | 把标签移到某组的 `index`（不设时放到最后），并选中它；值还不在布局里时就是新开一个标签 |
| `splitDockTab(layout, value, groupId, side, newId?)` | 把标签拆到某组的 `'top'` `'right'` `'bottom'` `'left'`                                 |
| `removeDockTab(layout, value)`                       | 去掉标签                                                                               |
| `selectDockTab(layout, value)`                       | 选中标签                                                                               |
| `findDockGroup(layout, value)`                       | 标签所在的组                                                                           |
| `dockGroups(layout)`                                 | 所有的组，从左上开始                                                                   |
| `nextDockGroupId(layout)`                            | 还没用过的组 id：`group-1`、`group-2`……                                                |

和 Tabs 一样，关闭按钮只发出 `remove`，新增按钮只发出 `add`，参数在 Tabs 的基础上多了组的 id：去掉用 `removeDockTab`，新开一个标签就把它加进 `panels`，再用 `moveDockTab` 放进那一组。所有标签都关掉后保留一个空组，显示 `empty` 插槽。

<DocDemo src="dock/actions" style="padding: 0; height: 360px; overflow: hidden" />

想把新打开的标签放进最近用过的那一组时，监听 `activate`：在某组里按下指针或焦点移进某组时发出，参数是组的 id，换到另一组时才发一次。

## 键盘与读屏

每组是一个 [Tabs](./tabs#键盘与读屏)：方向键切换标签，`Alt` 加方向键在组内挪动标签，`Delete` 关闭可关闭的标签。分隔线是 [Splitter](./splitter#键盘与读屏) 的分隔线，聚焦后用方向键调整大小。跨组移动没有默认快捷键，请用上面的函数做成菜单。

## API

### Dock Props

| 名称         | 说明                                                                                     | 类型                           | 默认值            |
| ------------ | ---------------------------------------------------------------------------------------- | ------------------------------ | ----------------- |
| `modelValue` | 布局，配合 `v-model`                                                                     | `DockNode`                     | —                 |
| `panels`     | 每个标签的文字、图标和选项                                                               | `DockPanel[]`                  | `[]`              |
| `size`       | 标签的尺寸，默认取表单或全局配置                                                         | `'sm' \| 'md' \| 'lg'`         | `'md'`            |
| `closable`   | 每个标签显示关闭按钮                                                                     | `boolean`                      | `false`           |
| `addable`    | 每组的标签行末尾显示新增按钮                                                             | `boolean`                      | `false`           |
| `draggable`  | 标签可以拖动、拆分；面板自己的 `draggable` 优先                                          | `boolean`                      | `true`            |
| `min`        | 每个分割两侧的最小尺寸，同 Splitter 的 `min` 和 `minEnd`：数字为百分比，`'120px'` 为像素 | `number \| string`             | `'120px'`         |
| `createId`   | 拆出新组时生成它的 id                                                                    | `(layout: DockNode) => string` | `nextDockGroupId` |

### Dock Events

| 名称                | 说明                                 | 参数                                                               |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `update:modelValue` | 布局变化                             | `(layout: DockNode)`                                               |
| `move`              | 标签被拖到组内的新位置，或另一组里   | `(event: { value, from: { group, index }, to: { group, index } })` |
| `split`             | 标签被拖到某组边缘，拆出了新的一组   | `(event: { value, from, target, side, group })`                    |
| `remove`            | 点击关闭按钮，或按 `Delete`          | `(value: string \| number, group: string)`                         |
| `add`               | 点击某组的新增按钮                   | `(group: string)`                                                  |
| `activate`          | 在另一组里按下指针，或焦点移进另一组 | `(group: string)`                                                  |

`move` 的 `from` 和 `to` 各有组的 id 和标签在那一组里的位置，`to.index` 是挪完以后的位置，和 Tabs 的 `move` 对应；`split` 的 `from` 也一样，`target` 是被拖到边缘的那一组，`group` 是新组的 id。`move` 和 `split` 带的信息多，用一个对象；`remove` 和 `add` 与 Tabs 的同名事件参数一致，只在最后多了组的 id。

### Dock Slots

| 名称      | 说明                                       |
| --------- | ------------------------------------------ |
| `default` | 标签的内容，参数为 `{ value }`             |
| `label`   | 替换标签文字，参数为 `{ value, selected }` |
| `extra`   | 每组标签行的末尾，参数为 `{ group }`       |
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
  draggable?: boolean
}
```
