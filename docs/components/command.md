# Command 命令面板

通过搜索快速查找并执行操作。

## 基础用法

`items` 是命令列表，每一项有唯一的 `value` 和显示的 `label`；`group` 相同的项列在同一个组名下。选中时触发 `select`，参数是那一项。

<DocDemo src="command/basic" column />

## 搜索与排序

默认是模糊匹配：只要字母按顺序出现就算匹配，连续的、在词首的、在开头的字母得分更高，完整包含的子串得分最高。有搜索词时结果按得分排序，组跟着最好的那一项走；没有搜索词时保持原来的顺序。

标签没有匹配时会再看 `description` 和 `keywords`，得分减半，所以试试输入"上线"或"release"。完全自定义时传 `filter(query, item)`，返回 `{ score, indices }` 或 `null`；`fuzzyMatch(text, query)` 也一并导出。

`shortcut` 只负责显示按键，不会绑定快捷键，真正的绑定由你决定。

## 命令面板对话框

`DouCommandDialog` 把它放进一个模态对话框，按 `⌘K`（Windows / Linux 上是 `Ctrl+K`）在任何地方打开或关闭，选中后自动关闭。每次打开都从空的搜索开始，焦点在搜索框里。

<DocDemo src="command/dialog" />

`hotkey` 改成别的组合，如 `"mod+p"`、`"shift+/"`；`mod` 在苹果系统上是 `⌘`，其他系统上是 `Ctrl`。传 `false` 不绑定。页面上只放一个命令面板对话框，否则同一个快捷键会被响应多次。

## 自定义

- `item` 插槽替换一行的内容，参数为 `{ item, active, indices }`，`indices` 是标签中匹配的位置；项上的其他属性会原样保留，可以放图标等。
- `prefix` 替换放大镜，`empty` 替换无结果时的文字，`footer` 放在列表下方，适合写按键提示。
- `v-model:query` 绑定搜索词，比如按搜索词从服务器加载 `items`，此时配合 `:filter="(q, item) => ({ score: 0, indices: [] })"` 保留服务器给的顺序。

## 键盘与读屏

搜索框是 `role="combobox"`，控制 `role="listbox"` 的列表，每组是 `role="group"` 并以组名命名。焦点始终留在搜索框里，当前项通过 `aria-activedescendant` 指出：`↑` `↓` 移动并跳过禁用项（到头后回绕，`loop` 为 `false` 时停住），`Ctrl` / `⌘` + `Home` / `End` 跳到首尾，`Enter` 执行。输入法组字时的按键不会被当成命令。对话框里 `Esc` 关闭并把焦点还给打开前的位置。

## API

### Command Props

| 名称          | 说明                                          | 类型                                                         | 默认值   |
| ------------- | --------------------------------------------- | ------------------------------------------------------------ | -------- |
| `items`       | 命令                                          | `CommandItem[]`                                              | —        |
| `query`       | 搜索词，配合 `v-model:query`                  | `string`                                                     | `''`     |
| `placeholder` | 搜索框占位文字                                | `string`                                                     | 语言包   |
| `emptyText`   | 无结果时的文字                                | `string`                                                     | 语言包   |
| `filter`      | 自定义匹配与打分                              | `(query: string, item: CommandItem) => CommandMatch \| null` | 模糊匹配 |
| `loop`        | 方向键到头后回绕                              | `boolean`                                                    | `true`   |
| `maxHeight`   | 列表最大高度，数字为 px                       | `number \| string`                                           | `320`    |
| `virtual`     | 只渲染看得见的条目；不传时超过 100 条自动开启 | `boolean`                                                    | —        |
| `ariaLabel`   | 搜索框与列表的名称                            | `string`                                                     | 占位文字 |

### CommandDialog Props

包含 Command 的全部 Props，另有：

| 名称            | 说明                          | 类型               | 默认值    |
| --------------- | ----------------------------- | ------------------ | --------- |
| `open`          | 是否打开，配合 `v-model:open` | `boolean`          | `false`   |
| `hotkey`        | 打开 / 关闭的快捷键           | `string \| false`  | `'mod+k'` |
| `closeOnSelect` | 选中后关闭                    | `boolean`          | `true`    |
| `width`         | 面板宽度，数字为 px           | `number \| string` | `560`     |

### CommandItem

| 名称          | 说明                         | 类型               |
| ------------- | ---------------------------- | ------------------ |
| `value`       | 唯一值                       | `string \| number` |
| `label`       | 显示的文字，优先匹配         | `string`           |
| `group`       | 所在的组                     | `string`           |
| `description` | 标签后的次要文字，也参与搜索 | `string`           |
| `keywords`    | 额外的搜索词                 | `string[]`         |
| `shortcut`    | 显示在末尾的按键             | `string[]`         |
| `disabled`    | 不可选中                     | `boolean`          |

### Events

| 名称           | 说明                             | 参数                  |
| -------------- | -------------------------------- | --------------------- |
| `select`       | 点击或 `Enter` 选中了一项        | `(item: CommandItem)` |
| `update:query` | 搜索词变化                       | `(query: string)`     |
| `update:open`  | 打开状态变化（仅 CommandDialog） | `(open: boolean)`     |

### Slots

| 名称     | 说明                                           |
| -------- | ---------------------------------------------- |
| `item`   | 一行的内容，参数为 `{ item, active, indices }` |
| `prefix` | 替换放大镜                                     |
| `empty`  | 无结果时显示                                   |
| `footer` | 列表下方                                       |
