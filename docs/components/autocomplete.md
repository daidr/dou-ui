# Autocomplete 自动补全

输入框的输入建议。和 Select 不同，它的值就是输入框中的文字，不选择建议也可以提交任意内容。

## 基础用法

<DocDemo src="autocomplete/basic" />

建议按输入的文字过滤（不区分大小写），命中的部分加粗标出。选项可以是字符串，也可以是 `{ value, label, description, disabled }`。`filter` 传函数自定义匹配，传 `false` 则总是显示全部建议。

## 由输入生成建议

`fetch` 根据当前文字返回建议，可以是普通函数，也可以返回 Promise。下面的例子在 `@` 后面补全邮箱域名：

<DocDemo src="autocomplete/generate" />

## 异步建议

请求在停止输入 `debounce` 毫秒后发出（默认 200）；先发出的请求如果晚回来，结果会被丢弃，列表不会闪回旧内容。等待时列表里显示“加载中…”。

<DocDemo src="autocomplete/async" />

## 逐级选择

选中一条建议后列表默认收起。把 `hide-on-select` 设为 `false`，列表会保持打开，并马上按新的值重新 `fetch`，可以一层一层往下选，比如选目录。新的建议回来之前，列表里显示“加载中…”，不会留着上一层的建议。不管是否收起，选中后下次打开列表时，显示的都是按新值取的建议。

<DocDemo src="autocomplete/drill" />

## 插槽

`prefix` 放在文字前面，`option` 自定义每一条建议（参数 `{ option, query }`），`empty` 在没有建议时显示，文字较长时会在列表宽度内换行；不提供 `empty` 时，没有建议就直接收起列表。

## 键盘与读屏

输入框本身是 `role="combobox"`，`aria-autocomplete="list"`，高亮的建议通过 `aria-activedescendant` 告诉读屏，焦点始终留在输入框里。

| 按键    | 行为                                       |
| ------- | ------------------------------------------ |
| `↓` `↑` | 打开列表 / 在建议间移动                    |
| `Enter` | 选中高亮的建议；没有高亮时交给表单（提交） |
| `Esc`   | 收起列表                                   |

开启 `multiline` 后，列表收起时 `↑` `↓` 移动光标，没有高亮的建议时 `Enter` 换行；`clearable` 和 `prefix` 插槽不生效。

## API

### Autocomplete Props

| 名称           | 说明                                                                    | 类型                                           | 默认值           |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------- | ---------------- |
| `modelValue`   | 文字，配合 `v-model`                                                    | `string`                                       | —                |
| `options`      | 按文字过滤的建议                                                        | `(AutocompleteOption \| string)[]`             | `[]`             |
| `fetch`        | 根据文字取建议                                                          | `(query: string) => Source \| Promise<Source>` | —                |
| `filter`       | `options` 的匹配方式                                                    | `boolean \| (option, query) => boolean`        | `true`           |
| `debounce`     | `fetch` 前等待的毫秒数                                                  | `number`                                       | `200`            |
| `minLength`    | 至少输入几个字才给建议                                                  | `number`                                       | `0`              |
| `highlight`    | 标出命中的部分                                                          | `boolean`                                      | `true`           |
| `placeholder`  | 占位文字                                                                | `string`                                       | —                |
| `clearable`    | 显示清空按钮                                                            | `boolean`                                      | `false`          |
| `size`         | 尺寸，默认取表单或全局配置                                              | `'sm' \| 'md' \| 'lg'`                         | `'md'`           |
| `disabled`     | 禁用                                                                    | `boolean`                                      | `false`          |
| `readonly`     | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读 | `boolean`                                      | `false`          |
| `invalid`      | 标记为无效                                                              | `boolean`                                      | `false`          |
| `placement`    | 列表弹出的位置                                                          | `Placement`                                    | `'bottom-start'` |
| `teleport`     | 列表渲染到哪里，`false` 留在原处                                        | `string \| HTMLElement \| false`               | `'body'`         |
| `virtual`      | 只渲染看得见的建议；不传时超过 100 条自动开启                           | `boolean`                                      | —                |
| `multiline`    | 文字可以换行，输入框随内容变高，默认最多 8 行                           | `boolean \| { maxRows?: number }`              | `false`          |
| `hideOnSelect` | 选中建议后收起列表；`false` 时保持打开，显示新值的建议                  | `boolean`                                      | `true`           |

其余属性（如 `name`、`maxlength`）传给原生输入框。

### Autocomplete Events

| 名称                | 说明         | 参数                           |
| ------------------- | ------------ | ------------------------------ |
| `update:modelValue` | 文字变化     | `(value: string)`              |
| `select`            | 选中一条建议 | `(option: AutocompleteOption)` |

### Autocomplete Slots

| 名称     | 说明                                   |
| -------- | -------------------------------------- |
| `prefix` | 文字前面的内容                         |
| `option` | 每一条建议，参数为 `{ option, query }` |
| `empty`  | 没有建议时显示                         |
