# Tabs 标签页

在同一区域内切换几组相关的内容。

## 基础用法

<DocDemo src="tabs/basic" column />

不绑定 `v-model` 时默认选中第一个可用的标签。面板在第一次显示时才渲染，之后切走也会保留，切回来是即时的，状态也还在。面板设了 `eager` 时一开始就渲染，适合放隐藏时也要存在的内容，比如提交时要校验的表单字段。

## 自定义标签与额外内容

面板的 `label` 插槽替换标签文字，比如加上图标或计数，插槽参数为 `{ selected }`。`DouTabs` 的 `extra` 插槽放在标签行的末尾。

<DocDemo src="tabs/custom-label" column />

## 可关闭与新增

`closable` 给每个标签加一个关闭按钮，`addable` 在标签行末尾加一个新增按钮。组件只发出 `remove` 和 `add`，增删面板由你来做，这样关闭前可以先确认、新建时可以先起名。面板自己的 `closable` 优先，适合让某个标签常驻。

<DocDemo src="tabs/closable" column />

关闭按钮不在 `Tab` 顺序里（标签本身已经是按钮，里面不能再放按钮）；焦点在可关闭的标签上时按 `Delete` 或 `Backspace` 关闭它，标签通过 `aria-keyshortcuts` 告诉读屏这个快捷键。

## 标签较多时

放不下的标签行可以横向滚动：有更多标签的一侧边缘渐隐，两端出现箭头按钮，点击翻过大约一屏。选中的标签（包括用方向键切换、或从外部改 `v-model`）总会滚进可见范围。箭头不在 `Tab` 顺序里，键盘用方向键在标签之间移动即可。

<DocDemo src="tabs/overflow" column />

## 竖排

`placement="start"` 把标签竖排在面板左侧，`"end"` 放在右侧。指示线移到标签列的边上，方向键改为 `↑` `↓`。

<DocDemo src="tabs/vertical" column />

## 离开前确认

`before-leave` 在切换前调用，参数是要去的值和当前的值；返回 `false`（或 resolve 为 `false`）就留在当前标签。

<DocDemo src="tabs/before-leave" column />

## 尺寸

<DocDemo src="tabs/size" column />

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
| `eager`    | 一开始就渲染内容，不等第一次显示      | `boolean`          | `false` |

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
