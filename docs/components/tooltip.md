# Tooltip 文字提示

鼠标悬停或聚焦时显示的提示信息。

浮层的通用行为（渲染位置、定位、层级、关闭）见 [浮层](../guide/overlays)。

## 基础用法

默认插槽是触发元素，`content` 是提示文字。指向后稍等片刻出现，键盘聚焦时立即出现。同一时间只显示一个由悬停或聚焦打开的提示：键盘聚焦在一个按钮上时再用鼠标指向另一个，前一个提示会关闭。通过 `v-model:open` 从外部打开的提示（比如引导说明）不参与：不会关掉别的提示，也不会被别的提示关掉。

<DocDemo src="tooltip/basic" />

触发元素不需要额外的包裹：属性与事件直接加在插槽的第一个元素上。插槽里只是一段文字时，会包一层 `<span>`。

## 位置

`placement` 是首选的一侧，放不下时自动翻到对侧。

<DocDemo src="tooltip/placement" />

## 快捷键

按钮有快捷键时，用 `shortcut` 写出来，按 `useHotkey` 的写法，例如 `mod+z`。提示在文字后面按当前平台显示按键（苹果设备上是 ⌘，其他是 Ctrl），并给触发元素加上 `aria-keyshortcuts`，读屏也能读到。用了 `content` 插槽时，按键显示在插槽内容后面。

<DocDemo src="tooltip/shortcut" />

## 自定义内容

`content` 插槽可以放更丰富的内容，例如标题加说明。

<DocDemo src="tooltip/custom" />

## 跟随鼠标与可否移入

`followCursor` 让提示跟着鼠标走，而不是固定在触发元素旁边，适合图表、热区这类较大的区域。触屏上不跟随。

提示默认可以移入，方便选中里面的文字；`interactive` 设为 `false` 后，鼠标离开触发元素就关闭，提示本身也不再挡住下面的内容。跟随鼠标时总是不可移入。

<DocDemo src="tooltip/follow" />

## 键盘与读屏

提示带有 `role="tooltip"`，显示期间触发元素的 `aria-describedby` 指向它，读屏会在读完触发元素后读出提示。`Esc` 关闭提示且不移动焦点。指针可以移到提示上而不让它消失。

## API

### Props

| 名称           | 说明                                                              | 类型                             | 默认值   |
| -------------- | ----------------------------------------------------------------- | -------------------------------- | -------- |
| `open`         | 是否显示，配合 `v-model:open`；从外部打开的提示不会被其他提示关掉 | `boolean`                        | `false`  |
| `content`      | 提示文字                                                          | `string`                         | —        |
| `shortcut`     | 快捷键，显示在文字后面                                            | `string`                         | —        |
| `placement`    | 首选的一侧                                                        | `Placement`                      | `'top'`  |
| `disabled`     | 不再显示                                                          | `boolean`                        | `false`  |
| `showDelay`    | 指向后多久显示，毫秒                                              | `number`                         | `200`    |
| `hideDelay`    | 离开后多久隐藏，毫秒                                              | `number`                         | `100`    |
| `offset`       | 与触发元素的间距，px                                              | `number`                         | `6`      |
| `followCursor` | 跟随鼠标                                                          | `boolean`                        | `false`  |
| `interactive`  | 鼠标可以移入提示                                                  | `boolean`                        | `true`   |
| `teleport`     | 渲染到哪里；`false` 为原地渲染                                    | `string \| HTMLElement \| false` | `'body'` |

`Placement` 为 `'top' | 'right' | 'bottom' | 'left'`，可加 `-start` / `-end`。

### Slots

| 名称      | 说明                     |
| --------- | ------------------------ |
| `default` | 触发元素                 |
| `content` | 提示内容，替代 `content` |

### CSS 变量

| 变量                      | 说明     |
| ------------------------- | -------- |
| `--dou-tooltip-bg`        | 底色     |
| `--dou-tooltip-color`     | 文字颜色 |
| `--dou-tooltip-border`    | 描边颜色 |
| `--dou-tooltip-max-width` | 最大宽度 |
