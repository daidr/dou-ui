# ContextMenu 右键菜单

在一块区域上点右键，在指针处弹出一列操作，代替浏览器自带的菜单。菜单项就是 [Dropdown](./dropdown) 的 `DouDropdownItem`，两种菜单长得一样、键盘行为也一样。

## 基础用法

默认插槽是触发区域（取第一个元素，不额外包一层），`menu` 插槽放菜单项。选中一项触发 `select`，参数是该项的 `value`。

<DocDemo src="context-menu/basic" column />

菜单在指针右下方打开，下方或右侧放不下时翻到另一边。按 <DouKbd>Esc</DouKbd>、点击别处、滚动页面或切走窗口都会关闭。

在触摸屏上长按（约 0.5 秒）打开菜单，手指先移动则照常滚动。长按会在按下的位置发出一次 `contextmenu` 事件，所以下面“针对某一项”的写法在手机上同样有效；长按期间触发区域不会选中文字，也不会弹出系统的长按菜单。

## 针对某一项

一个菜单可以服务整个列表：在列表项的 `contextmenu` 事件里记下是哪一项，再在 `select` 里处理。

<DocDemo src="context-menu/per-item" column />

## 从脚本打开

通过 ref 调用 `open(x, y)` 在视口中的某一点打开；`close()` 关闭。`v-model:open` 可以读写打开状态，`disabled` 时保留浏览器自带的菜单。

## API

### ContextMenu Props

| 名称              | 说明                         | 类型                             | 默认值   |
| ----------------- | ---------------------------- | -------------------------------- | -------- |
| `open`（v-model） | 是否打开                     | `boolean`                        | `false`  |
| `disabled`        | 保留浏览器自带的菜单         | `boolean`                        | `false`  |
| `hideOnSelect`    | 选中后关闭                   | `boolean`                        | `true`   |
| `teleport`        | 渲染到哪里，`false` 原地渲染 | `string \| HTMLElement \| false` | `'body'` |

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

| 名称    | 说明           | 类型                             |
| ------- | -------------- | -------------------------------- |
| `open`  | 在视口某点打开 | `(x: number, y: number) => void` |
| `close` | 关闭           | `() => void`                     |

### 键盘与读屏

- 菜单是 `role="menu"`，打开后焦点进入菜单：<DouKbd>↑</DouKbd> <DouKbd>↓</DouKbd> 在项之间移动，<DouKbd>Home</DouKbd> / <DouKbd>End</DouKbd> 到首尾，<DouKbd>Enter</DouKbd> 或 <DouKbd>Space</DouKbd> 选中，输入首字母跳到对应项。
- 聚焦的元素上按菜单键或 <DouKbd>Shift</DouKbd> + <DouKbd>F10</DouKbd> 也会打开，菜单出现在该元素左下角。
- <DouKbd>Esc</DouKbd> 或 <DouKbd>Tab</DouKbd> 关闭菜单，焦点回到打开前的位置。
