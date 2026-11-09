# Tabs 标签页

在同一区域内切换几组相关的内容。

## 基础用法

<DocDemo src="tabs/basic" column />

不绑定 `v-model` 时默认选中第一个可用的标签。面板在第一次显示时才渲染，之后切走也会保留，切回来是即时的，状态也还在。面板设了 `eager` 时一开始就渲染，适合放隐藏时也要存在的内容，比如提交时要校验的表单字段。

## 自定义标签与额外内容

面板的 `icon` 接收一个图标组件，显示在标签文字前面。`label` 插槽替换标签文字，比如加上计数，插槽参数为 `{ selected }`。`DouTabs` 的 `extra` 插槽放在标签行的末尾。

<DocDemo src="tabs/custom-label" column />

## 可关闭与新增

`closable` 给每个标签加一个关闭按钮，`addable` 在标签行末尾加一个新增按钮。组件只发出 `remove` 和 `add`，增删面板由你来做，这样关闭前可以先确认、新建时可以先起名。面板自己的 `closable` 优先，适合让某个标签常驻。

<DocDemo src="tabs/closable" column />

关闭按钮不在 `Tab` 顺序里（标签本身已经是按钮，里面不能再放按钮）；焦点在可关闭的标签上时按 `Delete` 或 `Backspace` 关闭它，标签通过 `aria-keyshortcuts` 告诉读屏这个快捷键。

## 拖动排序

`draggable` 让标签可以拖动：按住标签移动一段距离后开始拖，原来的位置留一个变淡的标签，落点用两个标签之间的竖线表示，放下后选中被拖的标签。触屏上要先按住片刻再拖，这样手指滑动仍然是横向滚动标签行；`Esc` 放弃这次拖动。禁用的标签不能拖动。

键盘上，焦点在标签上时按 `Alt` + `←` / `→`（竖排时 `↑` / `↓`）把它前后挪一位，`Alt` + `Home` / `End` 挪到首尾，挪完读屏会播报新位置。

和增删一样，组件只发出 `move`，参数是 `{ value, from, to }`，`from` 和 `to` 各有 `name` 和 `index`；`to.index` 是挪完以后的位置，按它把数据挪过去即可。面板自己的 `draggable` 优先：设为 `false` 的标签自己拖不动，但别的标签仍可以挪到它前后，它的位置会随之变化，并不是钉在原处。

<DocDemo src="tabs/draggable" column />

## 在几组标签之间拖动

`group` 相同的几个 `DouTabs` 之间可以互相拖标签，每组用 `name` 区分。`move` 由标签落入的那一组发出，`from.name` 和 `to.name` 告诉你从哪组移到哪组，数据由你来挪；标签移走时如果它正被选中，原来那组选中哪个也由你决定，和关闭时一样。键盘只能在一组之内挪动，跨组请提供菜单之类的入口。要拖到边缘拆出新的一组，用 [Dock 停靠面板](./dock)。

<DocDemo src="tabs/group" column />

## 标签较多时

放不下的标签行可以横向滚动：有更多标签的一侧边缘渐隐，两端出现箭头按钮，点击翻过大约一屏。选中的标签（包括用方向键切换、或从外部改 `v-model`）总会滚进可见范围。箭头不在 `Tab` 顺序里，键盘用方向键在标签之间移动即可。标签行很窄（不到 160px，比如停靠面板里挤窄的一组）时不显示箭头，免得箭头占满整行、一个标签都看不到，这时用滑动、滚轮或方向键滚动。

<DocDemo src="tabs/overflow" column />

## 竖排

`placement="start"` 把标签竖排在面板左侧，`"end"` 放在右侧。指示线移到标签列的边上，方向键改为 `↑` `↓`。面板总是和标签列一样高，内容再短也一直延伸到底。

<DocDemo src="tabs/vertical" column />

## 固定高度

设置 `height` 后标签页占据固定的高度（数字为 px，`'100%'` 撑满父元素）：面板填满标签以外的空间，内容超出时在面板里单独滚动；竖排的标签放不下时，标签列也单独滚动，有更多标签的一端渐隐，选中的标签总会滚进可见范围。

不设 `height` 时标签页随内容伸展，面板不是滚动区域，内容里的吸顶元素仍然跟随页面滚动。

<DocDemo src="tabs/fixed-height" column />

## 只显示图标

`icon-only` 让每个标签只显示面板的 `icon`，适合窄的侧栏。标签文字成为标签的可读名称（`aria-label`），悬停或聚焦时显示在提示里：竖排时在标签列旁边，横排时在标签上方。每个面板都要写 `icon` 和 `label` 属性：`label` 插槽在这个模式下不显示，也不能当作名称，缺了 `label` 时名称会变成 `value`，开发时会在控制台提醒。没有 `icon` 的面板仍然显示完整文字（而不是只显示首字），这样标签依然认得出来，遗漏也一眼可见，开发时同样会提醒。可关闭的纯图标标签会加宽，给关闭按钮留出位置。

