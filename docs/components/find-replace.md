# FindReplace 查找替换

编辑器里浮在内容上方的查找和替换面板。它只负责输入、按键和显示结果数，怎么查找、怎么替换由使用方决定。电子表格、块编辑器、代码编辑器和流程图的查找面板都是它。

## 基础用法

`v-model:search` 是要查找的文字，`count` 和 `current` 告诉面板一共有几处、当前是第几处（从 0 开始，没有当前项时传 `-1`）。面板发出 `next`、`previous`、`replace`、`replace-all` 和 `close`，由使用方去移动、替换和关闭。

<DocDemo src="find-replace/basic" />

## 选项

`options` 插槽放在查找框里面，用来放“区分大小写”这类开关，开关用 `size="sm"` 的 [`DouToggle`](./toggle) 并配上 [`DouTooltip`](./tooltip)。常用选项的文字在语言包的 `findReplace` 里，比如 `caseSensitive`、`wholeWord`、`regexp`，可以直接用 `useLocale().t('findReplace.caseSensitive')` 取。

## 只查找

`readonly` 去掉替换框和展开按钮，替换的按键也不再生效。只读的编辑器、或者只能查找的场景（比如在流程图里找节点）用它。

## 按键

焦点在面板里时：

| 按键                                | 作用                     |
| ----------------------------------- | ------------------------ |
| `Enter` / `Shift+Enter`             | 下一处 / 上一处          |
| 替换框里 `Enter`                    | 替换当前这一处           |
| 替换框里 `Ctrl/⌘+Enter`             | 全部替换                 |
| `Ctrl+H`（macOS 上是 `⌘+Option+F`） | 显示替换框并把焦点移过去 |
| `Ctrl/⌘+F`                          | 回到查找框并选中文字     |
| `Escape`                            | 关闭                     |

打开面板的按键（通常是 `Ctrl/⌘+F` 和 `Ctrl+H`）由使用方在自己的内容上绑定，打开后调用实例的 `focus()` 把焦点放进查找框。macOS 上 `⌘+H` 是隐藏应用，所以替换用 `⌘+Option+F`。

## 窄容器

面板默认宽约 330px。放在宽度小于 480px 的容器里时，查找框单独占一行，结果数和按钮换到下一行。这依赖容器查询，需要给外层设置 `container-type: inline-size`。

## API

### Props

| 名称        | 说明                                                                 | 类型      | 默认值  |
| ----------- | -------------------------------------------------------------------- | --------- | ------- |
| `search`    | 要查找的文字，用 `v-model:search`                                    | `string`  | `''`    |
| `replace`   | 替换成的文字，用 `v-model:replace`                                   | `string`  | `''`    |
| `replacing` | 是否显示替换框，用 `v-model:replacing`                               | `boolean` | `false` |
| `count`     | 一共有几处                                                           | `number`  | `0`     |
| `current`   | 当前是第几处，从 0 开始；没有时为 `-1`                               | `number`  | `-1`    |
| `capped`    | 实际不止 `count` 处，结果数显示为“超过 …个”                          | `boolean` | `false` |
| `error`     | 无法查找的原因，比如正则表达式写错了；显示在结果数的位置，查找框变红 | `string`  | —       |
| `readonly`  | 只查找，没有替换框                                                   | `boolean` | `false` |

### Events

| 名称          | 说明           | 参数 |
| ------------- | -------------- | ---- |
| `next`        | 到下一处       | —    |
| `previous`    | 到上一处       | —    |
| `replace`     | 替换当前这一处 | —    |
| `replace-all` | 全部替换       | —    |
| `close`       | 关闭面板       | —    |

### Slots

| 名称      | 说明               |
| --------- | ------------------ |
| `options` | 查找框里的选项开关 |

### Exposes

| 名称    | 说明                                         | 类型                                    |
| ------- | -------------------------------------------- | --------------------------------------- |
| `focus` | 把焦点放进查找框（或替换框）并选中其中的文字 | `(which?: 'find' \| 'replace') => void` |
