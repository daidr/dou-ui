# ContextMenu 右键菜单

在一块区域上点右键，在指针处弹出一列操作，代替浏览器自带的菜单。菜单项就是 [Dropdown](./dropdown) 的 `DouDropdownItem`，两种菜单长得一样、键盘行为也一样。

## 基础用法

默认插槽是触发区域（取第一个元素，不额外包一层），`menu` 插槽放菜单项。选中一项触发 `select`，参数是该项的 `value`。

<DocDemo src="context-menu/basic" column />

菜单在指针右下方打开，下方或右侧放不下时翻到另一边。按 <DouKbd>Esc</DouKbd>、点击别处、滚动页面或切走窗口都会关闭。

在触摸屏上长按（约 0.5 秒）打开菜单，手指先移动则照常滚动。长按会在按下的位置发出一次 `contextmenu` 事件，所以下面“针对某一项”的写法在手机上同样有效；长按期间触发区域不会选中文字，也不会弹出系统的长按菜单。

## 针对某一项

一个菜单可以服务整个列表：在列表项的 `contextmenu` 事件里记下是哪一项，再在 `select` 里处理。

列表的内边距、项之间的空隙也在触发区域里，右键那里菜单照样打开，却没有按在任何一项上。所以每次右键先在捕获阶段清空，再由项的事件记下，没有项时把菜单项禁用，否则操作会落到上一次右键的项上。下面的示例右键列表边缘试试。

<DocDemo src="context-menu/per-item" column />

项由组件渲染时，用组件给出的事件代替，如 [Menu](./menu#右键菜单) 的 `itemContextmenu`、[Table](./table#右键菜单) 的 `rowContextmenu`，参数里带有该项的数据，清空的写法相同。

## 从脚本打开

通过 ref 调用 `open(x, y)` 在视口中的某一点打开，`close()` 关闭。菜单由按钮打开时，传入按钮的位置和大小 `open(x, y, box)`：菜单开在按钮下方，放不下时翻到上方，不会盖住按钮。`v-model:open` 可以读写打开状态，`disabled` 时保留浏览器自带的菜单。

## 用数据写菜单项

菜单项在代码里生成时，可以不写 `menu` 插槽，直接传 `items`。每项是一个 `ContextMenuItem`，选中时调用它的 `run`，`select` 事件同样会触发，参数是 `key`。[DouDropdown](./dropdown#用数据写菜单项) 的 `items`，以及日历视图、流程图和甘特图的菜单项也是这个类型。同时写了 `menu` 插槽时显示插槽，`items` 不起作用，开发时会在控制台提示一次。

```vue
<DouContextMenu :items="items">
  <div>在这里点右键</div>
</DouContextMenu>
```

```ts
import type { ContextMenuItem } from 'dou-ui'
import { CopyIcon, TrashIcon } from '@dou-ui/icons'

const items: ContextMenuItem[] = [
  { key: 'copy', label: '复制', icon: CopyIcon, shortcut: 'mod+c', run: copy },
  { key: 'delete', label: '删除', icon: TrashIcon, tone: 'danger', divided: true, run: remove },
]
```

| 名称       | 说明                                                       | 类型               |
| ---------- | ---------------------------------------------------------- | ------------------ |
| `key`      | 菜单里唯一，也是 `select` 的参数                           | `string`           |
| `label`    | 文字                                                       | `string`           |
| `icon`     | 图标                                                       | `Component`        |
| `shortcut` | 显示在右侧的快捷键，写法和 `useHotkey` 一样；只用于显示    | `string`           |
| `disabled` | 禁用                                                       | `boolean`          |
| `tone`     | 色调，`'danger'` 表示危险操作                              | `DropdownItemTone` |
| `divided`  | 上方画一条分隔线                                           | `boolean`          |
| `checked`  | 显示勾选标记，比如当前选中的选项；每一项都写了时菜单是单选 | `boolean`          |
| `run`      | 选中时调用；不写时在 `select` 里处理                       | `() => void`       |

触屏上不显示 `shortcut`。

`select` 的参数类型是 `string | number | undefined`，因为写在插槽里的 `DouDropdownItem` 的 `value` 可以是数字，也可以不写。用 `items` 时它总是某一项的 `key`，处理函数的参数写成 `DropdownValue | undefined`，或者把要做的事写在 `run` 里。

## API

### ContextMenu Props

| 名称              | 说明                                                          | 类型                             | 默认值   |
| ----------------- | ------------------------------------------------------------- | -------------------------------- | -------- |
| `open`（v-model） | 是否打开                                                      | `boolean`                        | `false`  |
| `disabled`        | 保留浏览器自带的菜单                                          | `boolean`                        | `false`  |
| `hideOnSelect`    | 选中后关闭                                                    | `boolean`                        | `true`   |
| `teleport`        | 渲染到哪里，`false` 原地渲染                                  | `string \| HTMLElement \| false` | `'body'` |
| `items`           | 用数据写的菜单项，代替 `menu` 插槽，见[上文](#用数据写菜单项) | `ContextMenuItem[]`              | —        |

### ContextMenu Events

| 名称     | 说明     | 参数                                     |
| -------- | -------- | ---------------------------------------- |
| `select` | 选中一项 | `(value: string \| number \| undefined)` |

### ContextMenu Slots

| 名称      | 说明                             |
| --------- | -------------------------------- |
| `default` | 触发区域，第一个元素接收右键事件 |
| `menu`    | 菜单项，`DouDropdownItem`        |

### ContextMenu Exposes

| 名称    | 说明                                        | 类型                                                                      |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `open`  | 在视口某点打开；给出 `box` 时开在这个框旁边 | `(x: number, y: number, box?: { width: number; height: number }) => void` |
| `close` | 关闭                                        | `() => void`                                                              |

### 键盘与读屏

- 菜单是 `role="menu"`，打开后焦点进入菜单：<DouKbd>↑</DouKbd> <DouKbd>↓</DouKbd> 在项之间移动，<DouKbd>Home</DouKbd> / <DouKbd>End</DouKbd> 到首尾，<DouKbd>Enter</DouKbd> 或 <DouKbd>Space</DouKbd> 选中，输入首字母跳到对应项。
- 聚焦的元素上按菜单键或 <DouKbd>Shift</DouKbd> + <DouKbd>F10</DouKbd> 也会打开，菜单出现在该元素左下角。
- <DouKbd>Esc</DouKbd> 或 <DouKbd>Tab</DouKbd> 关闭菜单，焦点回到打开前的位置。