触屏上轻点不会显示提示（和其他纯图标按钮一样），名称只提供给读屏。以触屏为主的界面建议保留文字，或者在面板里重复标题。

<DocDemo src="tabs/icon-only" column />

## 离开前确认

`beforeLeave` 在切换前调用，参数是要去的值和当前的值；返回 `false`（或 resolve 为 `false`）就留在当前标签。

<DocDemo src="tabs/before-leave" column />

## 尺寸

<DocDemo src="tabs/size" column />

## 键盘与读屏

标签行带 `role="tablist"`，每个标签是 `role="tab"` 的按钮，通过 `aria-controls` 指向自己的 `role="tabpanel"` 面板。只有选中的标签在 `Tab` 顺序里；`←` `→` 在标签之间移动并跳过禁用项，到头后回绕，`Home` / `End` 跳到首尾；竖排时方向键是 `↑` `↓`，标签行带 `aria-orientation="vertical"`。

`draggable` 时每个可拖动的标签通过 `aria-keyshortcuts` 声明 `Alt` 加方向键的挪动快捷键。

默认 `activation="auto"`：方向键移到哪个标签就立即选中它。面板渲染较慢时用 `activation="manual"`，方向键只移动焦点，按 `Enter` 或 `Space` 才选中。

## API

### Tabs Props

| 名称          | 说明                                   | 类型                                             | 默认值         |
| ------------- | -------------------------------------- | ------------------------------------------------ | -------------- |
| `modelValue`  | 选中面板的值，配合 `v-model`           | `string \| number`                               | 第一个可用面板 |
| `size`        | 尺寸，默认取表单或全局配置             | `'sm' \| 'md' \| 'lg'`                           | `'md'`         |
| `activation`  | 方向键移到标签时立即选中，还是等确认   | `'auto' \| 'manual'`                             | `'auto'`       |
| `placement`   | 标签的位置                             | `'top' \| 'start' \| 'end'`                      | `'top'`        |
| `height`      | 固定高度，数字为 px；面板在其中滚动    | `number \| string`                               | —              |
| `iconOnly`    | 标签只显示面板的图标                   | `boolean`                                        | `false`        |
| `closable`    | 每个标签显示关闭按钮                   | `boolean`                                        | `false`        |
| `addable`     | 标签行末尾显示新增按钮                 | `boolean`                                        | `false`        |
| `beforeLeave` | 切换前调用，返回 `false` 时不切换      | `(next, current) => boolean \| Promise<boolean>` | —              |
| `draggable`   | 标签可以拖动排序，也接收同组拖来的标签 | `boolean`                                        | `false`        |
| `group`       | 同名的几组标签之间可以互相拖标签       | `string`                                         | —              |
| `name`        | 在 `move` 事件里标识这一组             | `string`                                         | —              |

### Tabs Events

| 名称                | 说明                                                              | 参数                                                             |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `update:modelValue` | 选中的面板变化                                                    | `(value: string \| number)`                                      |
| `change`            | 用户选了另一个标签                                                | `(value: string \| number)`                                      |
| `remove`            | 点击关闭按钮，或在可关闭的标签上按 `Delete`                       | `(value: string \| number)`                                      |
| `add`               | 点击新增按钮                                                      | —                                                                |
| `move`              | 标签被拖到新位置，或用 `Alt` 加方向键挪动；由标签落入的那一组发出 | `(event: { value, from: { name, index }, to: { name, index } })` |

### Tabs Slots

| 名称      | 说明             |
| --------- | ---------------- |
| `default` | `DouTabPanel`    |
| `extra`   | 标签行末尾的内容 |

### TabPanel Props

| 名称        | 说明                                  | 类型               | 默认值  |
| ----------- | ------------------------------------- | ------------------ | ------- |
| `value`     | 面板的值                              | `string \| number` | —       |
| `label`     | 标签文字                              | `string`           | `value` |
| `icon`      | 标签文字前的图标组件                  | `Component`        | —       |
| `disabled`  | 禁用                                  | `boolean`          | `false` |
| `closable`  | 显示关闭按钮，覆盖 Tabs 的 `closable` | `boolean`          | —       |
| `draggable` | 能否拖动，覆盖 Tabs 的 `draggable`    | `boolean`          | —       |
| `eager`     | 一开始就渲染内容，不等第一次显示      | `boolean`          | `false` |

### TabPanel Slots

| 名称      | 说明                                                     |
| --------- | -------------------------------------------------------- |
| `default` | 面板内容                                                 |
| `label`   | 替换标签文字，参数为 `{ selected }`；`iconOnly` 时不显示 |

### CSS 变量

| 变量                   | 说明                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `--dou-tabs-height`    | 标签高度                                                    |
| `--dou-tabs-padding-x` | 标签水平内边距                                              |
| `--dou-tabs-icon-size` | 图标尺寸                                                    |
| `--dou-tabs-indicator` | 下划线颜色                                                  |
| `--dou-tabs-panel-gap` | 标签行和下方面板之间的距离，默认 16px；标签排在旁边时不用它 |
