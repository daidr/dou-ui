# Dock 停靠面板

几组标签页，用分隔线拼在一起；把标签拖到另一组，或者拖到一组的边缘拆出新的一组。适合同时打开好几样东西、边看边对照的工作区。

## 基础用法

<DocDemo src="dock/basic" style="padding: 0; height: 420px; overflow: hidden" />

`v-model` 是布局：分割（`type: 'split'`）把两部分左右（`direction: 'horizontal'`）或上下（`'vertical'`）分开，`size` 是 `start` 占的百分比；组（`type: 'group'`）是一行标签，`tabs` 按顺序列出标签的值，`active` 是选中的那个。三部分以上就像例子里这样嵌套。Dock 撑满父元素，父元素需要有确定的高度。

布局里只有 id 和数字，可以直接 `JSON.stringify` 存起来，下次原样恢复。每个标签的文字、图标、是否可关闭放在 `panels` 里，按 `value` 对应；内容由默认插槽渲染，参数是 `{ value }`。

## 拖动

- 拖到某组的**标签行**：和 [Tabs 的拖动排序](./tabs#拖动排序)一样，插入线标出位置，放下后标签移到那里。
- 拖到某组**内容区的边缘**（上、下、左、右各约四分之一）：高亮那一侧将被新组占据的一半，放下后标签在那一侧拆成新的一组，原来的组让出一半位置。一组的宽度放不下两个 `min`（加上 1px 分隔线）时，左右两条边不再拆分，拖到那里和拖到中间一样，高亮也显示为整块；高度放不下时，上下两条边同样处理。
- 拖到**内容区中间**：整块高亮，放下后标签放到这一组的最后。

拖动产生的改动由 Dock 自己完成并通过 `v-model` 写回，同时发出 `move` 或 `split` 告诉你发生了什么。组里的标签拖空后，这一组会自动去掉，它让出的位置并给旁边那部分。只剩一个标签的组不能拖到自己的边缘。

拆分、合并时，没有被拖动的组原样保留，内容的状态和滚动位置都不变。被拖动的那个标签换到了另一组，它的内容会重新渲染，需要保留的状态请放在你的数据里。

标签只能在同一个 Dock 里拖动：不能拖到另一个 Dock，也不能和单独的 `DouTabs` 互相拖。`draggable` 设为 `false` 关掉整个 Dock 的拖动，也包括从外部拖入；`panels` 里某个标签的 `draggable: false` 只让这个标签拖不动（也就不能被拆走），别的标签仍可以挪到它前后。

## 最小尺寸

`min` 是每个分割两侧的最小尺寸，和 Splitter 的 `min`、`minEnd` 一样：数字是百分比，`'120px'` 这样的字符串是像素，默认 `'120px'`。它同时决定一组还能不能拆：放不下两个 `min` 的方向，拖到边缘不会拆分。宽和高要求不同时，写成对象，左右分割用 `width`，上下分割用 `height`，没写的方向用默认值：

<!-- prettier-ignore -->
```vue
<DouDock
  v-model="layout"
  :panels="panels"
  :min="{
    width: '220px',
    height: '200px',
  }"
/>
```

对象里的数字也是百分比，`{ width: 220 }` 不是 220px；百分比超过 50 时任何组都拆不开，开发环境会提示。

## 从外部拖入

列表项、卡片这类 Dock 之外的元素，也可以拖进 Dock 打开：在它的 `pointerdown` 里调用 Dock 实例的 `startDrop(event, { value, label })`。和拖标签一样，按下后移动一小段才开始拖，触屏上要先按住；放到标签行、中间或边缘的效果也一样，发出的 `move`、`split` 里 `from` 为 `null`，表示这是新开的标签。这个值已经在布局里时，就当作从它所在的组拖出来，放回原处什么也不发生。

`value` 要在 `panels` 里有对应的一项，标签的文字从那里取；`label` 是拖动时跟着指针的文字，不设时也取 `panels` 里的。`panels` 可以先列好所有可能打开的项，Dock 只显示布局里有的。Dock 的 `draggable` 为 `false`，或这一项在 `panels` 里 `disabled`、`draggable: false` 时，`startDrop` 什么也不做。

拖动结束时松开的那一下不算点击，所以元素上的 `click` 可以照常用来打开它，键盘用户按 `Enter` 或空格也是这样打开的。链接和图片在拖动时不会被浏览器自己拖走。在触屏上，给元素设上 `touch-action: pan-y`（竖着排的列表）之类的值，滑动仍然滚动列表，按住才开始拖。只支持页面里的元素，不支持从系统拖文件进来。

<DocDemo src="dock/external" style="padding: 0; height: 320px; overflow: hidden" />

## 用菜单或按钮拆分

拖动之外，也可以用导出的函数改布局，比如做“向右拆分”“移到…”菜单，或者给键盘用户一个跨组移动的入口。这些函数返回新的布局，不改动传入的那个：

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

拆分前可以用 Dock 实例的 `canSplit(groupId, side)` 判断这一组在那个方向上还放不放得下两个 `min`，放不下就把按钮禁用，下面的例子就是这样做的。

<DocDemo src="dock/actions" style="padding: 0; height: 360px; overflow: hidden" />

## 每组的操作

`extra` 插槽放在每组标签行的末尾，适合放这一组的操作，比如上面例子里的“更多”菜单。参数 `group` 是这一组，`active` 是它当前选中的标签（组里没有标签时为 `undefined`），可以按它显示随当前标签变化的操作。标签行不宽，按钮多时建议收进一个下拉菜单。

## 最近用过的组

`v-model:active-group` 记着最近用过的那一组的 id：在某组里按下指针、焦点移进某组，或者把标签拖进某组、拆出新组时，都会更新为那一组。挂载时不会自动设置，初始值由你给，不给就是 `undefined`。这一组被拖空或关掉而从布局里消失时，会变回 `undefined`；给的 id 不在布局里时也一样。点开新标签时，可以放进这一组，没有时放进第一组：

```ts
const target = activeGroup.value ?? dockGroups(layout.value)[0].id
layout.value = moveDockTab(layout.value, value, target)
```

## 间距

每组左右各留 12px、底部留 4px，标签行和面板之间留 16px。如果放进来的内容自带内边距、顶部有贴边的标题栏，可以用 CSS 变量调整这些间距，避免两层内边距叠在一起：

```css
.side-dock {
  --dou-dock-padding-x: 0px;
  --dou-dock-panel-gap: 0px;
}
```

把 `class="side-dock"` 加在 `DouDock` 上即可。这样标签行也会贴边。

## 键盘与读屏

每组是一个 [Tabs](./tabs#键盘与读屏)：方向键切换标签，`Alt` 加方向键在组内挪动标签，`Delete` 关闭可关闭的标签。分隔线是 [Splitter](./splitter#键盘与读屏) 的分隔线，聚焦后用方向键调整大小。跨组移动没有默认快捷键，请用上面的函数做成菜单。

## API

### Dock Props

| 名称          | 说明                                            | 类型                           | 默认值            |
| ------------- | ----------------------------------------------- | ------------------------------ | ----------------- |
| `modelValue`  | 布局，配合 `v-model`                            | `DockNode`                     | —                 |
| `panels`      | 每个标签的文字、图标和选项                      | `DockPanel[]`                  | `[]`              |
| `size`        | 标签的尺寸，默认取表单或全局配置                | `'sm' \| 'md' \| 'lg'`         | `'md'`            |
| `closable`    | 每个标签显示关闭按钮                            | `boolean`                      | `false`           |
| `addable`     | 每组的标签行末尾显示新增按钮                    | `boolean`                      | `false`           |
| `draggable`   | 标签可以拖动、拆分；面板自己的 `draggable` 优先 | `boolean`                      | `true`            |
| `min`         | 每个分割两侧的最小尺寸，见[最小尺寸](#最小尺寸) | `SplitterLimit \| DockMinSize` | `'120px'`         |
| `activeGroup` | 最近用过的组的 id，配合 `v-model:active-group`  | `string`                       | —                 |
| `createId`    | 拆出新组时生成它的 id                           | `(layout: DockNode) => string` | `nextDockGroupId` |

### Dock Events

| 名称                 | 说明                               | 参数                                                                       |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `update:modelValue`  | 布局变化                           | `(layout: DockNode)`                                                       |
| `move`               | 标签被拖到组内的新位置，或另一组里 | `(event: { value, from: { group, index } \| null, to: { group, index } })` |
| `split`              | 标签被拖到某组边缘，拆出了新的一组 | `(event: { value, from, target, side, group })`                            |
| `remove`             | 点击关闭按钮，或按 `Delete`        | `(value: string \| number, group: string)`                                 |
| `add`                | 点击某组的新增按钮                 | `(group: string)`                                                          |
| `update:activeGroup` | 最近用过的组变化                   | `(group: string \| undefined)`                                             |

`move` 的 `from` 和 `to` 各有组的 id 和标签在那一组里的位置（从外部拖入的新标签 `from` 为 `null`），`to.index` 是挪完以后的位置，和 Tabs 的 `move` 对应；`split` 的 `from` 也一样，`target` 是被拖到边缘的那一组，`group` 是新组的 id。`move` 和 `split` 带的信息多，用一个对象；`remove` 和 `add` 与 Tabs 的同名事件参数一致，只在最后多了组的 id。

### Dock Exposes

| 名称        | 说明                                                     | 类型                                                                               |
| ----------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `canSplit`  | 某组在这个方向上是否放得下两个 `min`，可以在渲染中读取   | `(groupId: string, side: 'top' \| 'right' \| 'bottom' \| 'left') => boolean`       |
| `startDrop` | 在外部元素的 `pointerdown` 里调用，把它当作标签拖进 Dock | `(event: PointerEvent, item: { value: string \| number; label?: string }) => void` |

### Dock Slots

| 名称      | 说明                                         |
| --------- | -------------------------------------------- |
| `default` | 标签的内容，参数为 `{ value }`               |
| `label`   | 替换标签文字，参数为 `{ value, selected }`   |
| `extra`   | 每组标签行的末尾，参数为 `{ group, active }` |
| `empty`   | 没有任何标签时显示                           |

### CSS 变量

| 变量                        | 说明                                  |
| --------------------------- | ------------------------------------- |
| `--dou-dock-padding-x`      | 每组左右的内边距，默认 12px           |
| `--dou-dock-padding-bottom` | 每组底部的内边距，默认 4px            |
| `--dou-dock-panel-gap`      | 每组标签行和面板之间的距离，默认 16px |

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

type SplitterLimit = number | `${number}px` // 数字为百分比

interface DockMinSize {
  width?: SplitterLimit // 左右分割
  height?: SplitterLimit // 上下分割
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
